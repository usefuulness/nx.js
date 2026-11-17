// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderToString } from '@/ssr';
import { FileUpload } from '@/index';

describe('file upload on the server', () => {
  it('writes a native file input, so a plain form posts files before JavaScript loads', async () => {
    const html = await renderToString(
      <form method="post" action="/upload" enctype="multipart/form-data">
        <FileUpload name="docs" label="Documents" multiple accept=".pdf" required />
      </form>
    );
    // The stand-in sits in the light DOM, where a native form can see it
    expect(html).toMatch(/<input[^>]*type="file"[^>]*name="docs"[^>]*>/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*multiple/);
    expect(html).toContain('accept=".pdf"');
    expect(html).toContain('Drop files here or click to choose');
    expect(html).toContain('Documents');
  });
});
