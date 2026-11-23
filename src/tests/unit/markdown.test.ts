import { describe, it, expect } from 'vitest';
import { renderMarkdown, safeHref } from '@/core/markdown';

const html = (md: string) => {
  const box = document.createElement('div');
  box.append(renderMarkdown(md));
  return box;
};

/** Everything a rendered message may contain. Anything else is a hole. */
const TAGS = new Set(['P', 'BR', 'STRONG', 'EM', 'DEL', 'CODE', 'PRE', 'A', 'UL', 'OL', 'LI', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'HR', 'DIV', 'SPAN', 'BUTTON']);
const ATTRS: Record<string, string[]> = { A: ['href', 'target', 'rel'], OL: ['start'], CODE: ['class'], DIV: ['class'], SPAN: ['class'] };

function audit(root: Element): string[] {
  const problems: string[] = [];
  root.querySelectorAll('*').forEach(el => {
    if (!TAGS.has(el.tagName)) problems.push(`tag <${el.tagName.toLowerCase()}>`);
    for (const attr of Array.from(el.attributes)) {
      if (!(ATTRS[el.tagName] ?? []).includes(attr.name)) problems.push(`attribute ${attr.name} on <${el.tagName.toLowerCase()}>`);
      if (attr.name === 'href' && !/^(https?:|mailto:)/i.test(attr.value)) problems.push(`unsafe href ${attr.value}`);
      if (/^on/i.test(attr.name)) problems.push(`handler ${attr.name}`);
    }
  });
  return problems;
}

