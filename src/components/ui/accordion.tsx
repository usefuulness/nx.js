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

  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  /**
   * Sections are the `<nx-accordion-item>` children and their `expanded`
   * attribute is the open state — the DOM is the source of truth, so
   * server-rendered HTML (SSR/SSG, template engines) hydrates as-is.
   */
  private sections(): Array<{ id: string; el: HTMLElement; title: string; disabled: boolean; expanded: boolean }> {
    return (Array.from(this.children).filter(el => el.tagName === 'NX-ACCORDION-ITEM') as HTMLElement[]).map(el => {
      // title → label: keeps the text in the markup without a native tooltip over the section
      if (el.hasAttribute('title')) {
        el.setAttribute('label', el.getAttribute('title')!);
        el.removeAttribute('title');
      }
      const id = el.slot.startsWith('item-') ? el.slot.slice(5) : el.id || `a${++seq}`;
      if (el.slot !== `item-${id}`) el.slot = `item-${id}`;
      const flag = (name: string) => el.hasAttribute(name) && el.getAttribute(name) !== 'false';
      return { id, el, title: el.getAttribute('label') ?? '', disabled: flag('disabled'), expanded: flag('expanded') };
    });
  }

  /** Replace the sections from data. `content` is trusted HTML. */
  setItems(items: AccordionItem[]): void {
    this.sections().forEach(section => section.el.remove());
    items.forEach(item => {
      const el = document.createElement('nx-accordion-item');
      el.setAttribute('label', item.title);
      if (item.id) el.id = item.id;
      if (item.expanded) el.setAttribute('expanded', '');
      if (item.disabled) el.setAttribute('disabled', '');
      if (item.content) el.innerHTML = item.content;
      this.appendChild(el);
    });
    this.scheduleUpdate();
  }

  protected afterConnect(): void {
    this.observer ??= new MutationObserver(() => this.scheduleUpdate());
    this.observer.observe(this, { childList: true, subtree: true, attributeFilter: ['expanded', 'label', 'title', 'disabled'] });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
  }

  private setExpanded(id: string, expanded: boolean): void {
    this.sections().find(s => s.id === id)?.el.toggleAttribute('expanded', expanded);
    this.scheduleUpdate();
  }

  private toggleItem(id: string): void {
    const section = this.sections().find(s => s.id === id);
    if (!section) return;
    const open = section.expanded;
    if (open && !this.getProp('collapsible', true)) return;
    if (!open && !this.getProp('multiple', false)) this.sections().forEach(s => s.el.removeAttribute('expanded'));
    this.setExpanded(id, !open);
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
        {this.sections().map(item => {
          const id = item.id;
          const open = item.expanded;
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
    if (!this.getProp('multiple', false)) this.sections().forEach(s => s.el.removeAttribute('expanded'));
    this.setExpanded(itemId, true);
  }

  collapse(itemId: string): void {
    this.setExpanded(itemId, false);
  }

  expandAll(): void {
    this.sections().forEach(s => s.el.setAttribute('expanded', ''));
    this.scheduleUpdate();
  }

  collapseAll(): void {
    this.sections().forEach(s => s.el.removeAttribute('expanded'));
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
