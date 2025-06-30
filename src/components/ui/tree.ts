import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface TreeNode {
  id?: string | number;
  text: string;
  icon?: string;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  children?: TreeNode[];
  data?: any;
}

export interface TreeConfig {
  data: TreeNode[];
  multiSelect?: boolean;
  checkboxes?: boolean;
  expandOnClick?: boolean;
  icons?: boolean;
}

export class NXTree extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['multi-select', 'checkboxes', 'expand-on-click', 'icons'];
  }

  protected initializeState(): void {
    this[ComponentState].set('data', []);
    this[ComponentState].set('selectedNodes', new Set());
    this[ComponentState].set('checkedNodes', new Set());
    this[ComponentState].set('expandedNodes', new Set());
  }

  constructor(config?: TreeConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config?.data) {
      this.setData(config.data);
    }
  }

  setData(data: TreeNode[]): void {
    this.setState('data', data);
    // Initialize expanded state
    const expanded = new Set<string | number>();
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.expanded && node.id !== undefined) {
          expanded.add(node.id);
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(data);
    this.setState('expandedNodes', expanded);
  }

  protected render(): string {
    const data = this.getState<TreeNode[]>('data', []);
    return `
      <div class="nx-tree" part="container" role="tree">
        ${this.renderNodes(data, 0)}
      </div>
    `;
  }

  private renderNodes(nodes: TreeNode[], level: number): string {
    const expandedNodes = this.getState<Set<string | number>>('expandedNodes', new Set());
    const selectedNodes = this.getState<Set<string | number>>('selectedNodes', new Set());
    const checkedNodes = this.getState<Set<string | number>>('checkedNodes', new Set());
    const checkboxes = this.getProp('checkboxes', false);
    const icons = this.getProp('icons', true);

    return nodes.map(node => {
      const nodeId = node.id || node.text;
      const isExpanded = node.children && expandedNodes.has(nodeId);
      const isSelected = selectedNodes.has(nodeId);
      const isChecked = checkedNodes.has(nodeId);
      const hasChildren = node.children && node.children.length > 0;

      return `
        <div class="nx-tree-node ${node.disabled ? 'disabled' : ''}" 
             data-node-id="${nodeId}"
             data-level="${level}">
          <div class="nx-tree-node-content ${isSelected ? 'selected' : ''}" 
               part="node"
               role="treeitem"
               aria-expanded="${hasChildren ? isExpanded : undefined}"
               aria-selected="${isSelected}"
               tabindex="${node.disabled ? -1 : 0}">
            <span class="nx-tree-indent" style="width: ${level * 20}px"></span>
            ${hasChildren ? `
              <button class="nx-tree-toggle ${isExpanded ? 'expanded' : ''}" 
                      part="toggle"
                      tabindex="-1">
                <svg viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            ` : `
              <span class="nx-tree-toggle-placeholder"></span>
            `}
            ${checkboxes ? `
              <input type="checkbox" 
                     class="nx-tree-checkbox" 
                     ${isChecked ? 'checked' : ''}
                     ${node.disabled ? 'disabled' : ''}
                     tabindex="-1">
            ` : ''}
            ${icons && node.icon ? `
              <span class="nx-tree-icon" part="icon">${node.icon}</span>
            ` : ''}
            <span class="nx-tree-text" part="text">${node.text}</span>
          </div>
          ${hasChildren ? `
            <div class="nx-tree-children ${isExpanded ? 'expanded' : ''}" part="children">
              ${isExpanded ? this.renderNodes(node.children!, level + 1) : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-tree {
        font-family: var(--font-family);
        user-select: none;
      }

      .nx-tree-node {
        position: relative;
      }

      .nx-tree-node.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .nx-tree-node-content {
        display: flex;
        align-items: center;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        border-radius: 0.25rem;
        transition: background-color 0.2s;
      }

      .nx-tree-node-content:hover {
        background-color: var(--hover-bg, rgba(0, 0, 0, 0.04));
      }

      .nx-tree-node-content.selected {
        background-color: var(--selected-bg, rgba(25, 118, 210, 0.12));
        color: var(--selected-color, #1976d2);
      }

      .nx-tree-indent {
        flex-shrink: 0;
      }

      .nx-tree-toggle {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }

      .nx-tree-toggle svg {
        width: 1rem;
        height: 1rem;
        fill: currentColor;
      }

      .nx-tree-toggle.expanded {
        transform: rotate(180deg);
      }

      .nx-tree-toggle-placeholder {
        width: 1.5rem;
        flex-shrink: 0;
      }

      .nx-tree-checkbox {
        margin: 0 0.5rem;
      }

      .nx-tree-icon {
        margin-right: 0.5rem;
        flex-shrink: 0;
      }

      .nx-tree-text {
        flex: 1;
      }

      .nx-tree-children {
        overflow: hidden;
        max-height: 0;
        transition: max-height 0.3s ease-out;
      }

      .nx-tree-children.expanded {
        max-height: none;
      }
    `;
  }

  protected afterRender(): void {
    // Node click handler
    this.on(this.shadow!, 'click', (e: Event) => {
      const target = e.target as HTMLElement;
      const nodeContent = target.closest('.nx-tree-node-content');
      const toggleBtn = target.closest('.nx-tree-toggle');
      const checkbox = target.closest('.nx-tree-checkbox');

      if (toggleBtn) {
        this.handleToggle(e);
      } else if (checkbox) {
        this.handleCheck(e);
      } else if (nodeContent) {
        this.handleSelect(e);
      }
    });

    // Keyboard navigation
    this.on(this.shadow!, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      this.handleKeyboard(keyEvent);
    });
  }

  private handleToggle(e: Event): void {
    e.stopPropagation();
    const toggle = e.target as HTMLElement;
    const node = toggle.closest('.nx-tree-node') as HTMLElement;
    const nodeId = node.dataset.nodeId!;
    const expanded = this.getState<Set<string | number>>('expandedNodes', new Set());
    
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId);
    } else {
      expanded.add(nodeId);
    }
    
    this.setState('expandedNodes', new Set(expanded));
    this.emit('toggle', { nodeId, expanded: !expanded.has(nodeId) });
  }

  private handleSelect(e: Event): void {
    const nodeContent = (e.target as HTMLElement).closest('.nx-tree-node-content') as HTMLElement;
    const node = nodeContent.closest('.nx-tree-node') as HTMLElement;
    const nodeId = node.dataset.nodeId!;
    const multiSelect = this.getProp('multi-select', false);
    const selected = this.getState<Set<string | number>>('selectedNodes', new Set());
    
    if (multiSelect && ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey)) {
      if (selected.has(nodeId)) {
        selected.delete(nodeId);
      } else {
        selected.add(nodeId);
      }
    } else {
      selected.clear();
      selected.add(nodeId);
    }
    
    this.setState('selectedNodes', new Set(selected));
    this.emit('select', { nodeId, selected: Array.from(selected) });
  }

  private handleCheck(e: Event): void {
    const checkbox = e.target as HTMLInputElement;
    const node = checkbox.closest('.nx-tree-node') as HTMLElement;
    const nodeId = node.dataset.nodeId!;
    const checked = this.getState<Set<string | number>>('checkedNodes', new Set());
    
    if (checkbox.checked) {
      checked.add(nodeId);
    } else {
      checked.delete(nodeId);
    }
    
    this.setState('checkedNodes', new Set(checked));
    this.emit('check', { nodeId, checked: checkbox.checked });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('nx-tree-node-content')) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusPrevious(target);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusNext(target);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.collapseNode(target);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.expandNode(target);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.handleSelect(e);
        break;
    }
  }

  private focusPrevious(current: HTMLElement): void {
    const allNodes = Array.from(this.shadowRoot!.querySelectorAll('.nx-tree-node-content:not([disabled])'));
    const currentIndex = allNodes.indexOf(current);
    if (currentIndex > 0) {
      (allNodes[currentIndex - 1] as HTMLElement).focus();
    }
  }

  private focusNext(current: HTMLElement): void {
    const allNodes = Array.from(this.shadowRoot!.querySelectorAll('.nx-tree-node-content:not([disabled])'));
    const currentIndex = allNodes.indexOf(current);
    if (currentIndex < allNodes.length - 1) {
      (allNodes[currentIndex + 1] as HTMLElement).focus();
    }
  }

  private expandNode(nodeContent: HTMLElement): void {
    const node = nodeContent.closest('.nx-tree-node') as HTMLElement;
    const toggle = node.querySelector('.nx-tree-toggle');
    if (toggle && !toggle.classList.contains('expanded')) {
      toggle.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  private collapseNode(nodeContent: HTMLElement): void {
    const node = nodeContent.closest('.nx-tree-node') as HTMLElement;
    const toggle = node.querySelector('.nx-tree-toggle');
    if (toggle && toggle.classList.contains('expanded')) {
      toggle.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }
}

customElements.define('nx-tree', NXTree);
