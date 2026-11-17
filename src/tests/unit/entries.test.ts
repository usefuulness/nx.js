import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const sourceDirs = ['src/components/ui', 'src/components/ui/form', 'src/layout', 'src/data'];

/** Every component module that defines an element, with the tags it defines. */
const components = sourceDirs.flatMap(dir =>
  readdirSync(path.join(root, dir))
    .filter(file => file.endsWith('.tsx'))
    .map(file => ({ name: file.slice(0, -4), dir, tags: [...readFileSync(path.join(root, dir, file), 'utf8').matchAll(/define\('(nx-[a-z-]+)'/g)].map(m => m[1]) }))
    .filter(c => c.tags.length)
);

describe('per-component entry points (nx.js/components/*)', () => {
  it('has an entry for every component that defines an element, and no stray ones', () => {
    const entries = readdirSync(path.join(root, 'src/entries')).filter(f => f.endsWith('.ts')).map(f => f.slice(0, -3)).sort();
    expect(entries).toEqual(components.map(c => c.name).sort());
  });

  it('package.json exposes them, with types, for ESM and CJS', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.exports['./components/*']).toEqual({
      types: './dist/entries/*.d.ts',
      import: './dist/entries/*.js',
      require: './dist/entries/*.cjs'
    });
  });

  for (const component of components) {
    it(`nx.js/components/${component.name} registers ${component.tags.join(', ')}`, async () => {
      expect(existsSync(path.join(root, 'src/entries', `${component.name}.ts`))).toBe(true);
      await import(`@/entries/${component.name}`);
      for (const tag of component.tags) expect(customElements.get(tag), tag).toBeDefined();
    });
  }
});
