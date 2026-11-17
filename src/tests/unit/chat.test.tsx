import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NX, type NXChat } from '@/index';
import '@/locales/es';
import { nextFrame } from '../utils';

const frames = async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); };
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

describe('<nx-chat>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
  });
  const mount = async (config: Record<string, any> = {}) => {
    const el = NX.create<NXChat>({ xtype: 'chat', ...config });
    document.body.appendChild(el);
    await frames();
    return el;
  };
  const root = (el: NXChat) => el.shadowRoot!;
  const box = (el: NXChat) => root(el).querySelector('textarea') as HTMLTextAreaElement;
  const msgs = (el: NXChat) => Array.from(root(el).querySelectorAll('.msg')) as HTMLElement[];
  const type = (el: NXChat, text: string) => { box(el).value = text; box(el).dispatchEvent(new Event('input', { bubbles: true })); };
  const key = (el: NXChat, k: string, init: KeyboardEventInit & { keyCode?: number } = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    box(el).dispatchEvent(e);
    return e;
  };
  async function* chunks(...parts: string[]) { for (const p of parts) { await tick(1); yield p; } }

  it('is a labelled log region, with an empty state and suggestions', async () => {
    const el = await mount({ suggestions: 'Summarize this|Write a haiku' });
    const log = root(el).querySelector('.log')!;
    expect(log.getAttribute('role')).toBe('log');
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(log.getAttribute('aria-label')).toBe('Conversation');
    expect(log.getAttribute('tabindex')).toBe('0'); // a scrollable region must be reachable by keyboard
    expect(root(el).querySelector('.empty-state p')!.textContent).toBe('Start a conversation');
    const chips = Array.from(root(el).querySelectorAll('.chip')).map(c => c.textContent);
    expect(chips).toEqual(['Summarize this', 'Write a haiku']);
  });

  it('clicking a suggestion fires suggestion and send, and adds it as a message', async () => {
    const el = await mount({ suggestions: 'Write a haiku' });
    const send = vi.fn(), suggestion = vi.fn();
    el.addEventListener('send', send);
    el.addEventListener('suggestion', suggestion);
    (root(el).querySelector('.chip') as HTMLElement).click();
    await frames();
    expect((suggestion.mock.calls[0][0] as CustomEvent).detail.text).toBe('Write a haiku');
    expect((send.mock.calls[0][0] as CustomEvent).detail.text).toBe('Write a haiku');
    expect(msgs(el)).toHaveLength(1);
    expect(msgs(el)[0].classList.contains('user')).toBe(true);
  });

  it('Enter sends and clears the box; Shift+Enter, empty text and composition do not', async () => {
    const el = await mount();
    const sent: string[] = [];
    el.addEventListener('send', e => sent.push((e as CustomEvent).detail.text));
    type(el, '  hello  ');
    expect(key(el, 'Enter', { shiftKey: true }).defaultPrevented).toBe(false); // a new line
    expect(key(el, 'Enter', { isComposing: true }).defaultPrevented).toBe(false); // confirming an IME character
    expect(key(el, 'Enter', { keyCode: 229 }).defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
    expect(key(el, 'Enter').defaultPrevented).toBe(true);
    expect(sent).toEqual(['hello']);
    expect(box(el).value).toBe('');
    await frames();
    expect(msgs(el).map(m => m.querySelector('.body')!.textContent)).toEqual(['hello']);
    type(el, '   ');
    key(el, 'Enter');
    expect(sent).toHaveLength(1);
  });

  it('keeps the conversation in order when the handler answers straight away: the question first, then the reply', async () => {
    const el = await mount();
    el.addEventListener('send', e => { void el.respond(() => `answer to ${(e as CustomEvent).detail.text}`); });
    type(el, 'first');
    key(el, 'Enter');
    await frames(4);
    type(el, 'second');
    key(el, 'Enter');
    await frames(4);
    expect(el.getMessages().map(m => `${m.role}:${m.content}`)).toEqual(['user:first', 'assistant:answer to first', 'user:second', 'assistant:answer to second']);
    expect(msgs(el).map(m => m.classList.contains('user') ? 'user' : 'assistant')).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('a send handler can read the message that was added for it', async () => {
    const el = await mount();
    let seen: any;
    el.addEventListener('send', e => (seen = (e as CustomEvent).detail));
    el.send('hello');
    expect(seen.text).toBe('hello');
    expect(seen.message).toMatchObject({ role: 'user', content: 'hello' });
    expect(el.getMessages()[0].id).toBe(seen.message.id);
  });

  it('the Send button follows the text, and a cancelled send keeps the text and adds nothing', async () => {
    const el = await mount();
    const send = () => root(el).querySelector('.send') as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    type(el, 'x');
    expect(send().disabled).toBe(false);
    el.addEventListener('send', e => e.preventDefault(), { once: true });
    send().click();
    await frames();
    expect(box(el).value).toBe('x');
    expect(msgs(el)).toHaveLength(0);
    send().click();
    await frames();
    expect(msgs(el)).toHaveLength(1);
  });

  it('disabled: no typing, no sending, no suggestions', async () => {
    const el = await mount({ disabled: true, suggestions: 'a' });
    expect(box(el).disabled).toBe(true);
    expect((root(el).querySelector('.chip') as HTMLButtonElement).disabled).toBe(true);
    expect(el.send('hello')).toBe(false);
  });

  it('shows user text as plain text and assistant replies as safe Markdown: hostile output stays inert', async () => {
    const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)> [x](javascript:alert(1)) ![t](https://tracker.example/p.gif) **ok**';
    const el = await mount({ messages: [{ role: 'user', content: '<b>hi</b> **not bold**' }, { role: 'assistant', content: hostile }] });
    const [user, assistant] = msgs(el);
    expect(user.querySelector('.body')!.textContent).toBe('<b>hi</b> **not bold**');
    expect(user.querySelector('b, strong')).toBeNull();
    expect(assistant.querySelector('.body')!.querySelector('script, img, svg, iframe, style')).toBeNull(); // (the avatar has its own icon)
    expect(Array.from(assistant.querySelectorAll('a')).every(a => /^https?:|^mailto:/.test(a.getAttribute('href')!))).toBe(true);
    expect(assistant.querySelector('strong')!.textContent).toBe('ok');
    expect(assistant.querySelector('.body')!.textContent).toContain('<script>alert(1)</script>'); // visible as text
    const plain = await mount({ markdown: false, messages: [{ role: 'assistant', content: '**raw**' }] });
    expect(msgs(plain)[0].querySelector('strong')).toBeNull();
  });

  it('respond() streams chunks into a new reply, is busy meanwhile, and finishes as done', async () => {
    const el = await mount();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    async function* gated() { yield 'Hel'; yield 'lo **wor'; await gate; yield 'ld**'; }
    const done = el.respond(() => gated());
    await frames();
    expect(el.hasAttribute('busy')).toBe(true);
    expect(msgs(el)[0].getAttribute('aria-busy')).toBe('true');
    expect(root(el).querySelector('.stop')).not.toBeNull(); // Stop replaces Send while busy
    expect(root(el).querySelector('.send')).toBeNull();
    expect(msgs(el)[0].querySelector('.body')!.textContent).toBe('Hello **wor'); // what has arrived so far, drawn as it arrives
    release();
    const message = await done;
    await frames();
    expect(message.content).toBe('Hello **world**');
    expect(message.status).toBe('done');
    expect(el.hasAttribute('busy')).toBe(false);
    expect(msgs(el)[0].querySelector('.body strong')!.textContent).toBe('world');
    expect(msgs(el)[0].hasAttribute('aria-busy')).toBe(false);
    expect(root(el).querySelector('.announce')!.textContent).toBe('Response complete');
  });

  it('a string or a promise works as a source too', async () => {
    const el = await mount();
    expect((await el.respond(() => 'plain')).content).toBe('plain');
    expect((await el.respond(() => Promise.resolve('later'))).content).toBe('later');
    expect(el.getMessages().map(m => m.content)).toEqual(['plain', 'later']);
  });

  it('Stop aborts the signal, keeps the partial text, and marks the reply stopped', async () => {
    const el = await mount();
    let seen: AbortSignal | undefined;
    const stop = vi.fn();
    el.addEventListener('stop', stop);
    async function* slow(signal: AbortSignal) {
      seen = signal;
      yield 'part';
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve())); // waits until stopped
      yield ' never';
    }
    const done = el.respond(slow);
    await frames();
    (root(el).querySelector('.stop') as HTMLElement).click();
    const message = await done;
    await frames();
    expect(seen!.aborted).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(message.status).toBe('stopped');
    expect(message.content).toBe('part');
    expect(el.hasAttribute('busy')).toBe(false);
    expect(msgs(el)[0].querySelector('.note')!.textContent).toBe('Stopped');
  });

  it('a failing source marks the reply with the error, a Try again button, and an error event', async () => {
    const el = await mount();
    const errored = vi.fn(), retried = vi.fn();
    el.addEventListener('error', errored);
    el.addEventListener('retry', retried);
    async function* broken() { yield 'start'; throw new Error('rate limited'); }
    const message = await el.respond(broken);
    await frames();
    expect(message.status).toBe('error');
    expect(message.content).toBe('start');
    const alert = msgs(el)[0].querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Something went wrong: rate limited');
    expect(errored).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute('busy')).toBe(false);
    (alert.querySelector('button') as HTMLElement).click();
    expect((retried.mock.calls[0][0] as CustomEvent).detail.message.id).toBe(message.id);
  });

  it('streams without redrawing the whole conversation: the box, its text and focus survive', async () => {
    const el = await mount();
    type(el, 'my draft');
    box(el).focus();
    const textarea = box(el);
    const done = el.respond(() => chunks('a', 'b', 'c', 'd'));
    await done;
    await frames();
    expect(el.getMessages()[0].content).toBe('abcd');
    expect(box(el).value).toBe('my draft'); // the half-typed message is still there
    expect(root(el).querySelector('.send')).not.toBeNull();
    // Changing an attribute redraws, and the draft is restored too
    el.setAttribute('placeholder', 'Ask anything');
    await frames();
    expect(box(el).placeholder).toBe('Ask anything');
    expect(box(el).value).toBe('my draft');
    void textarea;
  });

  it('append() batches many chunks into one draw per frame', async () => {
    const el = await mount();
    const message = el.addMessage({ role: 'assistant', content: '', status: 'streaming' });
    await frames();
    const body = msgs(el)[0].querySelector('.body')!;
    const spy = vi.spyOn(body, 'replaceChildren');
    for (let i = 0; i < 200; i++) el.append(message.id!, 'x');
    await frames(2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(body.textContent).toBe('x'.repeat(200));
  });

  it('copies a message and a code block, and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await mount({ messages: [{ role: 'assistant', content: 'Use this:\n\n```js\nconsole.log(1)\n```' }] });
    (root(el).querySelector('[data-copy-code]') as HTMLElement).click();
    await tick();
    expect(writeText).toHaveBeenLastCalledWith('console.log(1)');
    (root(el).querySelector('[data-action="copy"]') as HTMLElement).click();
    await tick();
    expect(writeText).toHaveBeenLastCalledWith('Use this:\n\n```js\nconsole.log(1)\n```');
    expect(root(el).querySelector('.announce')!.textContent).toBe('Copied');
  });

  it('offers Regenerate only on the last reply and only when idle', async () => {
    const el = await mount({ messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'q2' }, { role: 'assistant', content: 'a2' }] });
    const regen = vi.fn();
    el.addEventListener('regenerate', regen);
    expect(root(el).querySelectorAll('[data-action="regenerate"]')).toHaveLength(1);
    (root(el).querySelector('[data-action="regenerate"]') as HTMLElement).click();
    expect((regen.mock.calls[0][0] as CustomEvent).detail.message.content).toBe('a2');
    el.setAttribute('busy', '');
    await frames();
    expect(root(el).querySelector('[data-action="regenerate"]')).toBeNull();
  });

  it('manages the conversation: messages config, getMessages copies, updateMessage, clear', async () => {
    const el = await mount({ messages: [{ role: 'system', content: 'Be brief' }, { id: 'a', role: 'assistant', content: 'hi' }] });
    expect(msgs(el)).toHaveLength(2);
    const copy = el.getMessages();
    copy[1].content = 'changed';
    expect(el.getMessages()[1].content).toBe('hi');
    el.updateMessage('a', { content: 'edited' });
    await frames();
    expect(msgs(el)[1].querySelector('.body')!.textContent).toBe('edited');
    el.clear();
    await frames();
    expect(msgs(el)).toHaveLength(0);
  });

  it('shows who is speaking, with custom names', async () => {
    const el = await mount({ userName: 'Ada', assistantName: 'Bot', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] });
    expect(msgs(el).map(m => m.querySelector('.who')!.textContent)).toEqual(['Ada', 'Bot']);
    expect(msgs(el)[0].getAttribute('aria-label')).toBe('Ada');
    expect(msgs(el)[0].querySelector('.avatar')!.textContent).toBe('A');
  });

  it('speaks the page language', async () => {
    document.documentElement.lang = 'es';
    const el = await mount({ messages: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'buenas' }] });
    expect(box(el).placeholder).toBe('Mensaje…');
    expect(msgs(el)[0].querySelector('.who')!.textContent).toBe('Tú');
    expect(root(el).querySelector('.log')!.getAttribute('aria-label')).toBe('Conversación');
    expect((root(el).querySelector('.send') as HTMLElement).getAttribute('aria-label')).toBe('Enviar mensaje');
  });
});
