/**
 * @file @/components/ui/chat.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { renderMarkdown } from '@/core/markdown';

export interface ChatMessage {
  /** Needed to stream into a message or update it (generated when you add one without) */
  id?: string;
  role: 'user' | 'assistant' | 'system';
  /** The text. For an assistant reply it is Markdown (shown safely: see `markdown`) */
  content: string;
  /** `streaming` while a reply is arriving, `error` and `stopped` after it ended early */
  status?: 'streaming' | 'done' | 'error' | 'stopped';
  /** What went wrong, for `status: 'error'` */
  error?: string;
}

export interface ChatConfig {
  /** The conversation so far */
  messages?: ChatMessage[];
  /** Placeholder of the message box (default "Message…") */
  placeholder?: string;
  /** The box and buttons are off */
  disabled?: boolean;
  /** A reply is on its way: shows a Stop button, and Send waits */
  busy?: boolean;
  /** Prompts shown while the conversation is empty (a comma separated string in HTML) */
  suggestions?: string[] | string;
  /** Render assistant replies as Markdown (default true). User text is always plain */
  markdown?: boolean;
  /** Accessible name of the conversation (default "Conversation") */
  label?: string;
  /** Names shown above messages (default "You" and "Assistant") */
  userName?: string;
  assistantName?: string;
  /** Longest message the box accepts */
  maxLength?: number;
}

type Source = string | Promise<string> | AsyncIterable<string> | Iterable<string>;

let messageSeq = 0;

const isIterable = (value: unknown): value is AsyncIterable<string> | Iterable<string> =>
  typeof value === 'object' && value !== null && (Symbol.asyncIterator in value || Symbol.iterator in value);

/**
 * A chat window for talking to an AI (or a person): a conversation, streaming replies, and a message box.
 * You decide where replies come from; the component handles the interface.
 *
 * ```ts
 * chat.addEventListener('send', e => {
 *   chat.respond(signal => fetchReply(e.detail.text, signal));   // an async iterable of text chunks
 * });
 * ```
 *
 * - **Safe by design:** a reply is Markdown, shown with DOM nodes, never as HTML. Raw HTML appears as text,
 *   images are never loaded, and only `http`, `https` and `mailto` links work. User text is plain text.
 * - **Streaming:** `respond(source)` streams chunks into a new reply and handles the busy state, **Stop**
 *   (it aborts `signal`), and errors. Or add chunks yourself with `append(id, text)`.
 * - **Keyboard:** **Enter** sends, **Shift+Enter** adds a line (and Enter while an input method is composing never sends).
 * - **Accessible:** the conversation is a `log` region; a streaming reply is `aria-busy` and the start and end of a
 *   reply are announced once, not word by word. It follows new text while you are at the bottom and stops following
 *   if you scroll up, with a **Jump to latest** button.
 *
 * Events: `send` (detail: `{ text, message }`, cancelable: preventing it keeps the text in the box and removes the message),
 * `stop`, `regenerate` and `retry` (detail: `{ message }`), `suggestion` (detail: `{ text }`), `error` (detail: `{ error }`).
 */
