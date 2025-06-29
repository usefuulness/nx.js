// src/components/ui/tree.ts
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface TreeNode {
  id: string | number;
  text: string;
  icon?: string;
  children?: TreeNode[];
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  data?: any;
  parent?: TreeNode;
}

export interface TreeConfig {
  data: TreeNode[];
  showCheckboxes?: boolean;
  showIcons?: boolean;
  showLines?: boolean;
  multiSelect?: boolean;
  draggable?: boolean;
  droppable?: boolean;
  lazyLoad?: boolean;
  onSelect?: (node: TreeNode) => void;
  onExpand?: (node: TreeNode) => void;
  onCheck?: (node: TreeNode, checked: boolean) => void;
  onDrop?: (source: TreeNode, target: TreeNode, position: 'before' | 'after' | 'inside') => boolean;
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
}

/**
 * Tree view component for hierarchical data
 */
export class NXTree extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['show-checkboxes', 'show-icons', 'show-lines', 'multi-select', 'draggable', 'droppable'];
  }

  private data: TreeNode[] = [];
  private nodeMap: Map<string | number, TreeNode> = new Map();
  private config: TreeConfig = {};

  protected initializeState(): void {
    this[ComponentState].set('selectedNodes', new Set<string | number>());
    this[ComponentState].set('checkedNodes', new Set<string | number>());
    this[ComponentState].set('expandedNodes', new Set<string | number>());
    this[ComponentState].set('loadingNodes', new Set<string | number>());
    this[ComponentState].set('draggedNode', null);
    this[ComponentState].set('dropTarget', null);
  }

  constructor(config?: TreeConfig) {
    super();
    this.attachShadow({ mode: 'open' });
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure the tree
   */
  configure(config: TreeConfig): void {
    this.config = config;
    if (config.data) {
      this.setData(config.data);
    }
    
    // Set attributes from config
    if (config.showCheckboxes !== undefined) {
      this.setAttribute('show-checkboxes', String(config.showCheckboxes));
    }
    if (config.showIcons !== undefined) {
      this.setAttribute('show-icons', String(config.showIcons));
    }
    if (config.showLines !== undefined) {
      this.setAttribute('show-lines', String(config.showLines));
    }
    if (config.multiSelect !== undefined) {
      this.setAttribute('multi-select', String(config.multiSelect));
    }
    if (config.draggable !== undefined) {
      this.setAttribute('draggable', String(config.draggable));
    }
  }

  /**
   * Set tree data
   */
  setData(data: TreeNode[]): void {
    this.data = this.processNodes(data);
    this.buildNodeMap();
    this.update();
  }

  /**
   * Process nodes to ensure proper structure
   */
  private processNodes(nodes: TreeNode[], parent?: TreeNode): TreeNode[] {
    return nodes.map(node => {
      const processed = { ...node, parent };
      if (processed.children) {
        processed.children = this.processNodes(processed.children, processed);
      }
      if (processed.expanded) {
        this.getState('expandedNodes', new Set()).add(processed.id);
      }
      if (processed.selected) {
        this.getState('selectedNodes', new Set()).add(processed.id);
      }
      return processed;
    });
  }

  /**
   * Build node map for quick access
   */
  private buildNodeMap(): void {
    this.nodeMap.clear();
    
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        this.nodeMap.set(node.id, node);
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(this.data);
  }

  protected render(): string {
    const showLines = this.getProp('show-lines', false);
    const isEmpty = this.data.length === 0;

    return `
      <div class="nx-tree ${showLines ? 'show-lines' : ''}" 
           part="tree"
           role="tree">
        ${isEmpty ? this.renderEmptyState() : this.renderNodes(this.data, 0)}
      </div>
    `;
  }

  private renderEmptyState(): string {
    return `
      <div class="nx-tree-empty" part="empty">
        <svg class="nx-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <p class="nx-empty-text">No items to display</p>
      </div>
    `;
  }

  private renderNodes(nodes: TreeNode[], level: number): string {
    return `
      <ul class="nx-tree-nodes" 
          role="group"
          data-level="${level}">
        ${nodes.map(node => this.renderNode(node, level)).join('')}
      </ul>
    `;
  }

  private renderNode(node: TreeNode, level: number): string {
    const hasChildren = node.children && node.children.length > 0;
    const expanded = this.getState('expandedNodes', new Set()).has(node.id);
    const selected = this.getState('selectedNodes', new Set()).has(node.id);
    const checked = this.getState('checkedNodes', new Set()).has(node.id);
    const loading = this.getState('loadingNodes', new Set()).has(node.id);
    const showCheckboxes = this.getProp('show-checkboxes', false);
    const showIcons = this.getProp('show-icons', true);
    const draggable = this.getProp('draggable', false);

    return `
      <li class="nx-tree-node ${selected ? 'selected' : ''} ${node.disabled ? 'disabled' : ''}"
          role="treeitem"
          aria-expanded="${hasChildren ? expanded : undefined}"
          aria-selected="${selected}"
          data-node-id="${node.id}"
          data-level="${level}"
          ${draggable && !node.disabled ? 'draggable="true"' : ''}>
        <div class="nx-tree-node-content" part="node">
          ${this.renderIndent(level)}
          ${this.renderExpander(node, hasChildren, expanded, loading)}
          ${showCheckboxes ? this.renderCheckbox(node, checked) : ''}
          ${showIcons ? this.renderIcon(node) : ''}
          <span class="nx-tree-node-text" part="node-text">${node.text}</span>
        </div>
        ${hasChildren && expanded ? this.renderNodes(node.children!, level + 1) : ''}
      </li>
    `;
  }

  private renderIndent(level: number): string {
    return Array(level).fill('').map(() => 
      '<span class="nx-tree-indent"></span>'
    ).join('');
  }

  private renderExpander(node: TreeNode, hasChildren: boolean, expanded: boolean, loading: boolean): string {
    if (loading) {
      return `
        <span class="nx-tree-expander loading">
          <span class="nx-tree-spinner"></span>
        </span>
      `;
    }

    if (!hasChildren && !this.config.lazyLoad) {
      return '<span class="nx-tree-expander empty"></span>';
    }

    return `
      <button class="nx-tree-expander ${expanded ? 'expanded' : ''}"
              type="button"
              aria-label="${expanded ? 'Collapse' : 'Expand'}"
              data-node-id="${node.id}">
        <svg class="nx-expander-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    `;
  }

  private renderCheckbox(node: TreeNode, checked: boolean): string {
    const indeterminate = this.isIndeterminate(node);
    
    return `
      <input type="checkbox" 
             class="nx-tree-checkbox"
             ${checked ? 'checked' : ''}
             ${indeterminate ? 'indeterminate' : ''}
             ${node.disabled ? 'disabled' : ''}
             data-node-id="${node.id}"
             aria-label="Select ${node.text}">
    `;
  }

  private renderIcon(node: TreeNode): string {
    const icon = node.icon || this.getDefaultIcon(node);
    
    if (icon.startsWith('<svg')) {
      return `<span class="nx-tree-icon">${icon}</span>`;
    } else if (icon.startsWith('icon-')) {
      return `<i class="nx-tree-icon ${icon}"></i>`;
    } else {
      // Default to emoji or text icon
      return `<span class="nx-tree-icon">${icon}</span>`;
    }
  }

  private getDefaultIcon(node: TreeNode): string {
    const hasChildren = node.children && node.children.length > 0;
    const expanded = this.getState('expandedNodes', new Set()).has(node.id);
    
    if (hasChildren) {
      return expanded ? '📂' : '📁';
    }
    return '📄';
  }

  protected styles(): string {
    return `
      :host {
        --tree-indent: 1.5rem;
        --tree-line-color: var(--color-border);
        --tree-node-height: 2rem;
        --tree-hover-bg: var(--color-background);
        --tree-selected-bg: rgba(59, 130, 246, 0.1);
        --tree-selected-border: var(--color-primary);
        display: block;
      }

      .nx-tree {
        font-size: 0.875rem;
        color: var(--color-text);
        user-select: none;
      }

      .nx-tree-nodes {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .nx-tree-node {
        position: relative;
      }

      .nx-tree-node-content {
        display: flex;
        align-items: center;
        height: var(--tree-node-height);
        padding: 0 0.5rem;
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: background-color 0.15s;
      }

      .nx-tree-node-content:hover {
        background: var(--tree-hover-bg);
      }

      .nx-tree-node.selected > .nx-tree-node-content {
        background: var(--tree-selected-bg);
        border: 1px solid var(--tree-selected-border);
        padding: 0 calc(0.5rem - 1px);
      }

      .nx-tree-node.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .nx-tree-node.disabled .nx-tree-node-content {
        cursor: not-allowed;
      }

      /* Drag and drop */
      .nx-tree-node[draggable="true"] {
        cursor: move;
      }

      .nx-tree-node.dragging {
        opacity: 0.5;
      }

      .nx-tree-node.drop-target {
        background: var(--color-primary);
        opacity: 0.2;
      }

      .nx-tree-node.drop-before::before,
      .nx-tree-node.drop-after::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--color-primary);
      }

      .nx-tree-node.drop-before::before {
        top: 0;
      }

      .nx-tree-node.drop-after::after {
        bottom: 0;
      }

      /* Indent */
      .nx-tree-indent {
        width: var(--tree-indent);
        display: inline-block;
        position: relative;
      }

      /* Lines */
      .nx-tree.show-lines .nx-tree-indent::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 1px;
        background: var(--tree-line-color);
      }

      .nx-tree.show-lines .nx-tree-node:last-child > .nx-tree-node-content .nx-tree-indent::before {
        height: 50%;
      }

      /* Expander */
      .nx-tree-expander {
        width: 1.25rem;
        height: 1.25rem;
        padding: 0;
        margin-right: 0.25rem;
        background: none;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.15s;
      }

      .nx-tree-expander.empty {
        visibility: hidden;
      }

      .nx-tree-expander.expanded {
        transform: rotate(90deg);
      }

      .nx-tree-expander:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
        border-radius: var(--radius-sm);
      }

      .nx-expander-icon {
        width: 0.75rem;
        height: 0.75rem;
      }

      /* Loading spinner */
      .nx-tree-spinner {
        width: 0.75rem;
        height: 0.75rem;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Checkbox */
      .nx-tree-checkbox {
        margin-right: 0.5rem;
        cursor: pointer;
      }

      .nx-tree-checkbox:indeterminate {
        opacity: 0.5;
      }

      /* Icon */
      .nx-tree-icon {
        width: 1.25rem;
        height: 1.25rem;
        margin-right: 0.5rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      /* Text */
      .nx-tree-node-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Empty state */
      .nx-tree-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        color: var(--color-text-secondary);
      }

      .nx-empty-icon {
        width: 3rem;
        height: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .nx-empty-text {
        margin: 0;
      }

      /* Keyboard navigation */
      .nx-tree-node:focus {
        outline: none;
      }

      .nx-tree-node:focus > .nx-tree-node-content {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }
    `;
  }

  protected afterRender(): void {
    // Expander clicks
    this.$$('.nx-tree-expander').forEach(expander => {
      expander.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = (expander as HTMLElement).dataset.nodeId;
        if (nodeId) {
          this.toggleNode(nodeId);
        }
      });
    });

    // Node clicks
    this.$$('.nx-tree-node-content').forEach(content => {
      content.addEventListener('click', (e) => {
        const nodeEl = content.closest('.nx-tree-node') as HTMLElement;
        const nodeId = nodeEl?.dataset.nodeId;
        if (nodeId && !nodeEl.classList.contains('disabled')) {
          this.selectNode(nodeId, e.ctrlKey || e.metaKey);
        }
      });
    });

    // Checkbox changes
    this.$$('.nx-tree-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const nodeId = (checkbox as HTMLElement).dataset.nodeId;
        if (nodeId) {
          this.checkNode(nodeId, (e.target as HTMLInputElement).checked);
        }
      });
    });

    // Drag and drop
    if (this.getProp('draggable')) {
      this.setupDragAndDrop();
    }

    // Keyboard navigation
    this.setupKeyboardNavigation();
  }

  private setupDragAndDrop(): void {
    const draggableNodes = this.$$('[draggable="true"]');
    
    draggableNodes.forEach(node => {
      node.addEventListener('dragstart', (e) => {
        const nodeId = (node as HTMLElement).dataset.nodeId;
        const treeNode = this.nodeMap.get(nodeId!);
        if (treeNode) {
          this.setState('draggedNode', treeNode);
          (e as DragEvent).dataTransfer!.effectAllowed = 'move';
          node.classList.add('dragging');
        }
      });

      node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
        this.setState('draggedNode', null);
        this.clearDropIndicators();
      });

      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggedNode = this.getState('draggedNode');
        if (!draggedNode) return;

        const targetId = (node as HTMLElement).dataset.nodeId;
        const targetNode = this.nodeMap.get(targetId!);
        
        if (targetNode && this.canDrop(draggedNode, targetNode)) {
          (e as DragEvent).dataTransfer!.dropEffect = 'move';
          this.showDropIndicator(node as HTMLElement, e as DragEvent);
        }
      });

      node.addEventListener('dragleave', () => {
        this.clearDropIndicators();
      });

      node.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedNode = this.getState('draggedNode');
        const targetId = (node as HTMLElement).dataset.nodeId;
        const targetNode = this.nodeMap.get(targetId!);
        
        if (draggedNode && targetNode) {
          const position = this.getDropPosition(node as HTMLElement, e as DragEvent);
          this.handleDrop(draggedNode, targetNode, position);
        }
        
        this.clearDropIndicators();
      });
    });
  }

  private canDrop(source: TreeNode, target: TreeNode): boolean {
    // Don't allow dropping on itself or its children
    if (source.id === target.id) return false;
    
    let parent = target.parent;
    while (parent) {
      if (parent.id === source.id) return false;
      parent = parent.parent;
    }
    
    return true;
  }

  private showDropIndicator(element: HTMLElement, e: DragEvent): void {
    this.clearDropIndicators();
    
    const rect = element.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (y < height * 0.25) {
      element.classList.add('drop-before');
    } else if (y > height * 0.75) {
      element.classList.add('drop-after');
    } else {
      element.classList.add('drop-target');
    }
  }

  private getDropPosition(element: HTMLElement, e: DragEvent): 'before' | 'after' | 'inside' {
    const rect = element.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  }

  private clearDropIndicators(): void {
    this.$$('.drop-before, .drop-after, .drop-target').forEach(el => {
      el.classList.remove('drop-before', 'drop-after', 'drop-target');
    });
  }

  private handleDrop(source: TreeNode, target: TreeNode, position: 'before' | 'after' | 'inside'): void {
    if (this.config.onDrop) {
      const allowed = this.config.onDrop(source, target, position);
      if (!allowed) return;
    }

    // Perform the drop operation
    // This would involve updating the data structure
    this.dispatchEvent(new CustomEvent('drop', {
      detail: { source, target, position }
    }));
  }

  private setupKeyboardNavigation(): void {
    this.addEventListener('keydown', (e) => {
      const selectedNodes = this.getState('selectedNodes', new Set());
      if (selectedNodes.size === 0) return;

      const selectedId = Array.from(selectedNodes)[0];
      const currentNode = this.nodeMap.get(selectedId);
      if (!currentNode) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.navigateToPrevious(currentNode);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.navigateToNext(currentNode);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (this.isExpanded(currentNode)) {
            this.collapseNode(currentNode.id);
          } else if (currentNode.parent) {
            this.selectNode(currentNode.parent.id);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentNode.children && currentNode.children.length > 0) {
            if (!this.isExpanded(currentNode)) {
              this.expandNode(currentNode.id);
            } else {
              this.selectNode(currentNode.children[0].id);
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (e.key === ' ' && this.getProp('show-checkboxes')) {
            const checked = this.getState('checkedNodes', new Set()).has(currentNode.id);
            this.checkNode(currentNode.id, !checked);
          } else {
            this.toggleNode(currentNode.id);
          }
          break;
      }
    });
  }

  // Helper methods

  private isExpanded(node: TreeNode): boolean {
    return this.getState('expandedNodes', new Set()).has(node.id);
  }

  private isIndeterminate(node: TreeNode): boolean {
    if (!node.children || node.children.length === 0) return false;
    
    const checkedNodes = this.getState('checkedNodes', new Set());
    let checkedCount = 0;
    let totalCount = 0;
    
    const countChecked = (nodes: TreeNode[]) => {
      nodes.forEach(child => {
        totalCount++;
        if (checkedNodes.has(child.id)) checkedCount++;
        if (child.children) countChecked(child.children);
      });
    };
    
    countChecked(node.children);
    
    return checkedCount > 0 && checkedCount < totalCount;
  }

  private navigateToPrevious(node: TreeNode): void {
    // Find previous visible node
    const allVisible = this.getVisibleNodes();
    const currentIndex = allVisible.findIndex(n => n.id === node.id);
    
    if (currentIndex > 0) {
      this.selectNode(allVisible[currentIndex - 1].id);
    }
  }

  private navigateToNext(node: TreeNode): void {
    // Find next visible node
    const allVisible = this.getVisibleNodes();
    const currentIndex = allVisible.findIndex(n => n.id === node.id);
    
    if (currentIndex < allVisible.length - 1) {
      this.selectNode(allVisible[currentIndex + 1].id);
    }
  }

  private getVisibleNodes(): TreeNode[] {
    const visible: TreeNode[] = [];
    const expandedNodes = this.getState('expandedNodes', new Set());
    
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        visible.push(node);
        if (node.children && expandedNodes.has(node.id)) {
          traverse(node.children);
        }
      });
    };
    
    traverse(this.data);
    return visible;
  }

  // Public API

  /**
   * Expand a node
   */
  async expandNode(nodeId: string | number): Promise<void> {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    const expandedNodes = new Set(this.getState('expandedNodes', new Set()));
    
    // Lazy load if needed
    if (this.config.lazyLoad && (!node.children || node.children.length === 0)) {
      const loadingNodes = new Set(this.getState('loadingNodes', new Set()));
      loadingNodes.add(nodeId);
      this.setState('loadingNodes', loadingNodes);
      
      try {
        if (this.config.loadChildren) {
          const children = await this.config.loadChildren(node);
          node.children = this.processNodes(children, node);
          this.buildNodeMap();
        }
      } finally {
        loadingNodes.delete(nodeId);
        this.setState('loadingNodes', loadingNodes);
      }
    }
    
    expandedNodes.add(nodeId);
    this.setState('expandedNodes', expandedNodes);
    
    if (this.config.onExpand) {
      this.config.onExpand(node);
    }
    
    this.dispatchEvent(new CustomEvent('expand', { detail: { node } }));
  }

  /**
   * Collapse a node
   */
  collapseNode(nodeId: string | number): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    const expandedNodes = new Set(this.getState('expandedNodes', new Set()));
    expandedNodes.delete(nodeId);
    this.setState('expandedNodes', expandedNodes);
    
    this.dispatchEvent(new CustomEvent('collapse', { detail: { node } }));
  }

  /**
   * Toggle node expansion
   */
  toggleNode(nodeId: string | number): void {
    const expandedNodes = this.getState('expandedNodes', new Set());
    if (expandedNodes.has(nodeId)) {
      this.collapseNode(nodeId);
    } else {
      this.expandNode(nodeId);
    }
  }

  /**
   * Select a node
   */
  selectNode(nodeId: string | number, multiSelect = false): void {
    const node = this.nodeMap.get(nodeId);
    if (!node || node.disabled) return;

    const selectedNodes = new Set(this.getState('selectedNodes', new Set()));
    
    if (!multiSelect && !this.getProp('multi-select')) {
      selectedNodes.clear();
    }
    
    if (selectedNodes.has(nodeId)) {
      selectedNodes.delete(nodeId);
    } else {
      selectedNodes.add(nodeId);
    }
    
    this.setState('selectedNodes', selectedNodes);
    
    if (this.config.onSelect) {
      this.config.onSelect(node);
    }
    
    this.dispatchEvent(new CustomEvent('select', { 
      detail: { 
        node, 
        selected: Array.from(selectedNodes).map(id => this.nodeMap.get(id)!) 
      } 
    }));
  }

  /**
   * Check/uncheck a node
   */
  checkNode(nodeId: string | number, checked: boolean): void {
    const node = this.nodeMap.get(nodeId);
    if (!node || node.disabled) return;

    const checkedNodes = new Set(this.getState('checkedNodes', new Set()));
    
    // Update node and all children
    const updateNodeAndChildren = (n: TreeNode, check: boolean) => {
      if (check) {
        checkedNodes.add(n.id);
      } else {
        checkedNodes.delete(n.id);
      }
      
      if (n.children) {
        n.children.forEach(child => updateNodeAndChildren(child, check));
      }
    };
    
    updateNodeAndChildren(node, checked);
    
    // Update parent nodes
    this.updateParentCheckState(node.parent);
    
    this.setState('checkedNodes', checkedNodes);
    
    if (this.config.onCheck) {
      this.config.onCheck(node, checked);
    }
    
    this.dispatchEvent(new CustomEvent('check', { 
      detail: { 
        node, 
        checked,
        checkedNodes: Array.from(checkedNodes).map(id => this.nodeMap.get(id)!)
      } 
    }));
  }

  /**
   * Update parent check state based on children
   */
  private updateParentCheckState(parent?: TreeNode): void {
    if (!parent || !parent.children) return;
    
    const checkedNodes = this.getState('checkedNodes', new Set());
    const allChecked = parent.children.every(child => checkedNodes.has(child.id));
    const someChecked = parent.children.some(child => checkedNodes.has(child.id));
    
    if (allChecked) {
      checkedNodes.add(parent.id);
    } else {
      checkedNodes.delete(parent.id);
    }
    
    // Continue up the tree
    if (parent.parent) {
      this.updateParentCheckState(parent.parent);
    }
  }

  /**
   * Get selected nodes
   */
  getSelectedNodes(): TreeNode[] {
    const selectedNodes = this.getState('selectedNodes', new Set());
    return Array.from(selectedNodes).map(id => this.nodeMap.get(id)!).filter(Boolean);
  }

  /**
   * Get checked nodes
   */
  getCheckedNodes(): TreeNode[] {
    const checkedNodes = this.getState('checkedNodes', new Set());
    return Array.from(checkedNodes).map(id => this.nodeMap.get(id)!).filter(Boolean);
  }

  /**
   * Expand all nodes
   */
  expandAll(): void {
    const expandedNodes = new Set<string | number>();
    this.nodeMap.forEach((node, id) => {
      if (node.children && node.children.length > 0) {
        expandedNodes.add(id);
      }
    });
    this.setState('expandedNodes', expandedNodes);
  }

  /**
   * Collapse all nodes
   */
  collapseAll(): void {
    this.setState('expandedNodes', new Set());
  }

  /**
   * Find node by text
   */
  findNode(text: string): TreeNode | null {
    for (const [_, node] of this.nodeMap) {
      if (node.text.toLowerCase().includes(text.toLowerCase())) {
        return node;
      }
    }
    return null;
  }
}

customElements.define('nx-tree', NXTree);
