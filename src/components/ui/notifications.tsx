import { BaseComponent, ComponentState } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';
import { place, showTopLayer } from '@/core/position';
import { Format } from '@/core/util';

export interface NotificationItem {
  id: string | number;
  title: string;
  description?: string;
  /** When it happened (a date, a timestamp or an ISO string): shown as "3 minutes ago" */
  time?: string | number | Date;
  read?: boolean;
  /** Icon before the title */
  icon?: string;
  /** Open this address when the item is chosen */
  href?: string;
  /** A colour for the icon */
  tone?: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationsConfig {
  /** The notifications, newest first */
  data?: NotificationItem[];
  /** Accessible name and heading (default "Notifications") */
  label?: string;
  /** Shown when there are none */
  emptyText?: string;
}

/**
 * A bell with the number of unread notifications, and a panel listing them: read or unread (said in
 * text, not only by a dot), "Mark all as read", and a live announcement when a new one arrives.
 *
 * ```tsx
 * <Notifications id="bell" data={[{ id: 1, title: 'Invoice #3052 paid', time: new Date(), icon: 'check' }]} />
 * bell.add({ id: 2, title: 'Webhook failing', tone: 'error' })
 * ```
 *
 * Events: `select` (an item was chosen), `read` (`detail.ids`), `clear`.
 */
export class NXNotifications extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['data', 'label', 'empty-text'];
  }

  private closedAt = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {
    this[ComponentState].set('items', null);
    this[ComponentState].set('status', '');
  }

  // ────────── Data ──────────

  private get items(): NotificationItem[] {
    return this.getState<NotificationItem[] | null>('items', null) ?? this.getProp<NotificationItem[]>('data', []) ?? [];
  }

  setData(data: NotificationItem[]): void {
    this.updateState({ items: data.map(d => ({ ...d })) });
  }

  /** Put a notification first, and announce it. */
  add(item: NotificationItem): void {
    this.updateState({ items: [{ ...item, read: item.read ?? false }, ...this.items.filter(i => i.id !== item.id)], status: this.t('notifications.new', { title: item.title }) });
  }

  getUnread(): NotificationItem[] {
    return this.items.filter(i => !i.read);
  }

  markRead(ids: string | number | Array<string | number>): void {
    const list = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
    const changed = this.items.filter(i => list.has(String(i.id)) && !i.read).map(i => i.id);
    if (!changed.length) return;
    this.setState('items', this.items.map(i => (list.has(String(i.id)) ? { ...i, read: true } : i)));
    this.emit('read', { ids: changed });
  }

  markAllRead(): void {
    this.markRead(this.getUnread().map(i => i.id));
  }

  clear(): void {
    this.setState('items', []);
    this.emit('clear');
  }

  // ────────── Render ──────────

  protected render(): Node {
    const label = this.getProp<string>('label') || this.t('notifications.label');
    const items = this.items;
    const unread = items.filter(i => !i.read).length;
    const count = unread > 99 ? '99+' : String(unread);
    return (
      <div class="wrap">
        <button type="button" class="bell" part="button" aria-haspopup="true" aria-expanded="false"
                aria-label={unread ? this.t('notifications.unread', { label, count: unread }) : label}
                onClick={(e: MouseEvent) => this.toggle(e.currentTarget as HTMLElement)}>
          <span class="ico" aria-hidden="true" html={Icons.get('bell')} />
          {unread > 0 && <span class="count" part="count" aria-hidden="true">{count}</span>}
        </button>
        <div class="panel" part="panel" popover="auto" role="group" aria-label={label}
             onToggle={(e: Event) => {
               const open = (e as ToggleEvent).newState === 'open';
               this.$('.bell')?.setAttribute('aria-expanded', String(open));
               if (!open) this.closedAt = Date.now();
             }}>
          <div class="head">
            <strong>{label}</strong>
            <button type="button" class="link" disabled={unread === 0} onClick={() => this.markAllRead()}>{this.t('notifications.markAll')}</button>
          </div>
          {items.length === 0
            ? <div class="empty">{this.getProp('empty-text') || this.t('notifications.empty')}</div>
            : <ul class="list">{items.map(item => this.renderItem(item))}</ul>}
        </div>
        <div class="sr-only" role="status" aria-live="polite">{this.getState<string>('status', '')}</div>
      </div>
    );
  }

  private renderItem(item: NotificationItem): Node {
    const icon = item.icon ? Icons.get(item.icon) : '';
    const time = item.time !== undefined ? new Date(item.time as any) : null;
    const inner = [
      <span class={['dot', { on: !item.read }]} aria-hidden="true" />,
      icon ? <span class={['kind', item.tone]} aria-hidden="true" html={icon} /> : null,
      <span class="body">
        <span class="title">{!item.read && <span class="sr-only">{this.t('notifications.unreadItem')} </span>}{item.title}</span>
        {item.description ? <span class="desc">{item.description}</span> : null}
        {time && !Number.isNaN(time.getTime()) ? <time class="when" datetime={time.toISOString()}>{Format.relativeTime(time, Date.now(), this.locale())}</time> : null}
      </span>
    ];
    const choose = () => { this.markRead(item.id); this.emit('select', { item }); };
    return (
      <li class={['item', { unread: !item.read }]} data-id={String(item.id)}>
        {item.href
          ? <a class="row" href={item.href} onClick={choose}>{inner}</a>
          : <button type="button" class="row" onClick={choose}>{inner}</button>}
      </li>
    );
  }

  private toggle(button: HTMLElement): void {
    const panel = this.$('.panel') as HTMLElement;
    if (Date.now() - this.closedAt < 200) return; // the click that light-dismissed it
    showTopLayer(panel, 'auto');
    place(panel, button, 'bottom-end');
  }

  protected styles(): string {
    return `
      :host { display: inline-block; }
      .wrap { position: relative; display: inline-flex; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .bell { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--color-text); cursor: pointer; font-size: 1.125rem; }
      .bell:hover { background: var(--color-accent); }
      .bell:focus-visible, .row:focus-visible, .link:focus-visible { outline: 2px solid var(--color-ring); outline-offset: -2px; }
      .count { position: absolute; top: 0.125rem; inset-inline-end: 0.0625rem; min-width: 1.0625rem; height: 1.0625rem; padding: 0 0.25rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; background: var(--color-error-text); color: var(--color-background, #fff); font-size: 0.6875rem; font-weight: 700; line-height: 1; }
      .panel { margin: 0; padding: 0; width: min(24rem, calc(100vw - 1.5rem)); border: 1px solid var(--color-border); border-radius: var(--radius-lg, var(--radius-md)); background: var(--color-popover, var(--color-card)); color: var(--color-text); box-shadow: var(--shadow-lg); overflow: hidden; }
      .panel:popover-open { display: flex; flex-direction: column; max-height: min(28rem, 80vh); }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.9375rem; }
      .link { border: 0; background: transparent; color: var(--color-primary); font: inherit; font-size: 0.8125rem; cursor: pointer; padding: 0.25rem 0.375rem; border-radius: var(--radius-sm); }
      .link:disabled { color: var(--color-text-secondary); cursor: default; }
      .list { list-style: none; margin: 0; padding: 0.25rem; overflow-y: auto; }
      .row { display: flex; align-items: flex-start; gap: 0.625rem; width: 100%; box-sizing: border-box; padding: 0.625rem 0.75rem; border: 0; border-radius: var(--radius-md); background: transparent; color: inherit; font: inherit; text-align: start; text-decoration: none; cursor: pointer; }
      .row:hover { background: var(--color-accent); }
      .dot { flex: none; width: 0.5rem; height: 0.5rem; margin-top: 0.4rem; border-radius: 9999px; }
      .dot.on { background: var(--color-primary); }
      .kind { flex: none; display: inline-flex; font-size: 1.125rem; margin-top: 0.0625rem; color: var(--color-text-secondary); }
      .kind.success { color: var(--color-success-text); } .kind.warning { color: var(--color-warning-text); } .kind.error { color: var(--color-error-text); } .kind.info { color: var(--color-info-text); }
      .body { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
      .title { font-size: 0.875rem; font-weight: 400; }
      .unread .title { font-weight: 600; }
      .desc { font-size: 0.8125rem; color: var(--color-text-secondary); }
      .when { font-size: 0.75rem; color: var(--color-text-secondary); }
      .empty { padding: 2rem 1rem; text-align: center; color: var(--color-text-secondary); font-size: 0.875rem; }
    `;
  }
}

define('nx-notifications', NXNotifications);
