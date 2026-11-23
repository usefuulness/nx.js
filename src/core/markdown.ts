/**
 * @file @/core/markdown.ts
 *
 * A small Markdown renderer for text you do not control (chat replies from a model, comments).
 * It builds DOM nodes with `textContent`, never HTML strings, so no input can become markup:
 * raw HTML is shown as text, and links are limited to http, https and mailto.
 *
 * Supported: paragraphs (a single line break is kept), headings, **bold**, *italic*, ~~strike~~,
 * `code`, fenced code blocks, bullet and numbered lists, block quotes, horizontal rules, and
 * [links](https://example.com). Tables and nested lists are supported. Images are shown as text.
 *
 * DOM-free at load; it needs `document` only when called.
 */

export interface MarkdownOptions {
  /** Add something (a copy button) to the header of each code block */
  codeActions?: (code: string, language: string) => Node | null;
  /** Document to create nodes in (default: the page's) */
  doc?: Document;
}

const MAX_QUOTE_DEPTH = 6;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** A link target we are willing to open: http(s) and mailto only. */
export function safeHref(href: string): string | null {
  const trimmed = href.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '');
  return SAFE_LINK.test(trimmed) ? trimmed : null;
}

type Inline = { re: RegExp; make: (m: RegExpExecArray, doc: Document, recurse: (s: string) => Node[]) => Node | null };

