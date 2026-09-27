/**
 * @file @/components/ui/tabpanel.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent, ComponentState, escapeHTML } from '@/components/abstracts/base';
import { ComponentRegistry, define, type ComponentConfig, type ItemConfig, type ItemsAware } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface TabConfig {
  id?: string;
  title: string;
  icon?: string;
  closable?: boolean;
  disabled?: boolean;
  /** Static HTML content for the tab */
  content?: string;
}

export interface TabPanelConfig {
  items?: Array<ComponentConfig & { title: string }>;
  activeTab?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'pills' | 'underlined';
}

const TAB_KEYS = ['id', 'title', 'icon', 'closable', 'disabled', 'content'] as const;
let tabSeq = 0;

/**
 * Tabs. Each item is a tab: `title`/`icon`/`closable`/`disabled` configure the tab
 * button, everything else (`xtype`, `items`, `html`) is the tab's content.
 *
 * @example
 * ```typescript
 * {
 *   xtype: 'tabpanel',
 *   items: [
 *     { title: 'Overview', icon: 'dashboard', html: '<p>Hello</p>' },
 *     { title: 'Users', xtype: 'grid', store: 'users', columns: [...] },
 *     { title: 'Settings', items: [{ xtype: 'textfield', label: 'Name' }] }
 *   ]
 * }
 * ```
 */
export class NXTabPanel extends BaseComponent implements ItemsAware {
  static get observedAttributes(): string[] {
    return ['active-tab', 'position', 'variant'];
  }

