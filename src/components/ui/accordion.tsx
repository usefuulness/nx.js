/**
 * @file @/components/ui/accordion.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface AccordionItem {
  id?: string;
  title: string;
  /** Static HTML content (for JSX/HTML, use `<AccordionItem>` children instead) */
  content?: string;
  expanded?: boolean;
  disabled?: boolean;
}

export interface AccordionConfig {
  items?: AccordionItem[];
  /** Allow several sections open at once */
  multiple?: boolean;
  /** Allow closing the open section (default true) */
  collapsible?: boolean;
}

let seq = 0;

/**
 * Collapsible sections.
 *
 * ```tsx
 * <Accordion>
 *   <AccordionItem title="Is it accessible?" expanded>Yes. It follows the WAI-ARIA pattern.</AccordionItem>
 *   <AccordionItem title="Is it styled?">Yes, with your theme's tokens.</AccordionItem>
 * </Accordion>
 * ```
 * or `items={[{ title, content, expanded }]}`. Event: `toggle` (detail `{ itemId, expanded }`).
 */
export class NXAccordion extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['multiple', 'collapsible'];
  }

  private items: Array<AccordionItem & { id: string }> = [];
  private expanded = new Set<string>();
  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  setItems(items: AccordionItem[]): void {
    // Sections that come from <nx-accordion-item> children stay; data items are replaced
    const fromData = items.map(item => ({ ...item, id: item.id ?? `a${++seq}` }));
    this.items = [...this.items.filter(item => this.slotFor(item.id)), ...fromData];
    fromData.forEach(item => item.expanded && this.expanded.add(item.id));
    this.scheduleUpdate();
  }

  private slotFor(id: string): Element | null {
    return this.querySelector(`:scope > [slot="item-${id}"]`);
  }

  protected initialize(): void {
    this.adoptItemElements();
    super.initialize();
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => this.adoptItemElements());
    this.observer.observe(this, { childList: true });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
  }

  /** `<nx-accordion-item title="…">content</nx-accordion-item>` children become sections. */
  private adoptItemElements(): void {
    const fresh = Array.from(this.children).filter(el => el.tagName === 'NX-ACCORDION-ITEM' && !el.slot) as HTMLElement[];
    if (!fresh.length) return;
    fresh.forEach(el => {
      const id = el.id || `a${++seq}`;
      const item: AccordionItem = {
        id,
        title: el.getAttribute('title') ?? '',
        disabled: el.hasAttribute('disabled') && el.getAttribute('disabled') !== 'false'
      };
      el.removeAttribute('title'); // no native tooltip over the whole section
      el.slot = `item-${id}`;
      if (el.hasAttribute('expanded') && el.getAttribute('expanded') !== 'false') this.expanded.add(id);
      this.items.push({ ...item, id });
    });
    this.scheduleUpdate();
  }

  private toggleItem(id: string): void {
    const open = this.expanded.has(id);
    if (open && !this.getProp('collapsible', true)) return;
    if (!open && !this.getProp('multiple', false)) this.expanded.clear();
    open ? this.expanded.delete(id) : this.expanded.add(id);
    this.scheduleUpdate();
    this.emit('toggle', { itemId: id, expanded: !open });
  }

  private onKeyDown(e: KeyboardEvent): void {
    const headers = Array.from(this.$$('.trigger:not(:disabled)')) as HTMLElement[];
    const index = headers.indexOf(e.target as HTMLElement);
    if (index < 0) return;
    const to = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: headers.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    headers[(to + headers.length) % headers.length].focus();
  }

  protected render(): Node {
    return (
      <div class="accordion" part="container" onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}>
        {this.items.map(item => {
          const id = item.id;
          const open = this.expanded.has(id);
          return (
            <div class={['item', { open, disabled: item.disabled }]} part="item">
              <h3 class="heading">
                <button class="trigger" part="header" id={`h-${id}`} aria-expanded={String(open)} aria-controls={`c-${id}`}
                        disabled={!!item.disabled} onClick={() => this.toggleItem(id)}>
                  <span class="title">{item.title}</span>
                  <span class="chevron" html={Icons.get('chevron-down')} />
                </button>
              </h3>
              <div class="panel" part="content" id={`c-${id}`} role="region" aria-labelledby={`h-${id}`} hidden={!open}>
                <div class="body" part="body">
                  {item.content && <div html={item.content} />}
                  <slot name={`item-${id}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; }

      .item { border-bottom: 1px solid var(--color-border); }
      .item.disabled { opacity: 0.5; }

      .heading { margin: 0; font: inherit; }

      .trigger {
        display: flex;
        align-items: center;
        gap: 1rem;
        width: 100%;
        padding: 1rem 0;
        border: none;
        background: transparent;
        font-size: 0.875rem;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
      }

      .trigger:hover:not(:disabled) .title { text-decoration: underline; text-underline-offset: 4px; }
      .trigger:disabled { cursor: not-allowed; }
      .trigger:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

      .title { flex: 1; }

      .chevron {
        display: inline-flex;
        color: var(--color-text-secondary);
        transition: transform 200ms var(--transition-easing);
      }

      .open .chevron { transform: rotate(180deg); }

      .panel[hidden] { display: none; }
      .open .panel { animation: open 200ms var(--transition-easing); }
      @keyframes open { from { opacity: 0; transform: translateY(-4px); } }

      .body {
        padding-bottom: 1rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }
    `;
  }

  expand(itemId: string): void {
    if (!this.getProp('multiple', false)) this.expanded.clear();
    this.expanded.add(itemId);
    this.scheduleUpdate();
  }

  collapse(itemId: string): void {
    this.expanded.delete(itemId);
    this.scheduleUpdate();
  }

  expandAll(): void {
    this.items.forEach(item => this.expanded.add(item.id));
    this.scheduleUpdate();
  }

  collapseAll(): void {
    this.expanded.clear();
    this.scheduleUpdate();
  }
}

/** A section inside `<nx-accordion>`: `<nx-accordion-item title="…" expanded>…</nx-accordion-item>` */
export class NXAccordionItem extends HTMLElement {
  connectedCallback(): void {
    this.style.display = this.style.display || 'block';
  }
}

define('nx-accordion', NXAccordion);
define('nx-accordion-item', NXAccordionItem);
