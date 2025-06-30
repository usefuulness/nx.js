import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface TabConfig {
  id?: string;
  title: string;
  icon?: string;
  closable?: boolean;
  disabled?: boolean;
  content?: string;
}

export interface TabPanelConfig {
  tabs?: TabConfig[];
  activeTab?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'pills' | 'underlined';
}

export class NXTabPanel extends BaseComponent {
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

  setTabs(tabs: TabConfig[]): void {
    this.setState('tabs', tabs);
  }

  protected render(): string {
    const tabs = this.getState<TabConfig[]>('tabs', []);
    const activeTab = this.getState('activeTab', 0);
    const position = this.getProp<string>('position', 'top');
    const variant = this.getProp('variant', 'default');

    const containerClasses = [
      'nx-tabpanel',
      `position-${position}`,
      `variant-${variant}`
    ].join(' ');

    const tabsHtml = `
      <div class="nx-tabs" part="tabs" role="tablist">
        ${tabs.map((tab, index) => `
          <button class="nx-tab ${index === activeTab ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}"
                  part="tab"
                  role="tab"
                  data-index="${index}"
                  aria-selected="${index === activeTab}"
                  ${tab.disabled ? 'disabled' : ''}
                  tabindex="${index === activeTab ? 0 : -1}">
            ${tab.icon ? `<span class="nx-tab-icon">${tab.icon}</span>` : ''}
            <span class="nx-tab-title">${tab.title}</span>
            ${tab.closable ? `
              <button class="nx-tab-close" aria-label="Close tab">
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            ` : ''}
          </button>
        `).join('')}
      </div>
    `;

    const panelsHtml = `
      <div class="nx-panels" part="panels">
        ${tabs.map((tab, index) => `
          <div class="nx-panel ${index === activeTab ? 'active' : ''}"
               part="panel"
               role="tabpanel"
               aria-hidden="${index !== activeTab}">
            ${tab.content || ''}
            <slot name="tab-${index}"></slot>
          </div>
        `).join('')}
      </div>
    `;

    return `
      <div class="${containerClasses}" part="container">
        ${position === 'bottom' || position === 'right' ? panelsHtml + tabsHtml : tabsHtml + panelsHtml}
      </div>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-tabpanel {
        display: flex;
        height: 100%;
      }

      /* Positions */
      .position-top,
      .position-bottom {
        flex-direction: column;
      }

      .position-left,
      .position-right {
        flex-direction: row;
      }

      .position-bottom {
        flex-direction: column-reverse;
      }

      .position-right {
        flex-direction: row-reverse;
      }

      /* Tabs container */
      .nx-tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.25rem;
        background: var(--surface-color);
        border-bottom: 1px solid var(--border-color);
        overflow-x: auto;
        scrollbar-width: thin;
      }

      .position-bottom .nx-tabs {
        border-bottom: none;
        border-top: 1px solid var(--border-color);
      }

      .position-left .nx-tabs,
      .position-right .nx-tabs {
        flex-direction: column;
        border-bottom: none;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .position-left .nx-tabs {
        border-right: 1px solid var(--border-color);
      }

      .position-right .nx-tabs {
        border-left: 1px solid var(--border-color);
      }

      /* Tab button */
      .nx-tab {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-color-secondary);
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
        position: relative;
      }

      .nx-tab:hover:not(:disabled) {
        color: var(--text-color);
        background: var(--hover-bg);
      }

      .nx-tab:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-tab.active {
        color: var(--color-primary);
      }

      /* Variants */
      .variant-default .nx-tab.active {
        background: var(--bg-color);
        border-radius: 0.25rem 0.25rem 0 0;
      }

      .variant-pills .nx-tab {
        border-radius: 9999px;
      }

      .variant-pills .nx-tab.active {
        background: var(--color-primary);
        color: white;
      }

      .variant-underlined .nx-tab.active::after {
        content: '';
        position: absolute;
        bottom: -0.25rem;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--color-primary);
      }

      /* Tab content */
      .nx-tab-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      .nx-tab-close {
        width: 1rem;
        height: 1rem;
        padding: 0.125rem;
        margin-left: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 0.125rem;
        color: inherit;
        opacity: 0.7;
        transition: all 0.2s;
      }

      .nx-tab-close:hover {
        opacity: 1;
        background: var(--hover-bg);
      }

      .nx-tab-close svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      /* Panels */
      .nx-panels {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .nx-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 1rem;
        overflow: auto;
        opacity: 0;
        visibility: hidden;
        transform: translateX(1rem);
        transition: all 0.3s;
      }

      .nx-panel.active {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
      }
    `;
  }

