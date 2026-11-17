/**
 * @file @/components/ui/stepper.tsx
 */
import { BaseComponent } from '@/components/abstracts/base';
import { define } from '@/core/registry';
import { Icons } from '@/core/icons';

export interface StepperConfig {
  /** The current step, counting from 0 (steps before it are complete) */
  current?: number;
  /** `horizontal` (default) or `vertical` */
  orientation?: 'horizontal' | 'vertical';
  /** Let people go back to an earlier step by clicking it */
  clickable?: boolean;
  /** Accessible name of the list (default "Progress") */
  label?: string;
}

export interface StepProps {
  /** The step's name */
  title: string;
  /** A line under the name */
  description?: string;
  /** Mark a step that needs attention */
  status?: 'error';
}

/**
 * Progress through a sequence of steps. Steps are `<nx-step>` children; the current step is the
 * `current` attribute, so server HTML carries it. It shows progress; the content of each step is yours.
 *
 * ```html
 * <nx-stepper current="1" clickable>
 *   <nx-step title="Account" description="Your details"></nx-step>
 *   <nx-step title="Plan"></nx-step>
 *   <nx-step title="Payment" status="error"></nx-step>
 * </nx-stepper>
 * ```
 *
 * Each step says whether it is complete, current or has an error to assistive technology, and the
 * current one has `aria-current="step"`. With `clickable`, completed steps are buttons that go back
 * to them (**Tab**, **Enter**, **Space**).
 *
 * API: `next()`, `previous()`, `goTo(index)`. Events: `step-change` (detail: `{ index }`).
 */
export class NXStepper extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['current', 'orientation', 'clickable', 'label'];
  }

  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState(): void {}

  private steps(): HTMLElement[] {
    return Array.from(this.children).filter(el => el.localName === 'nx-step') as HTMLElement[];
  }

  getCurrent(): number {
    const n = Math.floor(Number(this.getProp('current', 0)));
    return Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), Math.max(0, this.steps().length - 1));
  }

  /** Go to a step (clamped), like a click: emits `step-change` when it moved. */
  goTo(index: number): void {
    const next = Math.min(Math.max(Math.floor(index) || 0, 0), Math.max(0, this.steps().length - 1));
    if (next === this.getCurrent()) return;
    this.setAttribute('current', String(next));
    this.emit('step-change', { index: next });
  }

  next(): void {
    this.goTo(this.getCurrent() + 1);
  }

  previous(): void {
    this.goTo(this.getCurrent() - 1);
  }

  protected afterConnect(): void {
    // Steps given in markup may arrive after the element, and can change later
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.scheduleUpdate());
    this.observer.observe(this, { childList: true, attributes: true, subtree: true, attributeFilter: ['title', 'description', 'status'] });
  }

  protected cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  protected render(): Node {
    const steps = this.steps();
    const current = this.getCurrent();
    const clickable = !!this.getProp('clickable', false);

    return (
      <ol part="stepper" class="stepper" aria-label={this.getProp<string>('label') || this.t('stepper.label')}>
        {steps.map((step, i) => {
          const error = step.getAttribute('status') === 'error';
          const state = error ? 'error' : i < current ? 'complete' : i === current ? 'current' : 'upcoming';
          const title = step.getAttribute('title') ?? '';
          const description = step.getAttribute('description');
          const canGo = clickable && i <= current && i !== current ? true : false;
          const marker = (
            <span class="marker" part="marker" aria-hidden="true">
              {state === 'complete' ? <span class="icon" html={Icons.get('check')} /> : state === 'error' ? '!' : String(i + 1)}
            </span>
          );
          const text = (
            <span class="text">
              <span class="title" part="title">{title}</span>
              {description && <span class="description" part="description">{description}</span>}
              <span class="sr-only">{`. ${this.t('stepper.step', { n: i + 1, total: steps.length })}, ${this.t(`stepper.${state}`)}`}</span>
            </span>
          );
          return (
            <li class={['step', state]} part={`step ${state}`} aria-current={i === current ? 'step' : undefined}>
              {canGo ? (
                <button type="button" class="step-button" onClick={() => this.goTo(i)}>{marker}{text}</button>
              ) : (
                <span class="step-static">{marker}{text}</span>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  protected styles(): string {
    // The stacked layout, used for `orientation="vertical"` and whenever the container is too narrow for a row
    const stacked = (sel: string) => `
      ${sel} .stepper { flex-direction: column; gap: 0; }
      ${sel} .step { flex: none; padding-bottom: 1.25rem; }
      ${sel} .step:last-child { padding-bottom: 0; }
      ${sel} .step:not(:last-child)::after {
        position: absolute;
        flex: none;
        min-width: 0;
        inset-block: 1.75rem 0;
        inset-inline-start: calc(0.875rem - 1px);
        width: 2px;
        height: auto;
        margin: 0;
      }
      ${sel} .step:not(:last-child) .text { padding-inline-end: 0; }
    `;
    return `
      :host { display: block; font-size: 0.875rem; container-type: inline-size; }

      .stepper { display: flex; margin: 0; padding: 0; list-style: none; }
      .step { position: relative; display: flex; align-items: flex-start; flex: 1 1 0; min-width: 0; }
      .step:last-child { flex: 0 1 auto; }
      .step-button, .step-static { display: flex; align-items: flex-start; gap: 0.75rem; min-width: 0; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: start; }
      .step-button { cursor: pointer; border-radius: var(--radius-md); }
      .step-button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-background), 0 0 0 4px var(--color-ring); }

      .marker {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border: 2px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-background);
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
        font-weight: 600;
        transition: background-color var(--transition-duration), border-color var(--transition-duration);
      }

      .icon { display: inline-flex; font-size: 0.875rem; }
      .complete .marker { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-primary-foreground); }
      .current .marker { border-color: var(--color-primary); color: var(--color-text); }
      .error .marker { border-color: var(--color-error); background: color-mix(in srgb, var(--color-error) 12%, var(--color-background)); color: var(--color-error-text); }

      .text { display: flex; flex-direction: column; min-width: 0; padding-top: 0.125rem; }
      .title { font-weight: 500; color: var(--color-text); overflow-wrap: break-word; }
      .upcoming .title { color: var(--color-text-secondary); }
      .error .title { color: var(--color-error-text); }
      .description { color: var(--color-text-secondary); font-size: 0.8125rem; overflow-wrap: break-word; }

      /* The connector is a flex item after the text, so it never runs through it */
      .step:not(:last-child)::after {
        content: '';
        flex: 1 1 1rem;
        min-width: 1rem;
        height: 2px;
        margin: 0.8125rem 0.75rem 0;
        background: var(--color-border);
      }

      .step.complete:not(:last-child)::after { background: var(--color-primary); }

      ${stacked(':host([orientation="vertical"])')}
      @container (max-width: 34rem) {
        ${stacked(':host')}
      }

      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
  }
}

define('nx-stepper', NXStepper);
