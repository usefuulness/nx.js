// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderToString } from '@/ssr';
import { TagInput } from '@/index';

describe('tag input on the server', () => {
  it('renders the chips, a native text box for typing, and the tags in a hidden input', async () => {
    const html = await renderToString(
      <form method="post" action="/save"><TagInput name="topics" label="Topics" value="css,html" /></form>
    );
    expect(html).toContain('css');
    expect(html).toContain('html');
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    const text = inputs.find(i => i.includes('type="text"'))!;
    const hidden = inputs.find(i => i.includes('type="hidden"'))!;
    expect(text).toContain('name="topics"');
    expect(text).toContain('data-nx-native');
    expect(text).not.toContain('value=');
    expect(hidden).toContain('name="topics"');
    expect(hidden).toContain('value="css,html"');
    expect(hidden).not.toContain('aria-hidden'); // a hidden input needs no help, and the live region it rides on stays readable
  });

  it('writes no hidden input when there are no tags', async () => {
    const html = await renderToString(<TagInput name="topics" label="Topics" />);
    expect(html).not.toContain('type="hidden"');
    expect((html.match(/<input[^>]*>/g) ?? []).some(i => i.includes('type="text"') && i.includes('name="topics"'))).toBe(true);
  });
});
