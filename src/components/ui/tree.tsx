import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface TreeNode {
  id?: string | number;
  text: string;
  icon?: string;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  children?: TreeNode[];
  /** Navigate here when selected (inside an NX.app with a router) */
  route?: string;
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

  /** Stable string id for a node (DOM data attributes are always strings). */
  private static nodeId(node: TreeNode): string {
    return String(node.id ?? node.text);
  }

  setData(data: TreeNode[]): void {
    const expanded = new Set<string>();
    const selected = new Set<string>();
    const checked = new Set<string>();
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        const id = NXTree.nodeId(node);
        if (node.expanded) expanded.add(id);
        if (node.selected) selected.add(id);
        if (node.checked) checked.add(id);
        if (node.children) traverse(node.children);
      });
    };
    traverse(data);
    this.updateState({ data, expandedNodes: expanded, selectedNodes: selected, checkedNodes: checked });
  }

  /** Find a node by id (or text, for nodes without id). */
  findNode(id: string | number): TreeNode | null {
    const target = String(id);
    const search = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (NXTree.nodeId(node) === target) return node;
        const found = node.children ? search(node.children) : null;
        if (found) return found;
      }
      return null;
    };
    return search(this.getState<TreeNode[]>('data', []));
  }

  /** Select a node programmatically. */
  select(id: string | number): void {
    this.setState('selectedNodes', new Set([String(id)]));
  }

  getSelected(): TreeNode[] {
    return Array.from(this.getState<Set<string>>('selectedNodes', new Set()))
      .map(id => this.findNode(id))
      .filter((n): n is TreeNode => !!n);
  }

  expandAll(): void {
    const all = new Set<string>();
    const traverse = (nodes: TreeNode[]) => nodes.forEach(node => {
      if (node.children?.length) {
        all.add(NXTree.nodeId(node));
        traverse(node.children);
      }
    });
    traverse(this.getState<TreeNode[]>('data', []));
    this.setState('expandedNodes', all);
  }

  collapseAll(): void {
    this.setState('expandedNodes', new Set());
  }

  protected render(): Node {
    return (
      <div class="nx-tree" part="container" role="tree" onKeyDown={(e: KeyboardEvent) => this.handleKeyboard(e)}>
        {this.renderNodes(this.getState<TreeNode[]>('data', []), 0)}
      </div>
    );
  }

  private renderNodes(nodes: TreeNode[], level: number): Node[] {
    const expandedNodes = this.getState<Set<string>>('expandedNodes', new Set());
    const selectedNodes = this.getState<Set<string>>('selectedNodes', new Set());
    const checkedNodes = this.getState<Set<string>>('checkedNodes', new Set());
    const checkboxes = this.getProp('checkboxes', false);
    const icons = this.getProp('icons', true);

    return nodes.map(node => {
      const nodeId = NXTree.nodeId(node);
      const hasChildren = !!node.children && node.children.length > 0;
      const isExpanded = hasChildren && expandedNodes.has(nodeId);
      const isSelected = selectedNodes.has(nodeId);
      const iconMarkup = icons && node.icon ? Icons.get(node.icon) : '';

      return (
        <div class={['nx-tree-node', { disabled: node.disabled }]} data-node-id={nodeId} data-level={level}>
          <div class={['nx-tree-node-content', { selected: isSelected }]} part={isSelected ? 'node node-selected' : 'node'}
               role="treeitem" aria-expanded={hasChildren ? String(isExpanded) : undefined} aria-selected={String(isSelected)}
               aria-level={level + 1} style={{ paddingLeft: `${0.5 + level}rem` }} tabindex={node.disabled ? -1 : 0}
               onClick={(e: MouseEvent) => this.onNodeClick(e, nodeId, hasChildren)}>
            {hasChildren
              ? <span class={['nx-tree-toggle', { expanded: isExpanded }]} part="toggle" aria-hidden="true" html={Icons.get('chevron-right')} />
              : <span class="nx-tree-toggle-placeholder" />}
            {checkboxes && (
              <input type="checkbox" class="nx-tree-checkbox" tabindex={-1} checked={checkedNodes.has(nodeId)} disabled={!!node.disabled}
                     onClick={(e: MouseEvent) => e.stopPropagation()}
                     onChange={(e: Event) => this.toggleChecked(nodeId, (e.target as HTMLInputElement).checked)} />
            )}
            {icons && node.icon && (iconMarkup
              ? <span class="nx-tree-icon" part="icon" html={iconMarkup} />
              : <span class="nx-tree-icon" part="icon">{node.icon}</span>)}
            <span class="nx-tree-text" part="text">{node.text}</span>
          </div>
          {isExpanded && (
            <div class="nx-tree-children" part="children" role="group">
              {this.renderNodes(node.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  private onNodeClick(e: MouseEvent, nodeId: string, hasChildren: boolean): void {
    if ((e.target as HTMLElement).closest('.nx-tree-toggle')) {
      this.toggleNode(nodeId);
      return;
    }
    this.selectNode(nodeId, e);
    if (hasChildren && this.getProp('expand-on-click', true)) this.toggleNode(nodeId);
  }

  protected styles(): string {
    return `
      :host {
        display: block;
        font-size: 0.875rem;
      }

      .nx-tree {
        display: flex;
        flex-direction: column;
        gap: 1px;
        user-select: none;
      }

      .nx-tree-children {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin-top: 1px;
        animation: nx-tree-open 160ms var(--transition-easing);
      }

      @keyframes nx-tree-open {
        from { opacity: 0; transform: translateY(-2px); }
        to { opacity: 1; transform: none; }
      }

      .nx-tree-node.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .nx-tree-node-content {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        height: 2rem;
        padding-right: 0.5rem;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: background-color var(--transition-duration), color var(--transition-duration);
      }

      .nx-tree-node-content:hover {
        background-color: var(--color-accent);
        color: var(--color-text);
      }

      .nx-tree-node-content.selected {
        background-color: var(--color-accent);
        color: var(--color-text);
        font-weight: 500;
      }

      .nx-tree-node-content:focus-visible {
        outline: 2px solid var(--color-ring);
        outline-offset: -2px;
      }

      .nx-tree-toggle,
      .nx-tree-toggle-placeholder {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        flex-shrink: 0;
        font-size: 0.875rem;
      }

      .nx-tree-toggle {
        transition: transform var(--transition-duration) var(--transition-easing);
      }

      .nx-tree-toggle.expanded {
        transform: rotate(90deg);
      }

      .nx-tree-checkbox {
        margin: 0;
        accent-color: var(--color-primary);
      }

      .nx-tree-icon {
        display: inline-flex;
        flex-shrink: 0;
        font-size: 1rem;
      }

      .nx-tree-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
  }

  /** Whether keyboard focus was inside the tree when the last render started. */
  private hadFocus = false;

  protected update(): void {
    this.hadFocus = !!this.shadowRoot?.activeElement;
    super.update();
  }

  protected afterRender(): void {
    // Expanding shifts positions, so restore focus by node id (not DOM path) —
    // but only if the tree had focus; never steal it from e.g. a filter input
    const focusId = this.getState<string | null>('focusId', null);
    if (focusId !== null && this.hadFocus) {
      const node = Array.from(this.$$('.nx-tree-node')).find(el => (el as HTMLElement).dataset.nodeId === focusId);
      (node?.querySelector(':scope > .nx-tree-node-content') as HTMLElement | null)?.focus();
    }
  }

  /** Expand or collapse a node. */
  toggleNode(nodeId: string | number, force?: boolean): void {
    const id = String(nodeId);
    const expanded = new Set(this.getState<Set<string>>('expandedNodes', new Set()));
    const expand = force ?? !expanded.has(id);
    if (expand === expanded.has(id)) return;
    expand ? expanded.add(id) : expanded.delete(id);
    this.setState('expandedNodes', expanded);
    this.emit('toggle', { nodeId: id, node: this.findNode(id), expanded: expand });
  }

  private selectNode(nodeId: string, e?: MouseEvent | KeyboardEvent): void {
    const multiSelect = this.getProp('multi-select', false);
    const selected = new Set(this.getState<Set<string>>('selectedNodes', new Set()));

    if (multiSelect && e && (e.ctrlKey || e.metaKey)) {
      selected.has(nodeId) ? selected.delete(nodeId) : selected.add(nodeId);
    } else {
      selected.clear();
      selected.add(nodeId);
    }

    this.updateState({ selectedNodes: selected, focusId: nodeId });
    this.emit('select', {
      nodeId,
      node: this.findNode(nodeId),
      selected: Array.from(selected)
    });
  }

  private toggleChecked(nodeId: string, isChecked: boolean): void {
    const checked = new Set(this.getState<Set<string>>('checkedNodes', new Set()));
    isChecked ? checked.add(nodeId) : checked.delete(nodeId);
    this.setState('checkedNodes', checked);
    this.emit('check', { nodeId, node: this.findNode(nodeId), checked: isChecked });
  }

  private handleKeyboard(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('nx-tree-node-content')) return;
    const nodeEl = target.closest('.nx-tree-node') as HTMLElement;
    const nodeId = nodeEl.dataset.nodeId!;
    const node = this.findNode(nodeId);
    const all = Array.from(this.$$('.nx-tree-node-content[tabindex="0"]')) as HTMLElement[];
    const index = all.indexOf(target);

    const focus = (el?: HTMLElement) => {
      if (!el) return;
      this[ComponentState].set('focusId', (el.closest('.nx-tree-node') as HTMLElement).dataset.nodeId);
      el.focus();
    };

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        focus(all[index - 1]);
        break;
      case 'ArrowDown':
        e.preventDefault();
        focus(all[index + 1]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (node?.children?.length && this.getState<Set<string>>('expandedNodes', new Set()).has(nodeId)) {
          this[ComponentState].set('focusId', nodeId);
          this.toggleNode(nodeId, false);
        } else {
          const parent = nodeEl.parentElement?.closest('.nx-tree-node');
          focus(parent?.querySelector(':scope > .nx-tree-node-content') as HTMLElement | undefined);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (node?.children?.length) {
          this[ComponentState].set('focusId', nodeId);
          this.toggleNode(nodeId, true);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectNode(nodeId, e);
        break;
    }
  }
}

define('nx-tree', NXTree);
