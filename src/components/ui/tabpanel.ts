// src/components/ui/tabpanel.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { ComponentRegistry } from '@/core/registry';

export interface TabConfig {
  id?: string;
  title: string;
  icon?: string;
  closable?: boolean;
  disabled?: boolean;
  lazy?: boolean;
  component?: string | HTMLElement;
  content?: string;
  badge?: string | number;
  tooltip?: string;
}

export interface TabPanelConfig {
  tabs?: TabConfig[];
  activeTab?: number | string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'pills' | 'underline' | 'enclosed';
  scrollable?: boolean;
  addable?: boolean;
  closable?: boolean;
  reorderable?: boolean;
  onTabChange?: (tab: TabConfig, index: number) => void;
  onTabClose?: (tab: TabConfig, index: number) => boolean;
  onTabAdd?: () => TabConfig | null;
}

/**
 * Tab panel component for organizing content into tabs
 */
export class NXTabPanel extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['position', 'variant', 'scrollable', 'addable', 'closable', 'reorderable'];
  }

  private tabs: TabConfig[] = [];
  private tabElements: Map<string, HTMLElement> = new Map();

  protected initializeState(): void {
    this[ComponentState].set('activeIndex', 0);
    this[ComponentState].set('draggedTab', null);
    this[ComponentState].set('dropIndex', null);
  }

  constructor(config?: TabPanelConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure the tab panel
   */
  configure(config: TabPanelConfig): void {
    if (config.tabs) {
      this.setTabs(config.tabs);
    }
    
    // Set attributes
    Object.entries(config).forEach(([key, value]) => {
      if (['position', 'variant', 'scrollable', 'addable', 'closable', 'reorderable'].includes(key)) {
        this.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), String(value));
      }
    });
    
    // Set callbacks
    if (config.onTabChange) {
      this.addEventListener('tabchange', (e: any) => config.onTabChange!(e.detail.tab, e.detail.index));
    }
    if (config.onTabClose) {
      this[ComponentState].set('onTabClose', config.onTabClose);
    }
    if (config.onTabAdd) {
      this[ComponentState].set('onTabAdd', config.onTabAdd);
    }
    
    // Set active tab
    if (config.activeTab !== undefined) {
      this.setActiveTab(config.activeTab);
    }
  }

  /**
   * Set tabs
   */
  setTabs(tabs: TabConfig[]): void {
    this.tabs = tabs.map((tab, index) => ({
      ...tab,
      id: tab.id || `tab-${index}`
    }));
    this.update();
  }

  /**
   * Add a tab
   */
  addTab(tab: TabConfig, index?: number): void {
    const newTab = {
      ...tab,
      id: tab.id || `tab-${this.tabs.length}`
    };
    
    if (index !== undefined && index >= 0 && index <= this.tabs.length) {
      this.tabs.splice(index, 0, newTab);
    } else {
      this.tabs.push(newTab);
    }
    
    this.update();
    
    // Activate the new tab
    this.setActiveTab(newTab.id!);
    
    this.dispatchEvent(new CustomEvent('tabadd', {
      detail: { tab: newTab, index: index ?? this.tabs.length - 1 }
    }));
  }

  /**
   * Remove a tab
   */
  removeTab(tabId: string): void {
    const index = this.tabs.findIndex(tab => tab.id === tabId);
    if (index === -1) return;
    
    const tab = this.tabs[index];
    const onTabClose = this.getState('onTabClose');
    
    if (onTabClose && !onTabClose(tab, index)) {
      return;
    }
    
    this.tabs.splice(index, 1);
    
    // Adjust active index if needed
    const activeIndex = this.getState('activeIndex', 0);
    if (activeIndex >= this.tabs.length && this.tabs.length > 0) {
      this.setState('activeIndex', this.tabs.length - 1);
    }
    
    this.update();
    
    this.dispatchEvent(new CustomEvent('tabclose', {
      detail: { tab, index }
    }));
  }

  protected render(): string {
    const position = this.getProp('position', 'top');
    const variant = this.getProp('variant', 'default');
    const scrollable = this.getProp('scrollable', false);
    const activeIndex = this.getState('activeIndex', 0);

    const containerClass = `nx-tabs nx-tabs-${position} nx-tabs-${variant} ${scrollable ? 'scrollable' : ''}`;

    return `
      <div class="${containerClass}" part="container">
        ${position === 'bottom' ? this.renderPanels(activeIndex) : ''}
        <div class="nx-tabs-header" part="header" role="tablist">
          ${scrollable ? '<button class="nx-tabs-scroll nx-tabs-scroll-left" aria-label="Scroll left">‹</button>' : ''}
          <div class="nx-tabs-nav" part="nav">
            ${this.renderTabs(activeIndex)}
          </div>
          ${scrollable ? '<button class="nx-tabs-scroll nx-tabs-scroll-right" aria-label="Scroll right">›</button>' : ''}
          ${this.renderAddButton()}
        </div>
        ${position !== 'bottom' ? this.renderPanels(activeIndex) : ''}
      </div>
    `;
  }

  private renderTabs(activeIndex: number): string {
    return this.tabs.map((tab, index) => {
      const isActive = index === activeIndex;
      const closable = tab.closable ?? this.getProp('closable', false);
      const reorderable = this.getProp('reorderable', false);
      
      return `
        <button class="nx-tab ${isActive ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}"
                part="tab"
                role="tab"
                aria-selected="${isActive}"
                aria-controls="panel-${tab.id}"
                ${tab.disabled ? 'disabled' : ''}
                data-index="${index}"
                data-tab-id="${tab.id}"
                ${reorderable && !tab.disabled ? 'draggable="true"' : ''}
                ${tab.tooltip ? `title="${tab.tooltip}"` : ''}>
          ${tab.icon ? `<span class="nx-tab-icon">${this.renderIcon(tab.icon)}</span>` : ''}
          <span class="nx-tab-title">${tab.title}</span>
          ${tab.badge ? `<span class="nx-tab-badge" part="badge">${tab.badge}</span>` : ''}
          ${closable && !tab.disabled ? `
            <button class="nx-tab-close" 
                    aria-label="Close tab"
                    data-tab-id="${tab.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ` : ''}
        </button>
      `;
    }).join('');
  }

  private renderPanels(activeIndex: number): string {
    return `
      <div class="nx-tabs-panels" part="panels">
        ${this.tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          const shouldRender = isActive || !tab.lazy;
          
          return `
            <div class="nx-tab-panel ${isActive ? 'active' : ''}"
                 part="panel"
                 role="tabpanel"
                 id="panel-${tab.id}"
                 aria-labelledby="tab-${tab.id}"
                 ${!isActive ? 'hidden' : ''}>
              ${shouldRender ? this.renderPanelContent(tab) : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderPanelContent(tab: TabConfig): string {
    if (tab.content) {
      return tab.content;
    }
    
    if (tab.component) {
      return `<div class="nx-tab-component" data-tab-id="${tab.id}"></div>`;
    }
    
    return '<slot name="' + tab.id + '"></slot>';
  }

  private renderAddButton(): string {
    if (!this.getProp('addable', false)) return '';
    
    return `
      <button class="nx-tab-add" 
              part="add-button"
              aria-label="Add new tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    `;
  }

  private renderIcon(icon: string): string {
    if (icon.startsWith('<svg')) {
      return icon;
    } else if (icon.startsWith('icon-')) {
      return `<i class="${icon}"></i>`;
    } else {
      return icon;
    }
  }

  protected styles(): string {
    return `
      :host {
        --tab-height: 40px;
        --tab-padding: 0.75rem 1rem;
        --tab-gap: 0.25rem;
        --panel-padding: 1rem;
        --tab-bg: transparent;
        --tab-active-bg: var(--color-surface);
        --tab-hover-bg: var(--color-background);
        --tab-border: var(--color-border);
        --tab-active-border: var(--color-primary);
        display: block;
      }

      .nx-tabs {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      /* Position variants */
      .nx-tabs-bottom {
        flex-direction: column-reverse;
      }

      .nx-tabs-left {
        flex-direction: row;
      }

      .nx-tabs-right {
        flex-direction: row-reverse;
      }

      .nx-tabs-left .nx-tabs-header,
      .nx-tabs-right .nx-tabs-header {
        flex-direction: column;
        width: auto;
      }

      /* Header */
      .nx-tabs-header {
        display: flex;
        align-items: center;
        background: var(--color-background);
        border-bottom: 1px solid var(--tab-border);
        position: relative;
        flex-shrink: 0;
      }

      .nx-tabs-bottom .nx-tabs-header {
        border-bottom: none;
        border-top: 1px solid var(--tab-border);
      }

      .nx-tabs-left .nx-tabs-header {
        border-bottom: none;
        border-right: 1px solid var(--tab-border);
      }

      .nx-tabs-right .nx-tabs-header {
        border-bottom: none;
        border-left: 1px solid var(--tab-border);
      }

      /* Navigation */
      .nx-tabs-nav {
        display: flex;
        gap: var(--tab-gap);
        flex: 1;
        overflow: hidden;
        padding: 0 0.5rem;
      }

      .nx-tabs-scrollable .nx-tabs-nav {
        overflow-x: auto;
        scrollbar-width: none;
      }

      .nx-tabs-scrollable .nx-tabs-nav::-webkit-scrollbar {
        display: none;
      }

      .nx-tabs-left .nx-tabs-nav,
      .nx-tabs-right .nx-tabs-nav {
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
      }

      /* Tab */
      .nx-tab {
        height: var(--tab-height);
        padding: var(--tab-padding);
        background: var(--tab-bg);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-family: inherit;
        color: var(--color-text-secondary);
        white-space: nowrap;
        position: relative;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .nx-tab:hover:not(:disabled) {
        background: var(--tab-hover-bg);
        color: var(--color-text);
      }

      .nx-tab:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      .nx-tab:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-tab.active {
        background: var(--tab-active-bg);
        color: var(--color-text);
      }

      /* Tab variants */
      .nx-tabs-default .nx-tab {
        border-radius: var(--radius-md) var(--radius-md) 0 0;
      }

      .nx-tabs-default .nx-tab.active {
        border: 1px solid var(--tab-border);
        border-bottom: none;
        margin-bottom: -1px;
      }

      .nx-tabs-pills .nx-tab {
        border-radius: var(--radius-md);
      }

      .nx-tabs-pills .nx-tab.active {
        background: var(--color-primary);
        color: white;
      }

      .nx-tabs-underline .nx-tab::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: transparent;
        transition: background 0.2s;
      }

      .nx-tabs-underline .nx-tab.active::after {
        background: var(--tab-active-border);
      }

      .nx-tabs-enclosed {
        border: 1px solid var(--tab-border);
        border-radius: var(--radius-lg);
      }

      .nx-tabs-enclosed .nx-tabs-header {
        background: var(--color-surface);
        border-bottom: 1px solid var(--tab-border);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      }

      /* Tab elements */
      .nx-tab-icon {
        width: 1.25rem;
        height: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nx-tab-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nx-tab-badge {
        padding: 0.125rem 0.375rem;
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        line-height: 1;
        flex-shrink: 0;
      }

      .nx-tab-close {
        width: 1rem;
        height: 1rem;
        padding: 0;
        margin-left: 0.25rem;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        opacity: 0;
        transition: opacity 0.2s, color 0.2s;
        flex-shrink: 0;
      }

      .nx-tab:hover .nx-tab-close,
      .nx-tab.active .nx-tab-close {
        opacity: 1;
      }

      .nx-tab-close:hover {
        color: var(--color-error);
      }

      .nx-tab-close svg {
        width: 100%;
        height: 100%;
      }

      /* Add button */
      .nx-tab-add {
        width: var(--tab-height);
        height: var(--tab-height);
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nx-tab-add:hover {
        background: var(--tab-hover-bg);
        color: var(--color-text);
      }

      .nx-tab-add svg {
        width: 1.25rem;
        height: 1.25rem;
      }

      /* Scroll buttons */
      .nx-tabs-scroll {
        width: 2rem;
        height: var(--tab-height);
        padding: 0;
        background: var(--color-background);
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      }

      .nx-tabs-scroll:hover {
        background: var(--tab-hover-bg);
        color: var(--color-text);
      }

      .nx-tabs-scroll-left {
        box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.1);
      }

      .nx-tabs-scroll-right {
        box-shadow: -4px 0 8px -4px rgba(0, 0, 0, 0.1);
      }

      /* Panels */
      .nx-tabs-panels {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .nx-tab-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        padding: var(--panel-padding);
        overflow: auto;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
      }

      .nx-tab-panel.active {
        opacity: 1;
        visibility: visible;
      }

      .nx-tab-panel[hidden] {
        display: none;
      }

      /* Drag and drop */
      .nx-tab[draggable="true"] {
        cursor: move;
      }

      .nx-tab.dragging {
        opacity: 0.5;
      }

      .nx-tab.drop-indicator::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--color-primary);
      }

      .nx-tab.drop-before::before {
        left: -2px;
      }

      .nx-tab.drop-after::before {
        right: -2px;
      }

      /* Responsive */
      @media (max-width: 640px) {
        .nx-tab {
          padding: 0.5rem 0.75rem;
        }

        .nx-tab-title {
          font-size: 0.8125rem;
        }

        .nx-tabs-panels {
          --panel-padding: 0.75rem;
        }
      }
    `;
  }

  protected afterRender(): void {
    // Tab clicks
    this.$$('.nx-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.nx-tab-close')) return;
        
        const index = parseInt((tab as HTMLElement).dataset.index || '0');
        this.setActiveTab(index);
      });
    });

    // Close buttons
    this.$$('.nx-tab-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = (btn as HTMLElement).dataset.tabId;
        if (tabId) {
          this.removeTab(tabId);
        }
      });
    });

    // Add button
    this.on('.nx-tab-add', 'click', () => {
      const onTabAdd = this.getState('onTabAdd');
      if (onTabAdd) {
        const newTab = onTabAdd();
        if (newTab) {
          this.addTab(newTab);
        }
      } else {
        this.addTab({
          title: `Tab ${this.tabs.length + 1}`,
          content: `<p>Content for tab ${this.tabs.length + 1}</p>`
        });
      }
    });

    // Scroll buttons
    if (this.getProp('scrollable')) {
      this.setupScrolling();
    }

    // Drag and drop
    if (this.getProp('reorderable')) {
      this.setupDragAndDrop();
    }

    // Render components
    this.renderTabComponents();

    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  private setupScrolling(): void {
    const nav = this.$('.nx-tabs-nav') as HTMLElement;
    const leftBtn = this.$('.nx-tabs-scroll-left') as HTMLButtonElement;
    const rightBtn = this.$('.nx-tabs-scroll-right') as HTMLButtonElement;
    
    if (!nav || !leftBtn || !rightBtn) return;

    const updateScrollButtons = () => {
      leftBtn.disabled = nav.scrollLeft <= 0;
      rightBtn.disabled = nav.scrollLeft >= nav.scrollWidth - nav.clientWidth;
    };

    leftBtn?.addEventListener('click', () => {
      nav.scrollBy({ left: -200, behavior: 'smooth' });
    });

    rightBtn?.addEventListener('click', () => {
      nav.scrollBy({ left: 200, behavior: 'smooth' });
    });

    nav.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(nav);
  }

  private setupDragAndDrop(): void {
    const tabs = this.$$('[draggable="true"]');
    
    tabs.forEach((tab, index) => {
      tab.addEventListener('dragstart', (e) => {
        this.setState('draggedTab', index);
        (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        tab.classList.add('dragging');
      });

      tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');
        this.setState('draggedTab', null);
        this.clearDropIndicators();
      });

      tab.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggedIndex = this.getState('draggedTab');
        if (draggedIndex === null || draggedIndex === index) return;

        (e as DragEvent).dataTransfer!.dropEffect = 'move';
        this.showDropIndicator(tab as HTMLElement, e as DragEvent);
      });

      tab.addEventListener('dragleave', () => {
        this.clearDropIndicators();
      });

      tab.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = this.getState('draggedTab');
        if (draggedIndex === null) return;

        const dropPosition = this.getDropPosition(tab as HTMLElement, e as DragEvent);
        let dropIndex = index;
        
        if (dropPosition === 'after') {
          dropIndex++;
        }

        if (draggedIndex < dropIndex) {
          dropIndex--;
        }

        this.reorderTab(draggedIndex, dropIndex);
        this.clearDropIndicators();
      });
    });
  }

  private showDropIndicator(element: HTMLElement, e: DragEvent): void {
    this.clearDropIndicators();
    
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = x < rect.width / 2 ? 'before' : 'after';
    
    element.classList.add(`drop-${position}`);
  }

  private getDropPosition(element: HTMLElement, e: DragEvent): 'before' | 'after' {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? 'before' : 'after';
  }

  private clearDropIndicators(): void {
    this.$$('.drop-before, .drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
  }

  private reorderTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;

    const [movedTab] = this.tabs.splice(fromIndex, 1);
    this.tabs.splice(toIndex, 0, movedTab);

    // Update active index if needed
    const activeIndex = this.getState('activeIndex', 0);
    let newActiveIndex = activeIndex;

    if (activeIndex === fromIndex) {
      newActiveIndex = toIndex;
    } else if (fromIndex < activeIndex && toIndex >= activeIndex) {
      newActiveIndex--;
    } else if (fromIndex > activeIndex && toIndex <= activeIndex) {
      newActiveIndex++;
    }

    this.setState('activeIndex', newActiveIndex);
    this.update();

    this.dispatchEvent(new CustomEvent('tabreorder', {
      detail: { fromIndex, toIndex, tab: movedTab }
    }));
  }

  private setupKeyboardNavigation(): void {
    const header = this.$('.nx-tabs-header');
    if (!header) return;

    header.addEventListener('keydown', (e) => {
      const activeIndex = this.getState('activeIndex', 0);
      let newIndex = activeIndex;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          newIndex = activeIndex > 0 ? activeIndex - 1 : this.tabs.length - 1;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          newIndex = activeIndex < this.tabs.length - 1 ? activeIndex + 1 : 0;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = this.tabs.length - 1;
          break;
        case 'Delete':
          if (this.tabs[activeIndex].closable || this.getProp('closable')) {
            e.preventDefault();
            this.removeTab(this.tabs[activeIndex].id!);
          }
          break;
      }

      if (newIndex !== activeIndex) {
        this.setActiveTab(newIndex);
        
        // Focus the new active tab
        const newTab = this.$$('.nx-tab')[newIndex] as HTMLElement;
        newTab?.focus();
      }
    });
  }

  private renderTabComponents(): void {
    this.$$('.nx-tab-component').forEach(container => {
      const tabId = (container as HTMLElement).dataset.tabId;
      const tab = this.tabs.find(t => t.id === tabId);
      
      if (tab?.component) {
        let element: HTMLElement;
        
        if (typeof tab.component === 'string') {
          element = ComponentRegistry.create(tab.component) as HTMLElement;
        } else {
          element = tab.component;
        }
        
        if (element) {
          container.appendChild(element);
          this.tabElements.set(tabId!, element);
        }
      }
    });
  }

  // Public API

  /**
   * Set active tab
   */
  setActiveTab(indexOrId: number | string): void {
    let index: number;
    
    if (typeof indexOrId === 'string') {
      index = this.tabs.findIndex(tab => tab.id === indexOrId);
      if (index === -1) return;
    } else {
      index = indexOrId;
    }
    
    if (index < 0 || index >= this.tabs.length) return;
    
    const previousIndex = this.getState('activeIndex', 0);
    if (index === previousIndex) return;
    
    this.setState('activeIndex', index);
    
    const tab = this.tabs[index];
    
    // Load lazy content if needed
    if (tab.lazy && !this.tabElements.has(tab.id!)) {
      this.update();
    }
    
    this.dispatchEvent(new CustomEvent('tabchange', {
      detail: { 
        tab, 
        index, 
        previousIndex,
        previousTab: this.tabs[previousIndex]
      }
    }));
  }

  /**
   * Get active tab
   */
  getActiveTab(): TabConfig | null {
    const index = this.getState('activeIndex', 0);
    return this.tabs[index] || null;
  }

  /**
   * Get all tabs
   */
  getTabs(): TabConfig[] {
    return [...this.tabs];
  }

  /**
   * Update a tab
   */
  updateTab(tabId: string, updates: Partial<TabConfig>): void {
    const index = this.tabs.findIndex(tab => tab.id === tabId);
    if (index === -1) return;
    
    this.tabs[index] = { ...this.tabs[index], ...updates };
    this.update();
    
    this.dispatchEvent(new CustomEvent('tabupdate', {
      detail: { tab: this.tabs[index], index }
    }));
  }

  /**
   * Enable/disable a tab
   */
  setTabEnabled(tabId: string, enabled: boolean): void {
    this.updateTab(tabId, { disabled: !enabled });
  }

  /**
   * Set tab badge
   */
  setTabBadge(tabId: string, badge: string | number | null): void {
    this.updateTab(tabId, { badge: badge || undefined });
  }
}

customElements.define('nx-tabpanel', NXTabPanel);