  protected afterRender(): void {
    // Tab clicks
    this.$$('.nx-tab:not(:disabled)').forEach((tab, index) => {
      this.on(tab, 'click', (e: Event) => {
        if (!(e.target as Element).closest('.nx-tab-close')) {
          this.selectTab(index);
        }
      });
    });

    // Close buttons
    this.$$('.nx-tab-close').forEach((closeBtn, index) => {
      this.on(closeBtn, 'click', (e: Event) => {
        e.stopPropagation();
        this.closeTab(index);
      });
    });

    // Keyboard navigation
    this.on(this.shadow!, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('nx-tab')) {
        const index = parseInt(target.dataset.index || '0');
        
        switch (keyEvent.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            this.focusNextTab(index);
            break;
            
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            this.focusPreviousTab(index);
            break;
            
          case 'Home':
            e.preventDefault();
            this.focusFirstTab();
            break;
            
          case 'End':
            e.preventDefault();
            this.focusLastTab();
            break;
        }
      }
    });
  }

  private focusNextTab(currentIndex: number): void {
    const tabs = this.$$('.nx-tab:not(:disabled)');
    const nextIndex = (currentIndex + 1) % tabs.length;
    (tabs[nextIndex] as HTMLElement).focus();
  }

  private focusPreviousTab(currentIndex: number): void {
    const tabs = this.$$('.nx-tab:not(:disabled)');
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    (tabs[prevIndex] as HTMLElement).focus();
  }

  private focusFirstTab(): void {
    const firstTab = this.$('.nx-tab:not(:disabled)') as HTMLElement;
    firstTab?.focus();
  }

  private focusLastTab(): void {
    const tabs = this.$$('.nx-tab:not(:disabled)');
    const lastTab = tabs[tabs.length - 1] as HTMLElement;
    lastTab?.focus();
  }

  selectTab(index: number): void {
    const tabs = this.getState<TabConfig[]>('tabs', []);
    if (index >= 0 && index < tabs.length && !tabs[index].disabled) {
      this.setState('activeTab', index);
      this.emit('tab-change', { index, tab: tabs[index] });
    }
  }

  closeTab(index: number): void {
    const tabs = [...this.getState<TabConfig[]>('tabs', [])];
    const activeTab = this.getState('activeTab', 0);
    
    if (tabs[index]?.closable) {
      this.emit('tab-close', { index, tab: tabs[index] });
      
      tabs.splice(index, 1);
      this.setState('tabs', tabs);
      
      // Adjust active tab if needed
      if (activeTab >= tabs.length) {
        this.setState('activeTab', Math.max(0, tabs.length - 1));
      } else if (activeTab > index) {
        this.setState('activeTab', activeTab - 1);
      }
    }
  }

  addTab(tab: TabConfig, activate = true): void {
    const tabs = [...this.getState<TabConfig[]>('tabs', [])];
    tabs.push(tab);
    this.setState('tabs', tabs);
    
    if (activate) {
      this.setState('activeTab', tabs.length - 1);
    }
  }

  protected onAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'active-tab' && newValue !== null) {
      this.selectTab(parseInt(newValue));
    }
  }
}

customElements.define('nx-tabpanel', NXTabPanel);
