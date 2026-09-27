/**
 * @file @/components/ui/loader.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */
import { BaseComponent } from '@/components/abstracts/base';
import { ComponentRegistry, define } from '@/core/registry';
import { variants } from '@/core/variants';

export interface LoaderConfig {
  type?: 'spinner' | 'dots' | 'bars' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  /** Any CSS color; defaults to the primary color */
  color?: string;
  /** Cover the nearest positioned ancestor with a translucent layer */
  overlay?: boolean;
  /** Cover the whole viewport */
  fullscreen?: boolean;
  text?: string;
  /** `false` hides the loader */
  active?: boolean;
}

const loader = variants({
  base: 'loader',
  variants: { size: { sm: 'sm', md: 'md', lg: 'lg' } },
  defaultVariants: { size: 'md' }
});

/**
 * Loading indicator, optionally covering its container or the whole page.
 *
 * ```tsx
 * <div style="position: relative">… <Loader overlay text="Saving…" /></div>
 * const done = NXLoader.showFullscreen({ text: 'Signing in…' }); … done.remove();
 * ```
 */
export class NXLoader extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['type', 'size', 'color', 'overlay', 'fullscreen', 'text', 'active'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private indicator(type: string): Node {
    const dots = (n: number) => Array.from({ length: n }, () => <span />);
    switch (type) {
      case 'dots': return <div class="dots">{dots(3)}</div>;
      case 'bars': return <div class="bars">{dots(5)}</div>;
      case 'pulse': return <div class="pulse">{dots(2)}</div>;
      default: return <nx-spinner size={this.getProp('size', 'md')} />;
    }
  }

  protected render(): Node | string {
    if (!this.getProp('active', true)) return '';
    const color = this.getProp<string>('color');
    const text = this.getProp<string>('text');
    const fullscreen = this.getProp('fullscreen', false);

    const content = (
      <div part="loader" class={loader({ size: this.getProp('size') })} role="status" aria-live="polite"
           style={color ? { '--loader-color': color, '--spinner-color': color } : undefined}>
        {this.indicator(this.getProp('type', 'spinner'))}
        {text && <div class="text" part="text">{text}</div>}
      </div>
    );

    return this.getProp('overlay', false) || fullscreen
      ? <div part="overlay" class={['overlay', { fullscreen }]}>{content}</div>
      : content;
  }

  protected styles(): string {
    return `
      :host { display: inline-block; }
      :host([overlay]), :host([fullscreen]) { display: contents; }

      .loader {
        --loader-size: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        color: var(--loader-color, var(--color-primary));
      }

      .sm { --loader-size: 1rem; font-size: 0.75rem; }
      .md { font-size: 0.8125rem; }
      .lg { --loader-size: 2.5rem; font-size: 0.875rem; }

      .overlay {
        position: absolute;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--color-background) 80%, transparent);
        backdrop-filter: blur(1px);
      }

      .overlay.fullscreen { position: fixed; z-index: 2147481000; }

      .text { color: var(--color-text-secondary); }

      .dots { display: flex; gap: calc(var(--loader-size) / 5); }
      .dots span {
        width: calc(var(--loader-size) / 3);
        height: calc(var(--loader-size) / 3);
        border-radius: 9999px;
        background: currentColor;
        animation: dots 1.4s ease-in-out infinite both;
      }
      .dots span:nth-child(1) { animation-delay: -0.32s; }
      .dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes dots {
        0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
      }

      .bars { display: flex; gap: calc(var(--loader-size) / 10); height: var(--loader-size); }
      .bars span {
        width: calc(var(--loader-size) / 8);
        border-radius: 9999px;
        background: currentColor;
        animation: bars 1.2s ease-in-out infinite;
      }
      .bars span:nth-child(1) { animation-delay: -0.4s; }
      .bars span:nth-child(2) { animation-delay: -0.3s; }
      .bars span:nth-child(3) { animation-delay: -0.2s; }
      .bars span:nth-child(4) { animation-delay: -0.1s; }
      @keyframes bars {
        0%, 40%, 100% { transform: scaleY(0.4); }
        20% { transform: scaleY(1); }
      }

      .pulse { position: relative; width: var(--loader-size); height: var(--loader-size); }
      .pulse span {
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: currentColor;
        animation: pulse 2s ease-out infinite;
      }
      .pulse span:nth-child(2) { animation-delay: -1s; }
      @keyframes pulse {
        0% { transform: scale(0); opacity: 0.7; }
        100% { transform: scale(1); opacity: 0; }
      }
    `;
  }

  show(): void {
    this.set('active', true);
  }

  hide(): void {
    this.set('active', false);
  }

  toggle(): void {
    this.set('active', !this.getProp('active', true));
  }

  /** Cover the page with a loader. Call `.remove()` (or `.hide()`) when done. */
  static showFullscreen(config: Omit<LoaderConfig, 'fullscreen'> = {}): NXLoader {
    const el = ComponentRegistry.build({ xtype: 'loader', ...config, fullscreen: true }) as NXLoader;
    document.body.appendChild(el);
    return el;
  }
}

define('nx-loader', NXLoader);
