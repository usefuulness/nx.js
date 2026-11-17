import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildLlms, guides } from '../../../scripts/llms';

const root = path.resolve(__dirname, '../../..');
const url = 'https://example.test/nx';

describe('llms.txt', () => {
  const { index, full } = buildLlms(root, url + '/');

  it('lists exactly the docs/*.md files', () => {
    const files = readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).sort();
    expect(guides.map(g => g.file).sort()).toEqual(files);
  });

  it('follows the llmstxt.org shape: title, summary quote, then link lists', () => {
    const lines = index.split('\n');
    expect(lines[0]).toMatch(/^# nx.js/);
    expect(lines[2]).toMatch(/^> /);
    expect(index).toContain('## Docs');
    for (const guide of guides) expect(index).toContain(`- [${guide.title}](${url}/docs/${guide.file}): ${guide.summary}`);
    expect(index).toContain(`(${url}/llms-full.txt)`);
    expect(index).not.toContain('//docs'); // a trailing slash on the site URL must not double up
  });

  it('puts every guide, verbatim and in order, into llms-full.txt', () => {
    let at = 0;
    for (const guide of guides) {
      const text = readFileSync(path.join(root, 'docs', guide.file), 'utf8').trim();
      const found = full.indexOf(text, at);
      expect(found, guide.file).toBeGreaterThanOrEqual(at);
      at = found + text.length;
    }
  });

  it('documents the newest features, so assistants do not recommend outdated patterns', () => {
    for (const phrase of ['loader', 'buffered', 'enhance', 'nx.js/components/', 'virtual']) expect(full, phrase).toContain(phrase);
  });
});