  protected initializeState(): void {
    this[ComponentState].set('tabs', []);
    this[ComponentState].set('activeTab', 0);
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  applyItems(items: ItemConfig[]): void {
    items.forEach(item => {
      if (item && typeof item === 'object' && !(item instanceof Node)) {
        this.addTab(item as ComponentConfig & TabConfig, false);
      }
    });
  }

  /** Replace all tabs (static tab definitions, no child components). */
  setTabs(tabs: TabConfig[]): void {
    Array.from(this.children).forEach(child => child.slot.startsWith('tab-') && child.remove());
    this.setState('tabs', tabs.map(tab => ({ ...tab, id: tab.id ?? `t${++tabSeq}` })));
  }

  /**
   * Add a tab. Accepts the same shape as an item: tab keys plus any component config for its body.
   */
  addTab(config: ComponentConfig & TabConfig, activate = true): void {
    const tab: TabConfig = { title: config.title, id: config.id ?? `t${++tabSeq}` };
    const body: ComponentConfig = {};
    Object.entries(config).forEach(([key, value]) => {
      if ((TAB_KEYS as readonly string[]).includes(key)) (tab as any)[key] = value;
      else body[key] = value;
    });
    tab.id ??= `t${++tabSeq}`;

    if (Object.keys(body).length) {
      const element = ComponentRegistry.build(body.xtype ? body : { xtype: 'container', ...body });
      if (element) {
        element.slot = `tab-${tab.id}`;
        this.appendChild(element);
      }
    }

    const tabs = [...this.getState<TabConfig[]>('tabs', []), tab];
    this.setState('tabs', tabs);
    if (activate) this.setState('activeTab', tabs.length - 1);
  }

  protected render(): string {
    const tabs = this.getState<TabConfig[]>('tabs', []);
    const activeTab = this.getState('activeTab', 0);
    const position = this.getProp<string>('position', 'top');
    const variant = this.getProp('variant', 'default');

    const tabsHtml = `
      <div class="nx-tabs" part="tabs" role="tablist" aria-orientation="${position === 'left' || position === 'right' ? 'vertical' : 'horizontal'}">
        ${tabs.map((tab, index) => `
          <div class="nx-tab ${index === activeTab ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}"
               part="tab${index === activeTab ? ' tab-active' : ''}"
               role="tab"
               id="tab-${tab.id}"
               data-index="${index}"
               aria-selected="${index === activeTab}"
               aria-controls="panel-${tab.id}"
               aria-disabled="${!!tab.disabled}"
               tabindex="${index === activeTab ? 0 : -1}">
            ${tab.icon ? `<span class="nx-tab-icon">${Icons.get(tab.icon)}</span>` : ''}
            <span class="nx-tab-title">${escapeHTML(tab.title)}</span>
            ${tab.closable ? `
              <button class="nx-tab-close" tabindex="-1" aria-label="Close ${escapeHTML(tab.title)}">
                ${Icons.get('close')}
              </button>
            ` : ''}
          </div>
        `).join('')}
        <slot name="tabs-end"></slot>
      </div>
    `;

    const panelsHtml = `
      <div class="nx-panels" part="panels">
        ${tabs.map((tab, index) => `
          <div class="nx-tab-panel ${index === activeTab ? 'active' : ''}"
               part="panel"
               role="tabpanel"
               id="panel-${tab.id}"
               aria-labelledby="tab-${tab.id}"
               ${index === activeTab ? '' : 'hidden'}>
            ${tab.content || ''}
            <slot name="tab-${tab.id}"></slot>
          </div>
        `).join('')}
      </div>
    `;

    return `
      <div class="nx-tabpanel position-${position} variant-${variant}" part="container">
        ${tabsHtml}${panelsHtml}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .nx-tabpanel {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
      }

      .position-bottom { flex-direction: column-reverse; }
      .position-left { flex-direction: row; }
      .position-right { flex-direction: row-reverse; }

      /* Tab strip */
      .nx-tabs {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0 1rem;
        border-bottom: 1px solid var(--color-border);
        overflow-x: auto;
        scrollbar-width: none;
        flex-shrink: 0;
      }

      .position-bottom .nx-tabs {
        border-bottom: none;
        border-top: 1px solid var(--color-border);
      }

      .position-left .nx-tabs,
      .position-right .nx-tabs {
        flex-direction: column;
        align-items: stretch;
        padding: 0.5rem;
        border-bottom: none;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .position-left .nx-tabs { border-right: 1px solid var(--color-border); }
      .position-right .nx-tabs { border-left: 1px solid var(--color-border); }

      /* Tab */
      .nx-tab {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        height: 2.75rem;
        padding: 0 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        border-radius: var(--radius-sm);
        transition: color var(--transition-duration), background var(--transition-duration);
      }

      .nx-tab:hover:not(.disabled) {
        color: var(--color-text);
      }

      .nx-tab.active {
        color: var(--color-text);
      }

      .nx-tab.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* default: underline indicator */
      .variant-default .nx-tab::after,
      .variant-underlined .nx-tab::after {
        content: '';
        position: absolute;
        left: 0.5rem;
        right: 0.5rem;
        bottom: -1px;
        height: 2px;
        border-radius: 2px;
        background: transparent;
        transition: background var(--transition-duration);
      }

      .variant-default .nx-tab.active::after,
      .variant-underlined .nx-tab.active::after {
        background: var(--color-primary);
      }

      .position-left .nx-tab::after,
      .position-right .nx-tab::after { display: none; }

      .position-left .nx-tab.active,
      .position-right .nx-tab.active {
        background: var(--color-accent);
      }

      /* pills */
      .variant-pills .nx-tabs {
        border-bottom: none;
        padding: 0.75rem 1rem 0;
      }

      .variant-pills .nx-tab {
        height: 2rem;
        border-radius: 9999px;
      }

      .variant-pills .nx-tab.active {
        background: var(--color-primary);
        color: var(--color-primary-foreground);
      }

      .nx-tab-icon {
        display: inline-flex;
        font-size: 1rem;
      }

      .nx-tab-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        margin-right: -0.25rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font-size: 0.875rem;
        opacity: 0.6;
        cursor: pointer;
      }

      .nx-tab-close:hover {
        opacity: 1;
        background: var(--color-accent);
      }

      /* Panels */
      .nx-panels {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow: auto;
      }

      .nx-tab-panel {
        height: 100%;
        padding: 1.25rem;
        animation: nx-tab-in 180ms var(--transition-easing);
      }

      .nx-tab-panel[hidden] {
        display: none;
      }

      @keyframes nx-tab-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: none; }
      }
    `;
  }

  protected afterRender(): void {
    this.on(this.shadow!, 'click', (e: Event) => {
      const target = e.target as Element;
      const close = target.closest('.nx-tab-close');
      const tab = target.closest('.nx-tab') as HTMLElement | null;
      if (!tab) return;
      const index = parseInt(tab.dataset.index || '0');
      if (close) {
        e.stopPropagation();
        this.closeTab(index);
      } else {
        this.selectTab(index);
      }
    });

    this.on(this.shadow!, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      const target = keyEvent.target as HTMLElement;
      if (!target.classList.contains('nx-tab')) return;

      const tabs = Array.from(this.$$('.nx-tab:not(.disabled)')) as HTMLElement[];
      const current = tabs.indexOf(target);
      let next = -1;

      switch (keyEvent.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (current + 1) % tabs.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (current - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = tabs.length - 1;
          break;
        case 'Enter':
        case ' ':
          keyEvent.preventDefault();
          this.selectTab(parseInt(target.dataset.index || '0'));
          return;
        case 'Delete':
          keyEvent.preventDefault();
          this.closeTab(parseInt(target.dataset.index || '0'));
          return;
        default:
          return;
      }

      keyEvent.preventDefault();
      const index = parseInt(tabs[next].dataset.index || '0');
      this.selectTab(index);
      requestAnimationFrame(() => (this.$(`.nx-tab[data-index="${index}"]`) as HTMLElement)?.focus());
    });
  }

  getActiveTab(): number {
    return this.getState('activeTab', 0);
  }

  selectTab(index: number): void {
    const tabs = this.getState<TabConfig[]>('tabs', []);
    if (index >= 0 && index < tabs.length && !tabs[index].disabled && index !== this.getActiveTab()) {
      this.setState('activeTab', index);
      this.emit('tab-change', { index, tab: tabs[index] });
    }
  }

  closeTab(index: number): void {
    const tabs = [...this.getState<TabConfig[]>('tabs', [])];
    const activeTab = this.getState('activeTab', 0);
    const tab = tabs[index];

    if (!tab?.closable) return;

    this.emit('tab-close', { index, tab });
    this.querySelectorAll(`:scope > [slot="tab-${tab.id}"]`).forEach(el => el.remove());
    tabs.splice(index, 1);

    this.updateState({
      tabs,
      activeTab: activeTab > index || activeTab >= tabs.length ? Math.max(0, activeTab - 1) : activeTab
    });
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'active-tab' && newValue !== null) {
      this[ComponentState].set('activeTab', parseInt(newValue) || 0);
    }
  }
}

define('nx-tabpanel', NXTabPanel);
