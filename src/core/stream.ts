/**
 * @file @/core/stream.ts
 *
 * Helpers for reading a streaming `fetch` response as text, for chat replies. DOM-free.
 */

/** The response body as chunks of text, decoded across chunk boundaries (so a multi-byte character is never split). */
export async function* readText(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  if (!response.body) {
    yield await response.text();
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const stop = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', stop, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  } finally {
    signal?.removeEventListener('abort', stop);
    reader.releaseLock?.();
  }
}

export interface ServerEvent {
  /** `event:` (default `message`) */
  event: string;
  /** `data:` lines joined with a line break */
  data: string;
  id?: string;
}

/**
 * Server-sent events (`text/event-stream`) from a response: the format most model APIs stream in.
 * Handles events split across chunks, CRLF, comments and multi-line data.
 * Use `springRawMessage` for Spring streams that put raw text directly after `data:`.
 */
export async function* readSSE(response: Response, signal?: AbortSignal, options: { springRawMessage?: boolean } = {}): AsyncGenerator<ServerEvent> {
  let buffer = '';
  const parse = (block: string): ServerEvent | null => {
    let event = 'message';
    let id: string | undefined;
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const raw = colon < 0 ? '' : line.slice(colon + 1);
      const value = raw.replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(raw);
      else if (field === 'id') id = value;
    }
    if (!data.length) return null;
    const lines = options.springRawMessage && event === 'message' ? data : data.map(line => line.replace(/^ /, ''));
    return { event, data: lines.join('\n'), id };
  };
  for await (const chunk of readText(response, signal)) {
    buffer += chunk.replace(/\r\n?/g, '\n');
    let at: number;
    while ((at = buffer.indexOf('\n\n')) >= 0) {
      const event = parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 2);
      if (event) yield event;
    }
  }
  const last = parse(buffer);
  if (last) yield last;
}
