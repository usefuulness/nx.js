/**
 * @file @/components/ui/menubar.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { showMenu, type MenuItem, type NXMenuPopup } from '@/components/ui/menu';

export interface MenuBarConfig {
  /** Top-level entries; each has `items` (alias `submenu`) for its dropdown */
  items?: MenuItem[];
}

/**
 * Application menu bar (File / Edit / View …). Once a menu is open, hovering
 * or arrowing to a neighbour switches menus, like a desktop app.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'menubar',
 *   items: [
 *     { text: 'File', items: [{ text: 'New', shortcut: '⌘N', handler: create }, '-', { text: 'Quit' }] },
 *     { text: 'Edit', items: [{ text: 'Undo', shortcut: '⌘Z' }] }
 *   ]
 * }
 * ```
 */
export class NXMenuBar extends BaseComponent {
  private items: MenuItem[] = [];
  private popup: NXMenuPopup | null = null;
  private openIndex = -1;

  protected initializeState(): void {}

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    this.scheduleUpdate();
  }

  protected render(): Node {
    return (
      <nav class="bar" part="container" role="menubar" onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}>
        {this.items.map((item, i) => (
          <button class="entry" part="item" role="menuitem" data-index={i} aria-haspopup="menu" aria-expanded="false"
                  tabindex={i === 0 ? 0 : -1} disabled={!!item.disabled}
                  onClick={() => (this.openIndex === i ? this.closeMenu() : this.openAt(i))}
                  // Switch menus on hover while one is open, like a desktop menu bar
                  onPointerEnter={() => this.openIndex >= 0 && this.openIndex !== i && this.openAt(i)}>
            {item.icon && <span class="icon" html={Icons.get(item.icon)} />}
            {item.text ?? ''}
          </button>
        ))}
      </nav>
    );
  }

  private entries(): HTMLButtonElement[] {
    return Array.from(this.$$('.entry')) as HTMLButtonElement[];
  }

  private openAt(index: number, focusFirst = false): void {
    const entries = this.entries();
    const entry = entries[index];
    const item = this.items[index];
    if (!entry || !item) return;

    this.closeMenu();
    this.openIndex = index;
    entry.classList.add('active');
    entry.setAttribute('aria-expanded', 'true');
    entry.focus();

    this.popup = showMenu(item.items ?? item.submenu ?? [], entry, {
      returnFocus: entry,
      focusFirst,
      onSelect: selected => this.emit('select', { item: selected, menu: item }),
      onClose: () => {
        entry.classList.remove('active');
        entry.setAttribute('aria-expanded', 'false');
        if (this.openIndex === index) {
          this.openIndex = -1;
          this.popup = null;
        }
      }
    });
  }

  private closeMenu(): void {
    const popup = this.popup;
    this.popup = null;
    this.openIndex = -1;
    popup?.close();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const entries = this.entries();
    const current = entries.indexOf(this.shadow!.activeElement as HTMLButtonElement);
    if (current < 0) return;
    const move = (to: number) => {
      const next = (to + entries.length) % entries.length;
      entries.forEach((el, i) => (el.tabIndex = i === next ? 0 : -1));
      if (this.openIndex >= 0) this.openAt(next);
      else entries[next].focus();
    };
    switch (e.key) {
      case 'ArrowRight': move(current + 1); break;
      case 'ArrowLeft': move(current - 1); break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        this.openAt(current, true);
        break;
      default: return;
    }
    e.preventDefault();
  }

  protected cleanup(): void {
    this.closeMenu();
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .bar {
        display: flex;
        align-items: center;
        gap: 0.125rem;
        padding: 0.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }

      .entry {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        height: 2rem;
        padding: 0 0.75rem;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: default;
      }

      .entry:hover,
      .entry:focus-visible,
      .entry.active {
        background: var(--color-accent);
        outline: none;
      }

      .entry:disabled { opacity: 0.5; }
      .icon { display: inline-flex; font-size: 1rem; }
    `;
  }
}

define('nx-menubar', NXMenuBar);
