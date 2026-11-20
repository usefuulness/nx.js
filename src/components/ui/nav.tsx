import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface NavItem {
  id?: string;
  text: string;
  icon?: string;
  /** A real link. Server-rendered, it works without JavaScript */
  href?: string;
  /** Navigate here in an NX.app with a router (the app does it when the item is chosen) */
  route?: string;
  /** A small count or label at the end ("12", "New") */
  badge?: string | number;
  /** Sub-items: the item becomes a disclosure button */
  children?: NavItem[];
  /** Open the sub-items at first */
  expanded?: boolean;
  disabled?: boolean;
  /** A heading that starts a group (it has no link of its own: only `text`) */
  heading?: boolean;
}

export interface NavConfig {
  /** The items, with headings to group them */
  data?: NavItem[];
  /** The id of the current item (default: found from the address, by each item's `route` or `href`) */
  value?: string;
  /** Icons only, for a narrow rail (the text stays as each item's accessible name and tooltip) */
  collapsed?: boolean;
  /** Show a button that collapses and expands it */
  collapsible?: boolean;
  /** Put this in front of a `route` to make its link (default `#`, for a hash router; use an empty string for the history router) */
  base?: string;
  /** Accessible name of the navigation */
  label?: string;
}

/**
 * Side navigation for an app: grouped links with icons and badges, the current page marked (`aria-current`), sub-items
 * that open, and an icon-only rail. Arrow keys move between the links.
 *
 * ```tsx
 * <Nav label="Main" collapsible data={[
 *   { id: 'home', text: 'Dashboard', icon: 'dashboard', route: '/' },
 *   { heading: true, text: 'Sales' },
 *   { id: 'orders', text: 'Orders', icon: 'cart', route: '/orders', badge: 12 }
 * ]} />
 * ```
 *
 * Events: `select` (`detail.node` is the item, so an NX.app navigates to its `route`), `collapse-change`, `toggle`.
 */
