/**
 * @file @/components/ui/avatar.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { variants } from '@/core/variants';

export interface AvatarConfig {
  /** Image URL */
  src?: string;
  /** Person or thing shown — the accessible name, and the source of the initials */
  alt?: string;
  /** Text shown when there is no image (default: initials of `alt`) */
  fallback?: string;
  /** Avatar size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Circle or rounded square */
  shape?: 'circle' | 'square';
  /** Presence dot */
  status?: 'online' | 'away' | 'busy' | 'offline';
}

const avatar = variants({
  base: 'avatar',
  variants: {
    size: { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' },
    shape: { circle: 'circle', square: 'square' }
  },
  defaultVariants: { size: 'md', shape: 'circle' }
});

/** "Ada Lovelace" → "AL" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

/**
 * Avatar: a user image with initials as the fallback (also while loading, and
 * when the image fails).
 *
 * ```html
 * <nx-avatar src="/ada.jpg" alt="Ada Lovelace" status="online"></nx-avatar>
 * ```
 */
export class NXAvatar extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['src', 'alt', 'fallback', 'size', 'shape', 'status'];
  }

  private failed: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  protected render(): Node {
    const src = this.getProp<string>('src');
    const alt = this.getProp<string>('alt', '');
    const status = this.getProp<string>('status');
    const showImage = !!src && this.failed !== src;
    const label = [alt, status].filter(Boolean).join(', ') || undefined;

    return (
      <span part="avatar" class={avatar({ size: this.getProp('size'), shape: this.getProp('shape') })}
            role="img" aria-label={label}>
        <span class="fallback" part="fallback" aria-hidden="true">{this.getProp('fallback', initials(alt))}</span>
        {showImage && (
          <img part="image" src={src} alt="" loading="lazy"
               onError={() => {
                 this.failed = src!;
                 this.scheduleUpdate();
               }} />
        )}
        {status && <span class={['status', status]} part="status" aria-hidden="true" />}
      </span>
    );
  }

  protected styles(): string {
    return `
      :host { display: inline-flex; vertical-align: middle; }

      .avatar {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: var(--radius-full);
        background: var(--color-muted);
        color: var(--color-text-secondary);
        font-weight: 500;
        user-select: none;
      }

      .square { border-radius: var(--radius-md); }
      .sm { width: 1.75rem; height: 1.75rem; font-size: 0.6875rem; }
      .md { width: 2.5rem; height: 2.5rem; font-size: 0.875rem; }
      .lg { width: 3.25rem; height: 3.25rem; font-size: 1.0625rem; }
      .xl { width: 4.5rem; height: 4.5rem; font-size: 1.375rem; }

      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
      }

      .status {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 28%;
        height: 28%;
        min-width: 0.5rem;
        min-height: 0.5rem;
        border: 2px solid var(--color-background);
        border-radius: var(--radius-full);
      }

      .online { background: var(--color-success); }
      .away { background: var(--color-warning); }
      .busy { background: var(--color-error); }
      .offline { background: var(--color-border); }
    `;
  }
}

define('nx-avatar', NXAvatar);
