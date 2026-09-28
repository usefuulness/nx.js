/**
 * @file @/components/ui/command.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { keepInView } from '@/core/position';
import type { NXModal } from '@/components/ui/modal';

export interface CommandItem {
  text: string;
  /** Returned by `NX.command()`; defaults to `text` */
  value?: string;
  icon?: string;
  /** Shown on the right, e.g. `⌘N` */
  shortcut?: string;
  /** Heading the item is listed under */
  group?: string;
  /** Extra words that should find this item */
  keywords?: string[];
  disabled?: boolean;
  handler?: (item: CommandItem) => void;
}

export interface CommandConfig {
  items?: CommandItem[];
  /** Search box placeholder */
  placeholder?: string;
  /** Shown when nothing matches (default "No results found.") */
  emptyText?: string;
}

/** 0 = no match; higher is better: prefix > word start > substring > in keywords > letters in order. */
export function commandScore(item: CommandItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const text = item.text.toLowerCase();
  if (text.startsWith(q)) return 5;
  if (text.split(/[\s\-_/.]+/).some(word => word.startsWith(q))) return 4;
  if (text.includes(q)) return 3;
  if (item.keywords?.some(k => k.toLowerCase().includes(q))) return 2;
  let i = 0;
  for (const char of text) if (char === q[i]) i++;
  return i === q.length ? 1 : 0;
}

/**
 * Command menu: a search box over a list of actions (shadcn's Command / ⌘K).
 * Type to filter, arrow keys to move, Enter to run.
 *
 * ```typescript
 * NX.command.bind('mod+k', () => [
 *   { text: 'New invoice', icon: 'plus', shortcut: '⌘N', group: 'Actions', handler: () => … },
 *   { text: 'Settings', icon: 'settings', group: 'Go to', keywords: ['preferences'] }
 * ]);
 * const item = await NX.command(items);   // or open it yourself
 * ```
 *
 * Inline: `<nx-command items='[{"text":"Profile"}]'></nx-command>`. Events: `select` (detail: `{ item }`).
 */