export class NXNav extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['data', 'value', 'collapsed', 'collapsible', 'base', 'label'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {
    this[ComponentState].set('open', new Set<string>());
    this[ComponentState].set('seeded', false);
    this[ComponentState].set('here', '');
  }

  private readonly onLocation = () => this.setState('here', this.locationKey());

  protected afterConnect(): void {
    window.addEventListener('hashchange', this.onLocation);
    window.addEventListener('popstate', this.onLocation);
    this.onLocation();
  }

  protected cleanup(): void {
    window.removeEventListener('hashchange', this.onLocation);
    window.removeEventListener('popstate', this.onLocation);
  }

  setData(data: NavItem[]): void {
    this.setProp('data', data);
    this.scheduleUpdate();
  }

  private locationKey(): string {
    if (typeof location === 'undefined') return '';
    return location.hash.startsWith('#/') ? location.hash.slice(1).split('?')[0] : location.pathname;
  }

  private get items(): NavItem[] {
    return this.getProp<NavItem[]>('data', []) ?? [];
  }

  private idOf(item: NavItem, path: string): string {
    return item.id ?? path;
  }

  private target(item: NavItem): string | undefined {
    if (item.href) return item.href;
    if (item.route) return `${this.getProp<string>('base', '#')}${item.route}`;
    return undefined;
  }

  private isCurrent(item: NavItem, id: string): boolean {
    const value = this.getProp<string>('value');
    if (value) return value === id;
    const here = this.getState<string>('here', '');
    const route = item.route ?? (item.href && item.href.startsWith('#') ? item.href.slice(1) : item.href);
    return !!route && !!here && (route === here || (route !== '/' && here.startsWith(route + '/')));
  }

  private hasCurrent(item: NavItem, id: string): boolean {
    return (item.children ?? []).some((c, i) => this.isCurrent(c, this.idOf(c, `${id}/${i}`)) || this.hasCurrent(c, this.idOf(c, `${id}/${i}`)));
  }

  protected render(): Node {
    const collapsed = this.getProp('collapsed', false);
    // Items marked `expanded`, and the ones holding the current page, start open
    const open = this.getState<Set<string>>('open', new Set());
    if (!this.getState('seeded', false)) {
      const seed = (items: NavItem[], prefix: string) => items.forEach((it, i) => {
        const id = this.idOf(it, `${prefix}${i}`);
        if (it.expanded) open.add(id);
        if (it.children) seed(it.children, `${id}/`);
      });
      seed(this.items, '');
      this[ComponentState].set('seeded', true);
    }
    return (
      <nav class={['nav', { collapsed }]} part="nav" aria-label={this.getProp('label') || undefined}
           onKeyDown={(e: KeyboardEvent) => this.onKeyDown(e)}>
        <ul class="list" part="list">{this.renderItems(this.items, '', 0)}</ul>
        {this.getProp('collapsible', false) && (
          <button class="collapse" part="collapse" type="button" aria-expanded={String(!collapsed)} aria-label={this.t(collapsed ? 'nav.expand' : 'nav.collapse')}
                  title={collapsed ? this.t('nav.expand') : this.t('nav.collapse')} onClick={() => this.toggleCollapsed()}>
            <span class="ico" aria-hidden="true" html={Icons.get('menu')} />
            <span class="text">{this.t('nav.collapse')}</span>
          </button>
        )}
      </nav>
    );
  }

  private renderItems(items: NavItem[], prefix: string, level: number): Node[] {
    const open = this.getState<Set<string>>('open', new Set());
    const collapsed = this.getProp('collapsed', false);
    return items.map((item, i) => {
      const id = this.idOf(item, `${prefix}${i}`);
      if (item.heading) return <li class="heading" part="heading" role="presentation"><span>{item.text}</span></li>;
      const hasKids = !!item.children?.length;
      const isOpen = hasKids && (open.has(id) || this.hasCurrent(item, id)) && !collapsed;
      const current = this.isCurrent(item, id);
      const icon = item.icon ? Icons.get(item.icon) : '';
      const inner = [
        icon ? <span class="ico" aria-hidden="true" html={icon} /> : <span class="ico" aria-hidden="true" />,
        <span class="text">{item.text}</span>,
        item.badge !== undefined && item.badge !== '' ? <span class="badge" part="badge">{String(item.badge)}</span> : null,
        hasKids ? <span class={['chev', { open: isOpen }]} aria-hidden="true" html={Icons.get('chevron-right')} /> : null
      ];
      const cls = ['item', { current, disabled: !!item.disabled }];
      const style = level ? { paddingInlineStart: `${0.75 + level * 0.875}rem` } : undefined;
      return (
        <li class="entry" data-id={id}>
          {hasKids
            ? <button class={cls} part="item" type="button" aria-expanded={String(isOpen)} disabled={!!item.disabled} data-nav style={style}
                      title={collapsed ? item.text : undefined} onClick={() => this.toggle(id, item)}>{inner}</button>
            : <a class={cls} part="item" href={this.target(item) ?? '#'} aria-current={current ? 'page' : undefined} aria-disabled={item.disabled ? 'true' : undefined}
                 tabindex={item.disabled ? -1 : undefined} data-nav style={style} title={collapsed ? item.text : undefined}
                 onClick={(e: MouseEvent) => this.choose(e, item, id)}>{inner}</a>}
          {isOpen && <ul class="list sub" role="list">{this.renderItems(item.children!, `${id}/`, level + 1)}</ul>}
        </li>
      );
    });
  }

  private choose(e: MouseEvent, item: NavItem, id: string): void {
    if (item.disabled) { e.preventDefault(); return; }
    // A plain link with an address works by itself; one with only a `route` is handled by the app's router
    if (!item.href || e.defaultPrevented) { if (item.route) e.preventDefault(); }
    this.emit('select', { id, node: item });
    if (item.route && this.getProp<string>('base', '#') === '#') this.setState('here', item.route);
  }

  private toggle(id: string, item: NavItem): void {
    const open = new Set(this.getState<Set<string>>('open', new Set()));
    const now = !open.has(id);
    now ? open.add(id) : open.delete(id);
    this.setState('open', open);
    this.emit('toggle', { id, node: item, expanded: now });
  }

  /** Collapse to icons, or expand. */
  toggleCollapsed(force?: boolean): void {
    const next = force ?? !this.getProp('collapsed', false);
    if (next) this.setAttribute('collapsed', ''); else this.removeAttribute('collapsed');
    this.emit('collapse-change', { collapsed: next });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const links = Array.from(this.$$('[data-nav]')).filter(el => !(el as HTMLElement).hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') as HTMLElement[];
    const index = links.indexOf((e.composedPath()[0] as HTMLElement));
    if (index < 0) return;
    e.preventDefault();
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : index + (e.key === 'ArrowDown' ? 1 : -1);
    links[Math.max(0, Math.min(links.length - 1, to))]?.focus();
  }

  /** Keep keyboard focus on the same item when the nav redraws (opening a group, choosing a page). */
  private focusId: string | null = null;
  protected update(): void {
    const el = this.shadowRoot?.activeElement as HTMLElement | null;
    this.focusId = el?.closest('.entry') ? (el.closest('.entry') as HTMLElement).dataset.id ?? null : el?.classList.contains('collapse') ? '__collapse' : null;
    super.update();
  }

  protected afterRender(): void {
    if (this.focusId === null) return;
    const target = this.focusId === '__collapse'
      ? this.$('.collapse')
      : Array.from(this.$$('.entry')).find(e => (e as HTMLElement).dataset.id === this.focusId)?.querySelector('[data-nav]');
    (target as HTMLElement | null)?.focus();
    this.focusId = null;
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }
      .nav { display: flex; flex-direction: column; gap: 0.5rem; height: 100%; }
      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; min-height: 0; overflow-y: auto; }
      .list.sub { flex: none; overflow: visible; margin-top: 2px; }
      .heading { padding: 0.75rem 0.75rem 0.25rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-secondary); }
      .item, .collapse {
        display: flex; align-items: center; gap: 0.625rem; width: 100%; box-sizing: border-box; min-height: 2.25rem; padding: 0.375rem 0.75rem;
        border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-text-secondary); font: inherit; text-align: start; text-decoration: none; cursor: pointer;
        transition: background-color var(--transition-duration), color var(--transition-duration);
      }
      .item:hover, .collapse:hover { background: var(--color-accent); color: var(--color-text); }
      .item.current { background: var(--color-accent); color: var(--color-text); font-weight: 600; box-shadow: inset 3px 0 0 var(--color-primary); }
      :host(:dir(rtl)) .item.current { box-shadow: inset -3px 0 0 var(--color-primary); }
      .item.disabled, .item:disabled { opacity: 0.5; pointer-events: none; }
      .item:focus-visible, .collapse:focus-visible { outline: 2px solid var(--color-ring); outline-offset: -2px; }
      .ico { display: inline-flex; width: 1.25rem; justify-content: center; flex-shrink: 0; font-size: 1.125rem; }
      .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .badge { padding: 0 0.4rem; min-width: 1.25rem; height: 1.25rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; background: var(--color-primary); color: var(--color-primary-foreground); }
      .chev { display: inline-flex; transition: transform var(--transition-duration); }
      .chev.open { transform: rotate(90deg); }
      :host(:dir(rtl)) .chev:not(.open) { transform: scaleX(-1); }
      .collapse { margin-top: auto; }
      /* The rail: icons only. The text stays for assistive technology */
      .collapsed .item, .collapsed .collapse { justify-content: center; padding-inline: 0; }
      .collapsed .text, .collapsed .chev, .collapsed .heading span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .collapsed .heading { padding: 0; height: 1px; margin: 0.5rem 0.5rem; background: var(--color-border); }
      .collapsed .badge { position: absolute; transform: translate(0.9rem, -0.8rem); min-width: 1rem; height: 1rem; font-size: 0.625rem; }
      .collapsed .item { position: relative; }
      @media (prefers-reduced-motion: reduce) { .item, .collapse, .chev { transition: none; } }
    `;
  }
}

define('nx-nav', NXNav);
