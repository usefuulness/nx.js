// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli: any = await import(/* @vite-ignore */ join(process.cwd(), 'packages/create-nx/index.js'));
const root = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'create-nx-')); dirs.push(d); return d; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe('create-nx.js', () => {
  it('depends on a range that includes the library version in this repository', () => {
    // Fails when the library is bumped past the range new projects get: update NX_RANGE and publish create-nx.js
    const [major, minor] = root.version.split('.').map(Number);
    expect(cli.NX_RANGE).toBe(major === 0 ? `^0.${minor}.0` : `^${major}.0.0`);
  });

  it('has a template for every name it lists, and nothing else', () => {
    const base = join(process.cwd(), 'packages/create-nx/templates');
    for (const name of Object.keys(cli.TEMPLATES)) expect(statSync(join(base, name)).isDirectory()).toBe(true);
  });

  it('writes the app template with the placeholders filled and .gitignore renamed', () => {
    const dir = join(tmp(), 'My Cool App');
    const files: string[] = cli.scaffold({ dir, template: 'app' });
    expect(files).toEqual(['.gitignore', 'README.md', 'index.html', 'package.json', 'src/main.tsx', 'tsconfig.json']);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-cool-app');
    expect(pkg.dependencies['nx.js']).toBe(cli.NX_RANGE);
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain('<title>my-cool-app</title>');
    expect(JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8')).compilerOptions.jsxImportSource).toBe('nx.js');
    for (const f of files) expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/\{\{\w+\}\}/);
    expect(existsSync(join(dir, '_gitignore'))).toBe(false);
  });

  it('writes the html template with the version range in the script URL', () => {
    const dir = join(tmp(), 'site');
    cli.scaffold({ dir, template: 'html' });
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain(`unpkg.com/nx.js${cli.NX_RANGE}/dist/nx.umd.js`);
  });

  it('refuses a folder that is not empty, unless forced, and ignores .git', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'keep.txt'), 'x');
    expect(() => cli.scaffold({ dir, template: 'app' })).toThrow(/not empty/);
    expect(readFileSync(join(dir, 'keep.txt'), 'utf8')).toBe('x');
    cli.scaffold({ dir, template: 'app', force: true });
    expect(existsSync(join(dir, 'package.json'))).toBe(true);
    const withGit = tmp();
    mkdirSync(join(withGit, '.git'));
    expect(() => cli.scaffold({ dir: withGit, template: 'app' })).not.toThrow();
  });

  it('rejects an unknown template, including names that could climb out of the templates folder', () => {
    for (const template of ['nope', '../../etc', '__proto__', 'constructor']) {
      expect(() => cli.scaffold({ dir: join(tmp(), 'x'), template })).toThrow(/Unknown template/);
    }
  });

  it('makes valid package names from folder names', () => {
    expect(cli.toPackageName('My Cool App')).toBe('my-cool-app');
    expect(cli.toPackageName('/tmp/Some_Thing')).toBe('some_thing');
    expect(cli.toPackageName('  ..hidden  ')).toBe('hidden');
    expect(cli.toPackageName('@scope/pkg')).toBe('pkg');
    expect(cli.toPackageName('!!!')).toBe('my-nx-app');
  });

  it('parses its arguments', () => {
    expect(cli.parseArgs(['app1', '-t', 'html', '--no-install', '--force'])).toMatchObject({ folder: 'app1', template: 'html', install: false, force: true });
    expect(cli.parseArgs(['--template=app']).template).toBe('app');
    expect(cli.parseArgs(['-h']).help).toBe(true);
    expect(cli.parseArgs(['a', 'b', '--wat']).unknown).toEqual(['b', '--wat']);
  });

  it('finds the package manager that launched it', () => {
    expect(cli.detectPackageManager('pnpm/9.1.0 npm/? node/v22 linux x64')).toBe('pnpm');
    expect(cli.detectPackageManager('yarn/1.22.0 npm/? node/v22')).toBe('yarn');
    expect(cli.detectPackageManager('bun/1.1.0')).toBe('bun');
    expect(cli.detectPackageManager('npm/10.2.0 node/v22')).toBe('npm');
    expect(cli.detectPackageManager('')).toBe('npm');
  });
});