const INLINE: Inline[] = [
  // `code` (no formatting inside)
  { re: /`([^`\n]+)`/, make: (m, d) => Object.assign(d.createElement('code'), { textContent: m[1] }) },
  // ![alt](url): images are never loaded (a remote image is a tracking beacon); the alt text is shown
  { re: /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, make: (m, d) => d.createTextNode(m[1] ? `[${m[1]}]` : '') },
  // [text](url "title"): the text may be formatted; an unsafe url leaves just the text
  {
    re: /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/,
    make: (m, d, recurse) => {
      const href = safeHref(m[2]);
      if (!href) return d.createTextNode(m[1]);
      const a = d.createElement('a');
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
      a.append(...recurse(m[1]));
      return a;
    }
  },
  { re: /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/, make: (m, d, recurse) => wrap(d, 'strong', recurse(m[1] ?? m[2])) },
  { re: /~~([^~\n]+?)~~/, make: (m, d, recurse) => wrap(d, 'del', recurse(m[1])) },
  { re: /(?<![*\w])\*([^*\s][^*\n]*?)\*(?![*\w])|(?<![_\w])_([^_\s][^_\n]*?)_(?![_\w])/, make: (m, d, recurse) => wrap(d, 'em', recurse(m[1] ?? m[2])) }
];

function wrap(doc: Document, tag: string, children: Node[]): Node {
  const el = doc.createElement(tag);
  el.append(...children);
  return el;
}

/** Inline formatting inside one block of text. Everything not matched stays text. */
function inline(text: string, doc: Document, depth = 0): Node[] {
  const out: Node[] = [];
  let rest = text;
  const recurse = (s: string) => (depth < 4 ? inline(s, doc, depth + 1) : [doc.createTextNode(s)]);
  while (rest) {
    let best: { at: number; m: RegExpExecArray; rule: Inline } | null = null;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.at)) best = { at: m.index, m, rule };
    }
    if (!best) {
      out.push(doc.createTextNode(rest));
      break;
    }
    if (best.at > 0) out.push(doc.createTextNode(rest.slice(0, best.at)));
    const node = best.rule.make(best.m, doc, recurse);
    out.push(node ?? doc.createTextNode(best.m[0]));
    rest = rest.slice(best.at + best.m[0].length);
  }
  return out;
}

/** Lines of one paragraph, with a single line break kept as <br>. */
function lines(text: string, doc: Document): Node[] {
  return text.split('\n').flatMap((line, i) => (i ? [doc.createElement('br'), ...inline(line, doc)] : inline(line, doc)));
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}

/** Render Markdown to a fragment of safe DOM nodes. */
export function renderMarkdown(source: string, options: MarkdownOptions = {}, depth = 0): DocumentFragment {
  const doc = options.doc ?? document;
  const out = doc.createDocumentFragment();
  const all = source.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  while (i < all.length) {
    const line = all[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      // A fence still open at the end of the text (a reply that is streaming) shows what has arrived
      const marker = fence[1];
      const code: string[] = [];
      i++;
      while (i < all.length && !new RegExp(`^\\s{0,3}${marker[0]}{${marker.length},}\\s*$`).test(all[i])) code.push(all[i++]);
      i++; // the closing fence
      const text = code.join('\n');
      const language = fence[2] || '';
      const block = doc.createElement('div');
      block.className = 'md-code';
      const head = doc.createElement('div');
      head.className = 'md-code-head';
      const label = doc.createElement('span');
      label.className = 'md-lang';
      label.textContent = language;
      head.append(label);
      const action = options.codeActions?.(text, language);
      if (action) head.append(action);
      const pre = doc.createElement('pre');
      const codeEl = doc.createElement('code');
      if (language) codeEl.className = `language-${language.replace(/[^\w+#.-]/g, '')}`;
      codeEl.textContent = text;
      pre.append(codeEl);
      block.append(head, pre);
      out.append(block);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const h = doc.createElement(`h${Math.min(6, heading[1].length + 2)}`); // # inside a message is a small heading
      h.append(...inline(heading[2], doc));
      out.append(h);
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.append(doc.createElement('hr'));
      i++;
      continue;
    }

    if (line.includes('|') && all[i + 1]?.includes('|')) {
      const headers = tableCells(line);
      const separator = tableCells(all[i + 1]);
      if (separator.length === headers.length && separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'md-table';
        const table = doc.createElement('table');
        const head = table.createTHead().insertRow();
        for (const header of headers) {
          const cell = doc.createElement('th');
          cell.scope = 'col';
          cell.append(...inline(header, doc));
          head.append(cell);
        }
        const body = table.createTBody();
        i += 2;
        while (i < all.length && all[i].includes('|')) {
          const values = tableCells(all[i++]);
          const row = body.insertRow();
          for (let column = 0; column < headers.length; column++) {
            row.insertCell().append(...inline(values[column] ?? '', doc));
          }
        }
        wrapper.append(table);
        out.append(wrapper);
        continue;
      }
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const list = doc.createElement(ordered ? 'ol' : 'ul');
      if (ordered) {
        const start = Number(ORDERED.exec(line)![1]);
        if (start !== 1) list.setAttribute('start', String(start));
      }
      const indent = line.length - line.trimStart().length;
      while (i < all.length) {
        if (all[i].length - all[i].trimStart().length !== indent) break;
        const item = (ordered ? ORDERED : BULLET).exec(all[i]);
        if (!item) break;
        const li = doc.createElement('li');
        li.append(...inline(item[ordered ? 2 : 1], doc));
        list.append(li);
        i++;
        const nestedIndent = all[i] ? all[i].length - all[i].trimStart().length : 0;
        if (depth < MAX_QUOTE_DEPTH && nestedIndent > indent && (BULLET.test(all[i].trimStart()) || ORDERED.test(all[i].trimStart()))) {
          const nested: string[] = [];
          while (i < all.length && all[i].trim() && all[i].length - all[i].trimStart().length >= nestedIndent) {
            nested.push(all[i++].slice(nestedIndent));
          }
          li.append(renderMarkdown(nested.join('\n'), options, depth + 1));
        }
      }
      out.append(list);
      continue;
    }

    // Quotes nest a few levels; deeper than that is just text (a hostile message must not exhaust the stack)
    if (depth < MAX_QUOTE_DEPTH && QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < all.length && QUOTE.test(all[i])) quoted.push(QUOTE.exec(all[i++])![1]);
      const q = doc.createElement('blockquote');
      q.append(renderMarkdown(quoted.join('\n'), options, depth + 1));
      out.append(q);
      continue;
    }

    // A paragraph runs until a blank line or the start of another block
    const para: string[] = [all[i++]]; // the first line always belongs to it, so we always move forward
    const quoting = depth < MAX_QUOTE_DEPTH;
    while (i < all.length && all[i].trim() && !FENCE.test(all[i]) && !HEADING.test(all[i]) && !BULLET.test(all[i]) && !ORDERED.test(all[i]) && !(quoting && QUOTE.test(all[i])) && !RULE.test(all[i])) {
      para.push(all[i++]);
    }
    const p = doc.createElement('p');
    p.append(...lines(para.join('\n'), doc));
    out.append(p);
  }
  return out;
}