export class NXChat extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['placeholder', 'disabled', 'busy', 'suggestions', 'markdown', 'label', 'user-name', 'assistant-name', 'max-length'];
  }

  private items: ChatMessage[] = [];
  private draft = '';
  /** Follow new text while the reader is at the bottom */
  private stick = true;
  private controller: AbortController | null = null;
  private dirty = new Set<string>();
  private frame = 0;
  private copiedTimer = 0;
  /** The last thing said to screen readers; written into the live region after each redraw, which replaces it */
  private announcement = '';
  /** Where the reader had scrolled to: a redraw replaces the scroller, so it is put back afterwards */
  private scrolled = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  // ────────── The conversation ──────────

  getMessages(): ChatMessage[] {
    return this.items.map(m => ({ ...m }));
  }

  /** Replace the conversation. (Also what the `messages` config does.) */
  setMessages(messages: ChatMessage[]): void {
    this.items = (messages ?? []).map(m => this.prepare(m));
    this.stick = true;
    this.scheduleUpdate();
  }

  private prepare(message: ChatMessage): ChatMessage {
    return { status: message.role === 'assistant' ? 'done' : undefined, ...message, id: message.id ?? `m${++messageSeq}`, content: String(message.content ?? '') };
  }

  /** Add a message to the end; returns it (with its `id`). */
  addMessage(message: ChatMessage): ChatMessage {
    const item = this.prepare(message);
    this.items.push(item);
    this.draw();
    return item;
  }

  /** Add text to a message, for a reply that is streaming in. Drawn at most once per frame. */
  append(id: string, text: string): void {
    const item = this.items.find(m => m.id === id);
    if (!item || !text) return;
    item.content += text;
    this.dirty.add(id);
    if (!this.frame) this.frame = requestAnimationFrame(() => this.flush());
  }

  /** Change a message's fields (its `status`, say). */
  updateMessage(id: string, changes: Partial<ChatMessage>): void {
    const item = this.items.find(m => m.id === id);
    if (!item) return;
    Object.assign(item, changes, { id });
    this.draw();
  }

  /** Remove every message. */
  clear(): void {
    this.abort();
    this.items = [];
    this.stick = true;
    this.draw();
  }

  /** Whether a reply is on its way. */
  isBusy(): boolean {
    return !!this.getProp('busy', false);
  }

  /** Stop the reply that `respond()` is streaming; its text so far is kept. */
  abort(): void {
    this.controller?.abort();
  }

  /**
   * Stream a reply into a new assistant message. `source` is a function of an `AbortSignal` returning
   * text, a promise of it, or an (async) iterable of chunks. The chat is busy meanwhile, **Stop** aborts
   * the signal, and a failure marks the message with a Try again button. Resolves with the message.
   */
  async respond(source: (signal: AbortSignal) => Source, options: { id?: string } = {}): Promise<ChatMessage> {
    this.abort();
    const controller = (this.controller = new AbortController());
    const message = this.addMessage({ id: options.id, role: 'assistant', content: '', status: 'streaming' });
    const id = message.id!;
    this.setAttribute('busy', '');
    this.announce(this.t('chat.responding'));
    try {
      const result = source(controller.signal);
      const resolved = isIterable(result) ? result : await result;
      if (typeof resolved === 'string') this.append(id, resolved);
      else for await (const chunk of resolved as AsyncIterable<string>) {
        if (controller.signal.aborted) break;
        this.append(id, chunk);
      }
      this.settle(id, controller.signal.aborted ? 'stopped' : 'done');
    } catch (error) {
      if (controller.signal.aborted) this.settle(id, 'stopped');
      else {
        this.settle(id, 'error', error instanceof Error ? error.message : String(error));
        this.dispatchEvent(new CustomEvent('error', { detail: { error }, bubbles: true, composed: true }));
      }
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.removeAttribute('busy');
      }
    }
    return this.items.find(m => m.id === id) ?? message;
  }

  private settle(id: string, status: ChatMessage['status'], error?: string): void {
    this.flush();
    this.updateMessage(id, { status, error });
    this.announce(status === 'done' ? this.t('chat.complete') : status === 'stopped' ? this.t('chat.stopped') : this.t('chat.error'));
  }

  // ────────── Sending ──────────

  /** Send text as if it was typed: fires `send`, and unless that is cancelled adds it as a message. */
  send(text: string): boolean {
    const value = text.trim();
    if (!value || this.getProp('disabled', false) || this.isBusy()) return false;
    // The user's message goes in first: the usual handler answers with respond() straight away, and
    // that reply must land after the question. A handler that cancels the event takes it back out.
    const message = this.addMessage({ role: 'user', content: value });
    const proceed = this.dispatchEvent(new CustomEvent('send', { detail: { text: value, message }, bubbles: true, composed: true, cancelable: true }));
    if (!proceed) {
      this.items = this.items.filter(m => m !== message);
      this.draw();
      return false;
    }
    this.draft = '';
    const box = this.box();
    if (box) {
      box.value = '';
      this.grow(box);
    }
    this.syncSend();
    return true;
  }

  // ────────── Drawing ──────────

  private box(): HTMLTextAreaElement | null {
    return this.$('textarea') as HTMLTextAreaElement | null;
  }

  private log(): HTMLElement | null {
    return this.$('.log') as HTMLElement | null;
  }

  private announce(text: string): void {
    this.announcement = text;
    const region = this.$('.announce');
    if (region) region.textContent = text;
  }

  private grow(box: HTMLTextAreaElement): void {
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 168)}px`;
  }

  private syncSend(): void {
    const send = this.$('.send') as HTMLButtonElement | null;
    if (send) send.disabled = !this.draft.trim() || !!this.getProp('disabled', false);
  }

  private nearBottom(): boolean {
    const log = this.log();
    return !log || log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  }

  private scrollToEnd(): void {
    const log = this.log();
    if (log) log.scrollTop = log.scrollHeight;
    this.$('.latest')?.setAttribute('hidden', '');
  }

  /** Patch the messages that changed while streaming, once per frame. */
  private flush(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    // Where the reader is *now*: the scroll event for a move they just made may not have arrived yet
    const follow = (this.stick = this.nearBottom());
    for (const id of this.dirty) {
      const item = this.items.find(m => m.id === id);
      const body = this.nodeFor(id)?.querySelector('.body');
      if (item && body) {
        body.replaceChildren(...this.content(item));
        this.nodeFor(id)?.classList.toggle('empty', !item.content);
      }
    }
    this.dirty.clear();
    if (follow) this.scrollToEnd();
    else this.$('.latest')?.removeAttribute('hidden');
  }

  private nodeFor(id: string): HTMLElement | null {
    return (Array.from(this.shadow?.querySelectorAll('.msg') ?? []) as HTMLElement[]).find(el => el.dataset.id === id) ?? null;
  }

  /** Redraw the whole conversation (a message was added, changed or removed). */
  private draw(): void {
    this.scheduleUpdate();
  }

  /**
   * A redraw replaces the scroller, so read where the reader is at the last moment, from the
   * old one: a scroll made after the redraw was scheduled would otherwise be lost, and the
   * conversation would jump to the end under them.
   */
  protected update(): void {
    const log = this.log();
    if (log) {
      this.stick = this.nearBottom();
      this.scrolled = log.scrollTop;
    }
    super.update();
  }

  protected afterRender(): void {
    const box = this.box();
    if (box) {
      box.value = this.draft;
      this.grow(box);
    }
    this.syncSend();
    // A redraw replaces the live region, so say it again once the new one is in the page
    const region = this.$('.announce');
    if (region && this.announcement) region.textContent = this.announcement;
    const log = this.log();
    if (this.stick) this.scrollToEnd();
    else if (log) {
      log.scrollTop = this.scrolled; // still reading further up: stay there, and keep offering the way back
      this.$('.latest')?.removeAttribute('hidden');
    }
  }

  private content(item: ChatMessage): Node[] {
    const useMarkdown = item.role === 'assistant' && !!this.getProp('markdown', true);
    if (!useMarkdown) return [document.createTextNode(item.content)];
    return Array.from(renderMarkdown(item.content, { codeActions: () => this.copyCodeButton() }).childNodes);
  }

  private copyCodeButton(): Node {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-copy';
    button.setAttribute('data-copy-code', '');
    button.setAttribute('aria-label', this.t('chat.copyCode'));
    button.innerHTML = Icons.get('copy');
    return button;
  }

  private async copy(text: string, button: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Not allowed (an insecure page, no permission): fall back to the selection API
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } finally {
        area.remove();
      }
    }
    button.classList.add('copied');
    this.announce(this.t('chat.copied'));
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => button.classList.remove('copied'), 1500) as unknown as number;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const codeButton = target.closest('[data-copy-code]') as HTMLElement | null;
    if (codeButton) {
      const code = codeButton.closest('.md-code')?.querySelector('pre code')?.textContent ?? '';
      void this.copy(code, codeButton);
      return;
    }
    const action = target.closest('[data-action]') as HTMLElement | null;
    const message = action ? this.items.find(m => m.id === action.closest<HTMLElement>('.msg')?.dataset.id) : undefined;
    if (action && message) {
      const name = action.dataset.action;
      if (name === 'copy') void this.copy(message.content, action);
      else if (name === 'regenerate') this.dispatchEvent(new CustomEvent('regenerate', { detail: { message }, bubbles: true, composed: true }));
      else if (name === 'retry') this.dispatchEvent(new CustomEvent('retry', { detail: { message }, bubbles: true, composed: true }));
      return;
    }
    const suggestion = target.closest('[data-suggestion]') as HTMLElement | null;
    if (suggestion) {
      const text = suggestion.dataset.suggestion ?? '';
      this.dispatchEvent(new CustomEvent('suggestion', { detail: { text }, bubbles: true, composed: true }));
      this.send(text);
    }
  }

  private suggestions(): string[] {
    const raw = this.getProp<string[] | string>('suggestions', '');
    return (Array.isArray(raw) ? raw : String(raw).split('|')).map(s => String(s).trim()).filter(Boolean);
  }

  private renderMessage(item: ChatMessage, last: boolean): Node {
    const name = item.role === 'user' ? this.getProp<string>('user-name') || this.t('chat.you')
      : item.role === 'assistant' ? this.getProp<string>('assistant-name') || this.t('chat.assistant') : '';
    const streaming = item.status === 'streaming';
    const busy = this.isBusy();
    return (
      <article class={['msg', item.role, item.status ?? '', { empty: !item.content }]} data-id={item.id}
               aria-busy={streaming ? 'true' : undefined} aria-label={name || undefined}>
        {item.role !== 'system' && (
          <div class="avatar" aria-hidden="true">{item.role === 'user' ? name.slice(0, 1).toUpperCase() : <span html={Icons.get('zap')} />}</div>
        )}
        <div class="content">
          {name && <div class="who">{name}</div>}
          <div class="body" part="body">{this.content(item)}</div>
          {streaming && !item.content && <div class="typing" aria-hidden="true"><i /><i /><i /></div>}
          {item.status === 'error' && (
            <div class="error" role="alert">
              <span>{item.error ? `${this.t('chat.error')}: ${item.error}` : this.t('chat.error')}</span>
              <button type="button" class="link" data-action="retry">{this.t('chat.retry')}</button>
            </div>
          )}
          {item.status === 'stopped' && <div class="note">{this.t('chat.stopped')}</div>}
          {!streaming && item.content && item.role !== 'system' && (
            <div class="actions">
              <button type="button" class="icon" data-action="copy" aria-label={this.t('chat.copy')} title={this.t('chat.copy')} html={Icons.get('copy')} />
              {item.role === 'assistant' && last && !busy && (
                <button type="button" class="icon" data-action="regenerate" aria-label={this.t('chat.regenerate')} title={this.t('chat.regenerate')} html={Icons.get('refresh')} />
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  protected render(): Node {
    const disabled = !!this.getProp('disabled', false);
    const busy = this.isBusy();
    const suggestions = this.suggestions();
    const maxLength = Number(this.getProp('max-length', 0)) || undefined;

    return (
      <section class="chat" part="chat" onClick={(e: MouseEvent) => this.onClick(e)}>
        <div class="log" part="log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"
             aria-label={this.getProp<string>('label') || this.t('chat.label')}
             onScroll={() => {
               this.stick = this.nearBottom();
               this.scrolled = this.log()?.scrollTop ?? 0;
               if (this.stick) this.$('.latest')?.setAttribute('hidden', '');
               else if (this.items.length) this.$('.latest')?.removeAttribute('hidden');
             }}>
          {this.items.length === 0 ? (
            <div class="empty-state">
              <p>{this.t('chat.empty')}</p>
              {suggestions.length > 0 && (
                <div class="suggestions">
                  {suggestions.map(s => <button type="button" class="chip" data-suggestion={s} disabled={disabled}>{s}</button>)}
                </div>
              )}
            </div>
          ) : (
            this.items.map((item, i) => this.renderMessage(item, i === this.items.length - 1))
          )}
        </div>
        <button type="button" class="latest" hidden onClick={() => { this.stick = true; this.scrollToEnd(); }}>
          <span html={Icons.get('chevron-down')} aria-hidden="true" />{this.t('chat.latest')}
        </button>
        <form class="composer" part="composer" onSubmit={(e: Event) => { e.preventDefault(); this.send(this.draft); }}>
          <textarea rows={1} placeholder={this.getProp<string>('placeholder') || this.t('chat.placeholder')}
                    aria-label={this.t('chat.inputLabel')} disabled={disabled} maxlength={maxLength}
                    onInput={(e: Event) => {
                      const box = e.target as HTMLTextAreaElement;
                      this.draft = box.value;
                      this.grow(box);
                      this.syncSend();
                    }}
                    onKeyDown={(e: KeyboardEvent) => {
                      // Enter sends; an input method confirming a character with Enter must not (keyCode 229 on older browsers)
                      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
                        e.preventDefault();
                        this.send(this.draft);
                      }
                    }} />
          {busy ? (
            <button type="button" class="stop" aria-label={this.t('chat.stop')} title={this.t('chat.stop')}
                    onClick={() => { this.dispatchEvent(new CustomEvent('stop', { bubbles: true, composed: true })); this.abort(); }}>
              <span html={Icons.get('square')} aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" class="send" aria-label={this.t('chat.send')} title={this.t('chat.send')} disabled={!this.draft.trim() || disabled}>
              <span html={Icons.get('send')} aria-hidden="true" />
            </button>
          )}
        </form>
        <div class="announce" role="status" aria-live="polite" />
      </section>
    );
  }

  protected styles(): string {
    return `
      :host { display: flex; flex-direction: column; min-height: 12rem; min-width: 0; font-size: 0.9375rem; }
      .chat { position: relative; display: flex; flex: 1; flex-direction: column; min-height: 0; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-background); color: var(--color-text); overflow: hidden; }

      .log { flex: 1; min-height: 0; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1.25rem; }
      .log:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-ring); }

      .empty-state { margin: auto; text-align: center; color: var(--color-text-secondary); display: grid; gap: 0.75rem; }
      .empty-state p { margin: 0; }
      .suggestions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
      .chip { padding: 0.375rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-background); color: var(--color-text); font: inherit; font-size: 0.8125rem; cursor: pointer; transition: background-color var(--transition-duration); }
      .chip:hover:not(:disabled) { background: var(--color-accent); }
      .chip:focus-visible, .composer button:focus-visible, .actions button:focus-visible, .link:focus-visible, .latest:focus-visible, .md-copy:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }

      .msg { display: flex; gap: 0.75rem; max-width: 100%; }
      .msg.user { flex-direction: row-reverse; }
      .msg.system { justify-content: center; color: var(--color-text-secondary); font-size: 0.8125rem; }
      .avatar { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; border-radius: var(--radius-full); background: var(--color-secondary); color: var(--color-secondary-foreground); font-size: 0.75rem; font-weight: 600; }
      .assistant .avatar { background: var(--color-primary); color: var(--color-primary-foreground); }
      .avatar [class] , .avatar span { display: inline-flex; font-size: 0.875rem; }
      .content { min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; max-width: min(100%, 44rem); }
      .user .content { align-items: flex-end; max-width: min(85%, 36rem); }
      .who { color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 500; }
      .user .body { padding: 0.5rem 0.75rem; border-radius: var(--radius-lg); background: var(--color-secondary); color: var(--color-secondary-foreground); white-space: pre-wrap; overflow-wrap: anywhere; }
      .system .body { white-space: pre-wrap; text-align: center; }
      .assistant .body { overflow-wrap: anywhere; line-height: 1.6; }
      .msg.empty .body { display: none; }

      /* Markdown */
      .body > :first-child { margin-top: 0; }
      .body > :last-child { margin-bottom: 0; }
      .body p { margin: 0.5rem 0; }
      .body h3, .body h4, .body h5, .body h6 { margin: 0.875rem 0 0.375rem; font-size: 1rem; line-height: 1.3; }
      .body ul, .body ol { margin: 0.5rem 0; padding-inline-start: 1.5rem; }
      .body li { margin: 0.125rem 0; }
      .body a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
      .body blockquote { margin: 0.5rem 0; padding-inline-start: 0.875rem; border-inline-start: 3px solid var(--color-border); color: var(--color-text-secondary); }
      .body hr { border: none; border-top: 1px solid var(--color-border); margin: 0.875rem 0; }
      .body code { padding: 0.125rem 0.3125rem; border-radius: var(--radius-sm); background: var(--color-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; }
      .md-code { margin: 0.625rem 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-muted); overflow: hidden; }
      .md-code-head { display: flex; align-items: center; justify-content: space-between; min-height: 1.75rem; padding: 0 0.5rem 0 0.75rem; border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 0.75rem; }
      .md-code pre { margin: 0; padding: 0.75rem; overflow-x: auto; }
      .md-code pre code { padding: 0; background: none; font-size: 0.8125rem; line-height: 1.55; white-space: pre; }
      .md-copy, .actions .icon { display: inline-flex; padding: 0.25rem; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
      .md-copy:hover, .actions .icon:hover { background: var(--color-accent); color: var(--color-text); }
      .copied { color: var(--color-success-text) !important; }

      .actions { display: flex; gap: 0.125rem; margin-inline-start: -0.25rem; opacity: 0; transition: opacity var(--transition-duration); }
      .msg:hover .actions, .msg:focus-within .actions { opacity: 1; }
      @media (hover: none) { .actions { opacity: 1; } }

      .typing { display: inline-flex; gap: 0.25rem; padding: 0.5rem 0; }
      .typing i { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--color-text-secondary); animation: nx-chat-dot 1.2s infinite ease-in-out; }
      .typing i:nth-child(2) { animation-delay: 0.15s; }
      .typing i:nth-child(3) { animation-delay: 0.3s; }
      @keyframes nx-chat-dot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
      @media (prefers-reduced-motion: reduce) { .typing i { animation: none; opacity: 0.6; } }

      .error { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--color-error-text); font-size: 0.8125rem; }
      .note { color: var(--color-text-secondary); font-size: 0.75rem; font-style: italic; }
      .link { padding: 0; border: none; background: none; color: var(--color-primary); font: inherit; text-decoration: underline; cursor: pointer; border-radius: var(--radius-sm); }

      .latest { position: absolute; inset-inline: 0; margin-inline: auto; bottom: 4.75rem; width: max-content; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-background); color: var(--color-text); box-shadow: var(--shadow-md); font: inherit; font-size: 0.8125rem; cursor: pointer; }
      .latest[hidden] { display: none; }
      .latest span { display: inline-flex; }

      .composer { display: flex; align-items: flex-end; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--color-border); }
      textarea { flex: 1; min-width: 0; max-height: 10.5rem; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); color: inherit; font: inherit; line-height: 1.5; resize: none; }
      textarea:focus-visible { outline: none; border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-ring) 25%, transparent); }
      textarea:disabled { background: var(--color-muted); cursor: not-allowed; }
      .send, .stop { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 2.375rem; height: 2.375rem; border: none; border-radius: var(--radius-md); background: var(--color-primary); color: var(--color-primary-foreground); cursor: pointer; }
      .stop { background: var(--color-secondary); color: var(--color-secondary-foreground); border: 1px solid var(--color-border); }
      .send:disabled { opacity: 0.5; cursor: not-allowed; }
      .send span, .stop span { display: inline-flex; }

      .announce { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-chat', NXChat);
