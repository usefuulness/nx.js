/**
 * @file @/components/ui/timeline.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface TimelineConfig {
  /** Accessible name of the list (default "Timeline") */
  label?: string;
  /** Show the newest item last instead of first */
  reverse?: boolean;
}

export interface TimelineItemProps {
  /** What happened */
  title: string;
  /** When: an ISO date or date-time. It is shown formatted for the page's language. */
  time?: string;
  /** Colour by meaning */
  status?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** An icon name for the marker */
  icon?: string;
}

const STATUS_ICON: Record<string, string> = { success: 'check', error: 'x', warning: 'warning', info: 'info' };

/**
 * A vertical list of events, such as an activity feed or an order history. Items are
 * `<nx-timeline-item>` children: `title`, optional `time` (ISO) and `status`, and the item's
 * text is its description.
 *
 * ```html
 * <nx-timeline label="Order history">
 *   <nx-timeline-item title="Delivered" time="2026-03-04" status="success">Left at the front door.</nx-timeline-item>
 *   <nx-timeline-item title="Shipped" time="2026-03-02T09:30"></nx-timeline-item>
 * </nx-timeline>
 * ```
 *
 * It is an ordered list, and each time is a real `<time>` element. A status is also written out
 * for screen readers, so colour is never the only cue.
 */
export class NXTimeline extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['label', 'reverse'];
  }

  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private items(): HTMLElement[] {
    return Array.from(this.children).filter(el => el.localName === 'nx-timeline-item') as HTMLElement[];
  }

  protected afterConnect(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.scheduleUpdate());
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'time', 'status', 'icon'] });
  }

  protected cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private when(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const hasTime = /[T ]\d{1,2}:\d{2}/.test(iso);
    try {
      return new Intl.DateTimeFormat(this.locale(), hasTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
    } catch {
      return iso;
    }
  }

  protected render(): Node {
    const items = this.items();
    if (this.getProp('reverse', false)) items.reverse();

    return (
      <ol part="timeline" class="timeline" aria-label={this.getProp<string>('label') || this.t('timeline.label')}>
        {items.map(item => {
          const status = item.getAttribute('status') || 'default';
          const time = item.getAttribute('time');
          const icon = item.getAttribute('icon') || STATUS_ICON[status];
          const body = (item.textContent ?? '').trim();
          return (
            <li class={['item', status]} part={`item ${status}`}>
              <span class="marker" part="marker" aria-hidden="true">{icon && <span class="icon" html={Icons.get(icon)} />}</span>
              <div class="content">
                <div class="head">
                  <span class="title" part="title">{item.getAttribute('title') ?? ''}</span>
                  {status !== 'default' && <span class="sr-only">{`(${this.t(`timeline.${status}`)})`}</span>}
                  {time && <time class="time" part="time" datetime={time}>{this.when(time)}</time>}
                </div>
                {body && <p class="body" part="body">{body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  protected styles(): string {
    return `
      :host { display: block; font-size: 0.875rem; }
      .timeline { margin: 0; padding: 0; list-style: none; }
      .item { --dot: var(--color-border); position: relative; display: flex; gap: 0.875rem; padding-bottom: 1.25rem; }
      .item:last-child { padding-bottom: 0; }
      .success { --dot: var(--color-success); }
      .warning { --dot: var(--color-warning); }
      .error { --dot: var(--color-error); }
      .info { --dot: var(--color-info); }

      .marker { position: relative; z-index: 1; display: inline-flex; flex: none; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; margin-top: 0.0625rem; border: 2px solid var(--dot); border-radius: var(--radius-full); background: var(--color-background); color: var(--dot); }
      .icon { display: inline-flex; width: 0.75rem; height: 0.75rem; }
      .icon svg { width: 100%; height: 100%; }
      .item:not(.default) .marker { background: var(--dot); color: var(--color-background); }

      /* The line joining one marker to the next */
      .item:not(:last-child)::before { content: ''; position: absolute; inset-block: 1.375rem 0; inset-inline-start: calc(0.625rem - 1px); width: 2px; background: var(--color-border); }

      .content { min-width: 0; flex: 1; }
      .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.125rem 0.75rem; }
      .title { font-weight: 500; color: var(--color-text); overflow-wrap: anywhere; }
      .time { color: var(--color-text-secondary); font-size: 0.8125rem; font-variant-numeric: tabular-nums; }
      .body { margin: 0.125rem 0 0; color: var(--color-text-secondary); overflow-wrap: anywhere; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-timeline', NXTimeline);
