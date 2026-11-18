#!/usr/bin/env node
/**
 * create-nx.js: `npm create nx.js` (also `pnpm create nx.js`, `yarn create nx.js`, `bun create nx.js`).
 * Copies a template into a new folder and installs it. No dependencies.
 */
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The nx.js versions a new project depends on. Kept in step with the library by a unit test. */
export const NX_RANGE = '^0.5.0';

export const TEMPLATES = {
  app: 'A Vite + TypeScript app that writes UI as JSX (recommended)',
  html: 'One HTML file with a <script> tag: no build step'
};

const here = fileURLToPath(new URL('.', import.meta.url));

const HELP = `create-nx.js: start an nx.js project

Usage
  npm create nx.js [folder] [options]

Options
  -t, --template <name>   ${Object.keys(TEMPLATES).join(' or ')} (default: app)
  --no-install            do not install dependencies
  --force                 write into a folder that is not empty
  -h, --help              show this help

Examples
  npm create nx.js my-app
  npm create nx.js my-site -- --template html
`;

/** Turn a folder name into a valid npm package name (lowercase, URL-safe). */
export function toPackageName(folder) {
  const name = basename(resolve(String(folder)))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]+/, '')
    .replace(/[^a-z0-9-~._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'my-nx-app';
}

export function parseArgs(argv) {
  const out = { folder: '', template: '', install: true, force: false, help: false, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--no-install') out.install = false;
    else if (a === '--force') out.force = true;
    else if (a === '-t' || a === '--template') out.template = argv[++i] ?? '';
    else if (a.startsWith('--template=')) out.template = a.slice('--template='.length);
    else if (a.startsWith('-')) out.unknown.push(a);
    else if (!out.folder) out.folder = a;
    else out.unknown.push(a);
  }
  return out;
}

/** The package manager that ran us (`npm_config_user_agent` is "pnpm/9.1.0 npm/? node/..."). */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent ?? '') {
  const name = userAgent.split(' ')[0]?.split('/')[0];
  return ['pnpm', 'yarn', 'bun'].includes(name) ? name : 'npm';
}

function isEmptyDir(dir) {
  return !existsSync(dir) || readdirSync(dir).filter(f => f !== '.git').length === 0;
}

/**
 * Copy a template into `dir` and fill in its placeholders. Returns the files written (relative paths).
 * `_gitignore` is stored under that name because npm would drop a real `.gitignore` from the package.
 */
export function scaffold({ dir, template = 'app', name, nxRange = NX_RANGE, force = false }) {
  if (!Object.hasOwn(TEMPLATES, template)) throw new Error(`Unknown template "${template}". Choose ${Object.keys(TEMPLATES).join(' or ')}.`);
  const target = resolve(dir);
  if (!force && !isEmptyDir(target)) throw new Error(`${target} is not empty. Pick another folder, or pass --force.`);
  const pkgName = name || toPackageName(target);
  mkdirSync(target, { recursive: true });
  cpSync(join(here, 'templates', template), target, { recursive: true });

  const written = [];
  const walk = folder => {
    for (const entry of readdirSync(folder)) {
      let path = join(folder, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (entry === '_gitignore') {
        const renamed = join(folder, '.gitignore');
        renameSync(path, renamed);
        path = renamed;
      }
      const text = readFileSync(path, 'utf8')
        .replaceAll('{{name}}', pkgName)
        .replaceAll('{{nxRange}}', nxRange);
      writeFileSync(path, text);
      written.push(relative(target, path).split('\\').join('/'));
    }
  };
  walk(target);
  return written.sort();
}

async function ask(rl, question, fallback) {
  const answer = (await rl.question(`${question} (${fallback}) `)).trim();
  return answer || fallback;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { console.log(HELP); return 0; }
  if (args.unknown.length) { console.error(`Unknown option or extra argument: ${args.unknown.join(' ')}\n\n${HELP}`); return 1; }

  let { folder, template } = args;
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  if (interactive && (!folder || !template)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!folder) folder = await ask(rl, 'Project folder?', 'my-nx-app');
      if (!template) {
        console.log(Object.entries(TEMPLATES).map(([k, v]) => `  ${k.padEnd(5)} ${v}`).join('\n'));
        template = await ask(rl, 'Template?', 'app');
      }
    } finally { rl.close(); }
  }
  folder ||= 'my-nx-app';
  template ||= 'app';

  let files;
  try {
    files = scaffold({ dir: folder, template, force: args.force });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const target = resolve(folder);
  console.log(`\nCreated ${files.length} files in ${target}`);

  const pm = detectPackageManager();
  let installed = false;
  if (args.install && template !== 'html') {
    console.log(`\nInstalling with ${pm}…\n`);
    const result = spawnSync(pm, ['install'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
    installed = result.status === 0;
    if (!installed) console.error(`\n${pm} install did not finish. Run it yourself in the folder.`);
  }

  const cd = relative(process.cwd(), target) || '.';
  const run = pm === 'npm' ? 'npm run' : pm;
  console.log('\nNext:');
  if (cd !== '.') console.log(`  cd ${cd}`);
  if (template === 'html') console.log('  open index.html in your browser (or serve the folder)');
  else {
    if (!installed) console.log(`  ${pm} install`);
    console.log(`  ${run} dev`);
  }
  console.log('\nDocs: https://usefuulness.github.io/nx.js/docs/\n');
  return 0;
}

// Run only when started as a command, not when imported (the tests import it)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => process.exit(code));
}
