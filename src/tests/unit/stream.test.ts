import { describe, it, expect } from 'vitest';
import { readText, readSSE } from '@/core/stream';

const enc = new TextEncoder();
/** A response whose body arrives in exactly these byte chunks. */
const response = (...chunks: Array<string | Uint8Array>) =>
  new Response(new ReadableStream({
    start(controller) {
      chunks.forEach(c => controller.enqueue(typeof c === 'string' ? enc.encode(c) : c));
      controller.close();
    }
  }));
const collect = async <T>(it: AsyncIterable<T>) => { const out: T[] = []; for await (const v of it) out.push(v); return out; };

describe('readText', () => {
  it('yields the body as text chunks', async () => {
    expect(await collect(readText(response('Hel', 'lo ', 'there')))).toEqual(['Hel', 'lo ', 'there']);
  });

  it('never splits a multi-byte character that spans two chunks', async () => {
    const bytes = enc.encode('héllo 🌍 ✓'); // é is 2 bytes, the emoji 4, the check 3
    const parts = Array.from(bytes).map(b => new Uint8Array([b])); // one byte per chunk: the worst case
    const text = (await collect(readText(response(...parts)))).join('');
    expect(text).toBe('héllo 🌍 ✓');
  });

  it('stops reading when the signal aborts', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const body = new ReadableStream({
      pull(c) { c.enqueue(enc.encode('x')); return new Promise(r => setTimeout(r, 5)); },
      cancel() { cancelled = true; }
    });
    const seen: string[] = [];
    for await (const chunk of readText(new Response(body), controller.signal)) {
      seen.push(chunk);
      if (seen.length === 3) controller.abort();
      if (seen.length > 20) break;
    }
    expect(cancelled).toBe(true);
    expect(seen.length).toBeLessThan(10);
  });

  it('falls back to the whole text when there is no stream', async () => {
    const res = { body: null, text: async () => 'whole' } as unknown as Response;
    expect(await collect(readText(res))).toEqual(['whole']);
  });
});

describe('readSSE', () => {
  it('parses events: event name, id, and data', async () => {
    const events = await collect(readSSE(response('event: delta\nid: 7\ndata: {"t":"hi"}\n\ndata: second\n\n')));
    expect(events).toEqual([{ event: 'delta', data: '{"t":"hi"}', id: '7' }, { event: 'message', data: 'second', id: undefined }]);
  });

  it('handles events split anywhere across chunks, including mid-line and between the two newlines', async () => {
    const stream = 'data: one\n\ndata: tw';
    const whole = `${stream}o\n\n`;
    for (let cut = 1; cut < whole.length; cut++) {
      const events = await collect(readSSE(response(whole.slice(0, cut), whole.slice(cut))));
      expect(events.map(e => e.data), `cut at ${cut}`).toEqual(['one', 'two']);
    }
  });

  it('accepts CRLF and bare CR line endings, comments, and joins multi-line data', async () => {
    const events = await collect(readSSE(response(': keep-alive\r\n\r\ndata: a\r\ndata: b\r\n\r\ndata: c\r\r')));
    expect(events.map(e => e.data)).toEqual(['a\nb', 'c']);
  });

  it('keeps a space only when it is not the single one after the colon, and allows an empty data line', async () => {
    const events = await collect(readSSE(response('data:  two spaces\n\ndata:\n\ndata:nospace\n\n')));
    expect(events.map(e => e.data)).toEqual([' two spaces', '', 'nospace']);
  });

  it('emits a final event with no trailing blank line, and ignores events with no data', async () => {
    expect((await collect(readSSE(response('data: last')))).map(e => e.data)).toEqual(['last']);
    expect(await collect(readSSE(response('event: ping\n\n')))).toEqual([]);
  });

  it('is what a model stream looks like end to end: JSON deltas become text', async () => {
    const body = ['data: {"delta":"Hel"}\n\n', 'data: {"delta":"lo"}\n\n', 'data: [DONE]\n\n'];
    const text: string[] = [];
    for await (const e of readSSE(response(...body))) {
      if (e.data === '[DONE]') break;
      text.push(JSON.parse(e.data).delta);
    }
    expect(text.join('')).toBe('Hello');
  });
});