export class NXCommand extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['placeholder', 'empty-text'];
  }

  private items: CommandItem[] = [];
  private visible: CommandItem[] = [];
  private active = 0;
  private query = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open', delegatesFocus: true });
  }

  protected initializeState(): void {}

  setItems(items: CommandItem[]): void {
    this.items = items ?? [];
    this.filter(this.query);
    this.scheduleUpdate();
  }

  getItems(): CommandItem[] {
    return this.items;
  }

  focus(options?: FocusOptions): void {
    (this.$('input') as HTMLInputElement | null)?.focus(options);
  }

  private filter(query: string): void {
    this.query = query;
    this.visible = this.items
      .map((item, index) => ({ item, index, score: commandScore(item, query) }))
      .filter(r => r.score > 0)
      // Best matches first while searching; the given order otherwise
      .sort((a, b) => (query.trim() ? b.score - a.score : 0) || a.index - b.index)
      .map(r => r.item);
    // Keep groups together (in order of their best match), so indexes match what is shown
    this.visible = this.groups().flatMap(([, items]) => items);
    this.active = Math.max(0, this.visible.findIndex(item => !item.disabled));
  }

  private run(item: CommandItem | undefined): void {
    if (!item || item.disabled) return;
    item.handler?.(item);
    this.emit('select', { item });
  }

  private move(delta: number): void {
    const n = this.visible.length;
    if (!n) return;
    let index = this.active;
    for (let i = 0; i < n; i++) {
      index = (index + delta + n) % n;
      if (!this.visible[index].disabled) break;
    }
    this.active = index;
    this.renderList();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const actions: Record<string, () => void> = {
      ArrowDown: () => this.move(1),
      ArrowUp: () => this.move(-1),
      Home: () => { this.active = -1; this.move(1); },
      End: () => { this.active = 0; this.move(-1); },
      Enter: () => this.run(this.visible[this.active])
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }

  /** Groups in first-appearance order; ungrouped items first. */
  private groups(): Array<[string, CommandItem[]]> {
    const groups = new Map<string, CommandItem[]>();
    this.visible.forEach(item => {
      const key = item.group ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return Array.from(groups);
  }

  /** Patch the list in place so typing never re-renders the input. */
  private renderList(): void {
    const list = this.$('.list');
    const input = this.$('input');
    if (!list || !input) return;
    const id = (i: number) => `cmd-${i}`;
    let i = 0;

    list.replaceChildren(...(this.visible.length
      ? this.groups().map(([group, items]) => (
          <div role="group" class="group" part="group" aria-label={group || undefined}>
            {group && <div class="heading" part="heading" aria-hidden="true">{group}</div>}
            {items.map(item => {
              const index = i++;
              return (
                <div role="option" id={id(index)} part="item" class={['item', { active: index === this.active }]}
                     aria-selected={String(index === this.active)} aria-disabled={item.disabled ? 'true' : undefined}
                     onPointerDown={(e: PointerEvent) => e.preventDefault()}
                     onPointerMove={() => {
                       if (this.active !== index && !item.disabled) {
                         this.active = index;
                         this.renderList();
                       }
                     }}
                     onClick={() => this.run(item)}>
                  {item.icon && <span class="icon" aria-hidden="true" html={Icons.get(item.icon)} />}
                  <span class="text">{item.text}</span>
                  {item.shortcut && <kbd class="shortcut" part="shortcut">{item.shortcut}</kbd>}
                </div>
              );
            })}
          </div>
        ) as HTMLElement)
      : [<div class="empty" part="empty" role="status">{this.getProp('empty-text', 'No results found.')}</div> as HTMLElement]));

    if (this.visible[this.active]) {
      input.setAttribute('aria-activedescendant', id(this.active));
      keepInView(list as HTMLElement, list.querySelector(`#${id(this.active)}`) as HTMLElement | null);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  protected render(): Node {
    return (
      <div class="command" part="command">
        <div class="search" part="search">
          <span class="icon" aria-hidden="true" html={Icons.get('search')} />
          <input type="text" part="input" role="combobox" aria-expanded="true" aria-controls="list"
                 aria-autocomplete="list" autocomplete="off" spellcheck={false}
                 aria-label={this.getProp('placeholder', 'Type a command or search…')}
                 placeholder={this.getProp('placeholder', 'Type a command or search…')}
                 value={this.query}
                 onInput={(e: Event) => {
                   this.filter((e.target as HTMLInputElement).value);
                   this.renderList();
                 }}
                 onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)} />
        </div>
        <div class="list" id="list" part="list" role="listbox" aria-label="Commands" />
      </div>
    );
  }

  protected afterRender(): void {
    this.renderList();
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .command {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: inherit;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 0.875rem;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0 0.875rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      input {
        flex: 1;
        height: 2.875rem;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--color-text);
        font: inherit;
      }

      input::placeholder { color: var(--color-text-secondary); }
      input:focus-visible { outline: none; box-shadow: none; }

      .list {
        position: relative; /* offsetTop of items is relative to the list (keepInView) */
        max-height: min(22rem, 60vh);
        overflow-y: auto;
        padding: 0.25rem;
      }

      .group + .group { border-top: 1px solid var(--color-border); margin-top: 0.25rem; padding-top: 0.25rem; }

      .heading {
        padding: 0.375rem 0.5rem;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        font-weight: 500;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        user-select: none;
      }

      .item.active { background: var(--color-accent); }
      .item[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
      .icon { display: inline-flex; font-size: 1rem; color: var(--color-text-secondary); }
      .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .shortcut {
        color: var(--color-text-secondary);
        font-family: inherit;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
      }

      .empty { padding: 1.5rem 0.5rem; color: var(--color-text-secondary); text-align: center; }
    `;
  }
}

define('nx-command', NXCommand);

export interface CommandPaletteOptions {
  placeholder?: string;
  emptyText?: string;
  /** Accessible name of the dialog (default "Command palette") */
  label?: string;
}

/**
 * Open the command palette in a dialog. Resolves with the chosen item (its
 * `handler` has run) or `null` when dismissed.
 */
export function command(items: CommandItem[], options: CommandPaletteOptions = {}): Promise<CommandItem | null> {
  const modal = ComponentRegistry.build({
    xtype: 'modal',
    destroyOnClose: true,
    closable: false,
    flush: true,
    size: 'md',
    label: options.label ?? 'Command palette'
  }) as NXModal;
  const list = ComponentRegistry.build({ xtype: 'command', placeholder: options.placeholder, emptyText: options.emptyText, items }) as NXCommand;
  list.addEventListener('select', e => modal.close((e as CustomEvent<{ item: CommandItem }>).detail.item));
  modal.appendChild(list);
  const result = modal.open().then(item => item ?? null);
  requestAnimationFrame(() => list.focus());
  return result;
}

/** `mod+k` = ⌘K on macOS, Ctrl+K elsewhere. */
function matches(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();
  const mac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const want = {
    meta: parts.includes('meta') || (parts.includes('mod') && mac),
    ctrl: parts.includes('ctrl') || (parts.includes('mod') && !mac),
    alt: parts.includes('alt'),
    shift: parts.includes('shift')
  };
  return e.key.toLowerCase() === key && e.metaKey === want.meta && e.ctrlKey === want.ctrl && e.altKey === want.alt && e.shiftKey === want.shift;
}

let paletteOpen = false;

/**
 * Open the palette with a keyboard shortcut. `items` may be a function, so the
 * list is built fresh each time. Returns a function that removes the shortcut.
 */
command.bind = (shortcut: string, items: CommandItem[] | (() => CommandItem[]), options: CommandPaletteOptions = {}): (() => void) => {
  const onKey = (e: KeyboardEvent) => {
    if (!matches(e, shortcut) || paletteOpen) return;
    e.preventDefault();
    paletteOpen = true;
    command(typeof items === 'function' ? items() : items, options).finally(() => (paletteOpen = false));
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
};
