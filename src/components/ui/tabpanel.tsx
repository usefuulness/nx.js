/**
 * @file @/components/ui/tabpanel.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent, ComponentState } from '@/components/abstracts/base';
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

  private observer: MutationObserver | null = null;

  protected initialize(): void {
    this.adoptTabElements();
    super.initialize();
  }

  protected afterConnect(): void {
    // <nx-tab> children added later (JSX, HTML, appendChild) become tabs too
    this.observer ??= new MutationObserver(() => this.adoptTabElements());
    this.observer.observe(this, { childList: true });
  }

  protected beforeDisconnect(): void {
    this.observer?.disconnect();
  }

  /** Turn `<nx-tab title="…">content</nx-tab>` children into tabs. */
  private adoptTabElements(): void {
    const fresh = Array.from(this.children).filter(el => el.tagName === 'NX-TAB' && !el.slot) as HTMLElement[];
    if (!fresh.length) return;
    const tabs = [...this.getState<TabConfig[]>('tabs', [])];
    fresh.forEach(el => {
      const title = el.getAttribute('title') ?? el.getAttribute('label') ?? '';
      el.removeAttribute('title'); // no native tooltip over the whole tab body
      const tab: TabConfig = {
        id: el.id || `t${++tabSeq}`,
        title,
        icon: el.getAttribute('icon') ?? undefined,
        closable: el.hasAttribute('closable') && el.getAttribute('closable') !== 'false',
        disabled: el.hasAttribute('disabled') && el.getAttribute('disabled') !== 'false'
      };
      el.slot = `tab-${tab.id}`;
      tabs.push(tab);
    });
    this.setState('tabs', tabs);
    if (fresh.some(el => el.hasAttribute('active'))) {
      this.setState('activeTab', tabs.findIndex(t => t.id && this.querySelector(`:scope > [slot="tab-${t.id}"][active]`)));
    }
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

  protected render(): Node {
    const tabs = this.getState<TabConfig[]>('tabs', []);
    const activeTab = this.getState('activeTab', 0);
    const position = this.getProp<string>('position', 'top');
    const vertical = position === 'left' || position === 'right';

    const tabList = (
      <div class="nx-tabs" part="tabs" role="tablist" aria-orientation={vertical ? 'vertical' : 'horizontal'}
           onKeyDown={(e: KeyboardEvent) => this.onTabKeyDown(e)}>
        {tabs.map((tab, index) => {
          const active = index === activeTab;
          // The close button is a sibling of the tab, not a child: interactive
          // controls must not be nested (screen readers can't reach them)
          return (
            <div class={['nx-tab-item', { active, disabled: tab.disabled, closable: tab.closable }]} role="presentation">
              <div class={['nx-tab', { active, disabled: tab.disabled }]} part={active ? 'tab tab-active' : 'tab'}
                   role="tab" id={`tab-${tab.id}`} data-index={index} aria-selected={String(active)}
                   aria-controls={`panel-${tab.id}`} aria-disabled={String(!!tab.disabled)} tabindex={active ? 0 : -1}
                   aria-description={tab.closable ? 'Press Delete to close' : undefined}
                   onClick={() => this.selectTab(index)}>
                {tab.icon && <span class="nx-tab-icon" html={Icons.get(tab.icon)} />}
                <span class="nx-tab-title">{tab.title}</span>
              </div>
              {tab.closable && (
                // Mouse affordance only: a tablist may contain only tabs, and keyboard/screen-reader
                // users close the focused tab with Delete (announced via aria-description)
                <button class="nx-tab-close" tabindex={-1} aria-hidden="true" html={Icons.get('close')}
                        onClick={() => this.closeTab(index)} />
              )}
            </div>
          );
        })}
        <slot name="tabs-end" />
      </div>
    );

    return (
      <div part="container" class={['nx-tabpanel', `position-${position}`, `variant-${this.getProp('variant', 'default')}`]}>
        {tabList}
        <div class="nx-panels" part="panels">
          {tabs.map((tab, index) => (
            <div class={['nx-tab-panel', { active: index === activeTab }]} part="panel" role="tabpanel"
                 id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={index !== activeTab}>
              {tab.content && <div html={tab.content} />}
              <slot name={`tab-${tab.id}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  private onTabKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('nx-tab')) return;
    const index = Number(target.dataset.index);

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.selectTab(index);
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      this.closeTab(index);
      return;
    }

    const enabled = Array.from(this.$$('.nx-tab:not(.disabled)')) as HTMLElement[];
    const current = enabled.indexOf(target);
    const next = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: enabled.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const to = Number(enabled[(next + enabled.length) % enabled.length].dataset.index);
    this.selectTab(to);
    requestAnimationFrame(() => (this.$(`.nx-tab[data-index="${to}"]`) as HTMLElement | null)?.focus());
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
      .nx-tab-item {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .nx-tab-item.closable .nx-tab { padding-right: 0.25rem; }
      .nx-tab-item.closable .nx-tab-close { margin-right: 0.5rem; }

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
      .variant-default .nx-tab-item::after,
      .variant-underlined .nx-tab-item::after {
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

      .variant-default .nx-tab-item.active::after,
      .variant-underlined .nx-tab-item.active::after {
        background: var(--color-primary);
      }

      .position-left .nx-tab-item::after,
      .position-right .nx-tab-item::after { display: none; }

      .position-left .nx-tab-item,
      .position-right .nx-tab-item { display: flex; }

      .position-left .nx-tab-item .nx-tab,
      .position-right .nx-tab-item .nx-tab { flex: 1; }

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
        padding: 0;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
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

/**
 * A tab inside `<nx-tabpanel>`: `<nx-tab title="Account" icon="user" closable>…</nx-tab>`.
 */
export class NXTab extends HTMLElement {
  connectedCallback(): void {
    this.style.display = this.style.display || 'block';
  }
}

define('nx-tabpanel', NXTabPanel);
define('nx-tab', NXTab);
