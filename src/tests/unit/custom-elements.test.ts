// @vitest-environment node
/**
 * Editor data for the HTML tags (scripts/custom-elements.ts).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('custom elements manifest', () => {
  it('describes every tag with its attributes and allowed values', () => {
    const out = mkdtempSync(path.join(tmpdir(), 'nx-ce-'));
    execFileSync('npx', ['tsx', 'scripts/custom-elements.ts', out], { stdio: 'pipe' });
    const vscode = JSON.parse(readFileSync(path.join(out, 'html-custom-data.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(out, 'custom-elements.json'), 'utf8'));
    const tag = (name: string) => vscode.tags.find((t: { name: string }) => t.name === name);

    expect(vscode.tags.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining([
      'nx-button', 'nx-input', 'nx-textarea', 'nx-select', 'nx-radio-group', 'nx-switch', 'nx-tabs', 'nx-dialog', 'nx-grid'
    ]));
    // Never the base class docs
    expect(vscode.tags.filter((t: { description: string }) => /Abstract base class/.test(t.description))).toEqual([]);

    const variant = tag('nx-button').attributes.find((a: { name: string }) => a.name === 'variant');
    expect(variant.values.map((v: { name: string }) => v.name)).toEqual(expect.arrayContaining(['primary', 'outline', 'ghost']));
    expect(tag('nx-button').attributes.find((a: { name: string }) => a.name === 'loading').valueSet).toBe('v');
    expect(tag('nx-radio-group').description).toMatch(/Radio group/);
    expect(tag('nx-accordion-item').attributes.map((a: { name: string }) => a.name)).toEqual(['disabled', 'expanded', 'title']);

    const tree = manifest.modules.find((m: any) => m.declarations[0].tagName === 'nx-tree').declarations[0];
    expect(tree.events.map((e: { name: string }) => e.name)).toEqual(['select', 'toggle', 'check']);
  }, 60_000);
});