describe('renderMarkdown: what it renders', () => {
  it('renders table cells and nested lists using safe DOM nodes', () => {
    const el = html('| **Name** | Value |\n| --- | --- |\n| item | `42` |\n\n- parent\n  - child\n- sibling');
    expect(el.querySelector('thead th strong')?.textContent).toBe('Name');
    expect(el.querySelector('tbody td code')?.textContent).toBe('42');
    expect(el.querySelector('ul ul li')?.textContent).toBe('child');
    expect(el.querySelector(':scope > ul > li:last-child')?.textContent).toBe('sibling');
  });

  it('renders paragraphs, line breaks, emphasis, strike and inline code', () => {
    const el = html('Hello **bold** and *italic* and ~~gone~~ and `code`.\nSecond line');
    expect(el.innerHTML).toBe('<p>Hello <strong>bold</strong> and <em>italic</em> and <del>gone</del> and <code>code</code>.<br>Second line</p>');
  });

  it('renders headings as small headings, lists, quotes and rules', () => {
    const el = html('# Title\n\n- a\n- b\n\n3. c\n4. d\n\n> quoted **bit**\n\n---');
    expect(el.querySelector('h3')!.textContent).toBe('Title');
    expect(Array.from(el.querySelectorAll('ul li')).map(l => l.textContent)).toEqual(['a', 'b']);
    expect(el.querySelector('ol')!.getAttribute('start')).toBe('3');
    expect(el.querySelector('blockquote strong')!.textContent).toBe('bit');
    expect(el.querySelector('hr')).not.toBeNull();
  });

  it('renders fenced code as text, keeps the language, and shows a fence that is still open', () => {
    const el = html('```ts\nconst a = "<b>";\n```\n\nafter\n\n```py\nprint(1)');
    const codes = el.querySelectorAll('pre code');
    expect(codes[0].textContent).toBe('const a = "<b>";');
    expect(codes[0].className).toBe('language-ts');
    expect(el.querySelector('.md-lang')!.textContent).toBe('ts');
    expect(codes[1].textContent).toBe('print(1)'); // a reply that is still streaming
    expect(el.querySelectorAll('p')).toHaveLength(1);
  });

  it('does not format inside code, and leaves lone asterisks and underscores alone', () => {
    expect(html('`**not bold**`').querySelector('strong')).toBeNull();
    expect(html('2 * 3 * 4 and snake_case_name').textContent).toBe('2 * 3 * 4 and snake_case_name');
    expect(html('```\n**x**\n```').querySelector('strong')).toBeNull();
  });

  it('lets code blocks carry an action (the chat adds a copy button)', () => {
    const box = document.createElement('div');
    box.append(renderMarkdown('```js\nx\n```', { codeActions: (code, lang) => Object.assign(document.createElement('button'), { textContent: `copy ${lang}:${code}` }) }));
    expect(box.querySelector('.md-code-head button')!.textContent).toBe('copy js:x');
  });

  it('links: safe ones open in a new tab without referrer or opener; formatting works inside', () => {
    const a = html('see [**docs**](https://example.com/a?b=1 "title") or [mail](mailto:a@b.co)').querySelectorAll('a');
    expect(a[0].getAttribute('href')).toBe('https://example.com/a?b=1');
    expect(a[0].getAttribute('target')).toBe('_blank');
    expect(a[0].getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(a[0].querySelector('strong')!.textContent).toBe('docs');
    expect(a[1].getAttribute('href')).toBe('mailto:a@b.co');
  });
});

describe('renderMarkdown: untrusted input cannot become markup', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<style>*{display:none}</style><b onmouseover=alert(1)>hi</b>',
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](  javascript:alert(1))',
    '[x](java\tscript:alert(1))',
    '[x](java\nscript:alert(1))',
    '[x](&#106;avascript:alert(1))',
    '[x](data:text/html,<script>alert(1)</script>)',
    '[x](vbscript:msgbox(1))',
    '[x](//evil.example/steal)',
    '[x](/relative/path)',
    '![x](https://tracker.example/pixel.gif)',
    '![x](javascript:alert(1))',
    '**<img src=x onerror=alert(1)>**',
    '`<script>alert(1)</script>`',
    '```html\n<script>alert(1)</script>\n```',
    '> <img src=x onerror=alert(1)>',
    '- <svg/onload=alert(1)>',
    '# <img src=x onerror=alert(1)>',
    '[<img src=x onerror=alert(1)>](https://example.com)',
    '[a](https://example.com" onmouseover="alert(1))',
    '</p><script>alert(1)</script><p>',
    '\u0000<script>alert(1)</script>',
    '[x]( https://ok.example )'
  ];

  for (const payload of payloads) {
    it(`is inert: ${JSON.stringify(payload).slice(0, 60)}`, () => {
      const el = html(payload);
      expect(audit(el)).toEqual([]);
      expect(el.querySelector('script, img, svg, iframe, style, object, embed, form, input')).toBeNull();
    });
  }

  it('shows raw HTML as text, so the reader sees what the model wrote', () => {
    expect(html('<b>x</b>').textContent).toBe('<b>x</b>');
    expect(html('<script>alert(1)</script>').textContent).toBe('<script>alert(1)</script>');
  });

  it('never loads an image: it shows the alt text', () => {
    const el = html('![a diagram](https://tracker.example/p.gif)');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('[a diagram]');
  });

  it('safeHref allows http, https and mailto only, ignoring case, whitespace and control characters', () => {
    expect(['https://a.co', 'HTTP://a.co', ' https://a.co ', 'mailto:a@b.co'].map(safeHref)).toEqual(['https://a.co', 'HTTP://a.co', 'https://a.co', 'mailto:a@b.co']);
    for (const bad of ['javascript:alert(1)', 'java\tscript:alert(1)', 'java\u0000script:1', 'data:text/html,x', '//evil.co', '/x', '#x', 'ftp://x', 'file:///etc/passwd', '']) {
      expect(safeHref(bad), bad).toBeNull();
    }
  });

  it('survives hostile and huge input without hanging', () => {
    const start = Date.now();
    html('*'.repeat(20000) + '_'.repeat(20000) + '['.repeat(5000) + '`'.repeat(5000));
    html(('**a' + '*'.repeat(50)).repeat(2000));
    html('> '.repeat(500) + 'x');
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it('nesting is bounded: a stack of quotes stops nesting and cannot overflow the stack or loop', () => {
    const el = html('> '.repeat(50000) + 'deep');
    let depth = 0;
    for (let q = el.querySelector('blockquote'); q; q = q.querySelector(':scope > blockquote')) depth++;
    expect(depth).toBe(6);
    expect(el.textContent).toContain('deep');
    expect(audit(el)).toEqual([]);
  });
});
