# Chat

`<nx-chat>` is a chat window for talking to an AI (or a person): the conversation, streaming replies, safe Markdown, a message box with Stop. You decide where replies come from; the component is the interface.

```tsx
import { Chat, readText, readSSE } from 'nx.js';

<Chat
  style="height: 32rem"
  suggestions="Summarize this page|Write a haiku"
  onSend={e => e.target.respond(signal => reply(e.detail.text, signal))}
/>
```

`respond()` takes a function of an `AbortSignal` that returns text, a promise of it, or an (async) iterable of chunks. It adds an assistant message, streams into it, keeps the chat busy meanwhile, and ends it as `done`, `stopped` (the reader pressed **Stop**; the text so far is kept) or `error` (with a **Try again** button). It resolves with the message.

## Connecting a model

**Do not put a model API key in the browser.** Call your own server, which holds the key and streams the reply back:

```ts
async function* reply(text: string, signal: AbortSignal) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: chat.getMessages() }),   // the conversation, if your server needs it
    signal                                                    // Stop aborts the request
  });
  if (!response.ok) throw new Error(`The server said ${response.status}`);
  yield* readText(response, signal);                           // a plain text stream
}
```

Two helpers read the stream. `readText(response, signal)` yields decoded text chunks (a multi-byte character split across chunks is handled). `readSSE(response, signal)` yields server-sent events (`{ event, data, id }`), the format most model APIs stream in; turn each event into text for your provider:

```ts
async function* reply(signal: AbortSignal) {
  const response = await fetch('/api/chat', { method: 'POST', body: '…', signal });
  for await (const event of readSSE(response, signal)) {
    if (event.data === '[DONE]') return;
    const delta = JSON.parse(event.data).delta;               // the shape depends on the API
    if (delta) yield delta;
  }
}
```

## What is rendered, and why it is safe

A model's output is untrusted. Replies are Markdown, built from DOM nodes with `textContent`, never HTML:

- Raw HTML is **shown as text** (`<script>` appears as `<script>`), so you can see what the model wrote and nothing runs.
- **Images are never loaded** (a remote image is a tracking beacon); the alt text is shown.
- Links work only for `http`, `https` and `mailto`, open in a new tab, and carry `rel="noopener noreferrer nofollow"`. `javascript:`, `data:`, `//host` and relative links become plain text.
- User messages and system messages are plain text.

Supported: paragraphs, headings (small, so a reply doesn't shout), **bold**, *italic*, ~~strike~~, `code`, fenced code blocks (each with a copy button; a fence still open while streaming shows what has arrived), bullet and numbered lists, block quotes (a few levels deep), rules and links. Set `markdown="false"` to show replies as plain text. The renderer is exported as `renderMarkdown(text)` and `safeHref(url)` for other places you show untrusted text.

## Messages and API

```ts
chat.addMessage({ role: 'user', content: 'Hi' });      // 'user' | 'assistant' | 'system'; returns it, with an id
const reply = chat.addMessage({ role: 'assistant', content: '', status: 'streaming' });
chat.append(reply.id, 'Hello');                         // streaming by hand; drawn at most once per frame
chat.updateMessage(reply.id, { status: 'done' });
chat.setMessages([...]);  chat.getMessages();  chat.clear();
chat.send('text');        // as if typed: fires `send`, then adds it
chat.abort();             // stops the reply respond() is streaming
```

| Attribute | |
| --- | --- |
| `suggestions` | prompts shown while the conversation is empty (`"a\|b"` in HTML) |
| `placeholder`, `label`, `user-name`, `assistant-name` | text (names show above messages) |
| `busy`, `disabled`, `markdown`, `max-length` | state and limits |

| Event | `detail` | |
| --- | --- | --- |
| `send` | `{ text }` | cancelable: preventing it keeps the text in the box and adds no message |
| `stop` | | the reader pressed Stop |
| `regenerate`, `retry` | `{ message }` | buttons on the last reply, and on a failed one: you decide what to do |
| `suggestion` | `{ text }` | a suggestion was chosen (it is then sent) |
| `error` | `{ error }` | the source passed to `respond()` threw |

Size it with CSS (`height`, `max-height`): the conversation scrolls inside it, and the message box grows to a few lines.

## Keyboard and accessibility

**Enter** sends, **Shift+Enter** adds a line, and Enter that confirms a character in an input method (Japanese, Chinese, Korean…) never sends. The conversation is a `log` region (focusable, so it can be scrolled with the keyboard). A streaming reply is `aria-busy`, and the start and end of a reply are announced once, not word by word. Each message has a **Copy** button, the last reply a **Regenerate** button, and Stop is a button, not a gesture.

It follows new text while you are at the bottom. Scroll up to read and it stays where you are, and **Jump to latest** appears. Messages, the box and all strings are translated (see [Internationalization](internationalization.md)) and the layout follows the reading direction.
