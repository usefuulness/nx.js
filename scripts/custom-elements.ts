/**
 * Editor support for the HTML tags, generated from the sources at build time:
 *
 *   dist/custom-elements.json   Custom Elements Manifest (JetBrains, Storybook, lit tooling…)
 *   dist/html-custom-data.json  VS Code: "html.customData": ["./node_modules/nx.js/dist/html-custom-data.json"]
 *
 * For every `define('nx-…', Class)`: the class docs, its attributes (observedAttributes
 * plus the primitive props of its `…Config` interface, with their docs and allowed
 * values) and the events named in the docs.
 */
import ts from 'typescript';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(root, process.argv[2] ?? 'dist');

const config = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: d => { throw new Error(String(d.messageText)); }
})!;
const files = config.fileNames.filter(f => f.includes('/src/') && !f.includes('/src/tests/') && !f.endsWith('main.tsx'));
const program = ts.createProgram(files, config.options);
const checker = program.getTypeChecker();

interface Attribute { name: string; description?: string; values?: string[]; type?: string }
interface Element { tag: string; className: string; file: string; description: string; attributes: Attribute[]; events: string[] }

const toKebab = (name: string) => name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
const doc = (symbol: ts.Symbol | undefined) => (symbol ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim() : '');

function classOf(node: ts.Expression): ts.ClassDeclaration | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return target?.declarations?.find(ts.isClassDeclaration);
}

function baseClass(cls: ts.ClassDeclaration): ts.ClassDeclaration | undefined {
  const heritage = cls.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0];
  return heritage ? classOf(heritage.expression) : undefined;
}

/** `static get observedAttributes() { return [...] }`, walking up the class chain. */
function observed(cls: ts.ClassDeclaration | undefined): string[] {
  if (!cls) return [];
  for (const member of cls.members) {
    if (ts.isGetAccessor(member) && member.name.getText() === 'observedAttributes' && member.body) {
      const names: string[] = [];
      member.body.forEachChild(function visit(node): void {
        if (ts.isStringLiteral(node)) names.push(node.text);
        node.forEachChild(visit);
      });
      return names;
    }
  }
  return observed(baseClass(cls));
}

/** The `<Name>Config` interface next to the class (or its base class). */
function configInterface(cls: ts.ClassDeclaration | undefined): ts.InterfaceDeclaration | undefined {
  if (!cls?.name) return undefined;
  const name = cls.name.text.replace(/^NX/, '');
  const found = cls.getSourceFile().statements.find(
    (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === `${name}Config`
  );
  return found ?? configInterface(baseClass(cls));
}

function describeType(type: ts.Type): { values?: string[]; type?: string; primitive: boolean } {
  const parts = type.isUnion() ? type.types : [type];
  const meaningful = parts.filter(t => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
  if (meaningful.length && meaningful.every(t => t.isStringLiteral())) {
    return { values: meaningful.map(t => (t as ts.StringLiteralType).value), primitive: true };
  }
  if (meaningful.every(t => t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral))) return { type: 'boolean', primitive: true };
  if (meaningful.every(t => t.flags & (ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral))) {
    return { type: checker.typeToString(type).replace(/ \| undefined/g, ''), primitive: true };
  }
  return { primitive: false };
}

function describe(tag: string, cls: ts.ClassDeclaration): Element {
  const symbol = cls.name ? checker.getSymbolAtLocation(cls.name) : undefined;
  // Aliases without docs (NXTabs extends NXTabPanel) use their base's, but never BaseComponent's
  const base = baseClass(cls);
  const fullDoc = doc(symbol) || (base?.name && base.name.text !== 'BaseComponent' ? doc(checker.getSymbolAtLocation(base.name)) : '');
  const description = fullDoc.split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
  const events = Array.from(fullDoc.matchAll(/Events?:([^\n]*)/g))
    .flatMap(m => Array.from(m[1].matchAll(/`([a-z-]+)`/g), e => e[1]));

  const attributes = new Map<string, Attribute>();
  observed(cls).forEach(name => attributes.set(name, { name }));
  // `@attr name - description` in the class docs (for elements without observedAttributes)
  symbol?.getJsDocTags(checker).filter(t => t.name === 'attr').forEach(t => {
    const [, name, description] = /^(\S+)\s*(?:-\s*)?(.*)$/s.exec(ts.displayPartsToString(t.text)) ?? [];
    if (name) attributes.set(name, { name, description: description || undefined, type: /^(expanded|disabled|open)$/.test(name) ? 'boolean' : undefined });
  });

  const iface = configInterface(cls);
  if (iface) {
    const type = checker.getTypeAtLocation(iface);
    for (const prop of checker.getPropertiesOfType(type)) {
      const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!declaration) continue;
      const info = describeType(checker.getTypeOfSymbolAtLocation(prop, declaration));
      const name = toKebab(prop.name);
      if (!info.primitive && !attributes.has(name)) continue;
      attributes.set(name, {
        name,
        description: doc(prop) || undefined,
        values: info.values,
        type: info.values ? info.values.map(v => `'${v}'`).join(' | ') : info.type
      });
    }
  }

  return {
    tag,
    className: cls.name?.text ?? '',
    file: path.relative(root, cls.getSourceFile().fileName),
    description,
    attributes: Array.from(attributes.values()).sort((a, b) => a.name.localeCompare(b.name)),
    events: [...new Set(events)]
  };
}

const elements: Element[] = [];
for (const file of files) {
  const source = program.getSourceFile(file);
  source?.forEachChild(function visit(node): void {
    if (ts.isCallExpression(node) && node.expression.getText() === 'define' && ts.isStringLiteral(node.arguments[0]) && node.arguments[1]) {
      const cls = classOf(node.arguments[1]);
      if (cls) elements.push(describe(node.arguments[0].text, cls));
    }
    node.forEachChild(visit);
  });
}
elements.sort((a, b) => a.tag.localeCompare(b.tag));

const manifest = {
  schemaVersion: '1.0.0',
  modules: elements.map(el => ({
    kind: 'javascript-module',
    path: el.file,
    declarations: [{
      kind: 'class',
      name: el.className,
      tagName: el.tag,
      customElement: true,
      description: el.description,
      attributes: el.attributes.map(a => ({ name: a.name, description: a.description, type: a.type ? { text: a.type } : undefined })),
      events: el.events.map(name => ({ name }))
    }],
    exports: [{ kind: 'custom-element-definition', name: el.tag, declaration: { name: el.className, module: el.file } }]
  }))
};

const vscode = {
  version: 1.1,
  tags: elements.map(el => ({
    name: el.tag,
    description: el.description,
    attributes: el.attributes.map(a => ({
      name: a.name,
      description: a.description,
      ...(a.values ? { values: a.values.map(name => ({ name })) } : a.type === 'boolean' ? { valueSet: 'v' } : {})
    }))
  }))
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'custom-elements.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(outDir, 'html-custom-data.json'), JSON.stringify(vscode, null, 2) + '\n');
console.log(`custom elements: ${elements.length} tags → ${path.relative(root, outDir)}/custom-elements.json, html-custom-data.json`);
