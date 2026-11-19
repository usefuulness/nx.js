/**
 * @file @/core/controller.ts
 * A controller: the code for a part of a page, kept apart from the markup. It listens for events from
 * the elements inside a root by selector (so elements added later work too), finds elements by
 * `reference`, and can own a view model.
 */
import { ViewModel, type ViewModelConfig } from '@/core/viewmodel';

export type ControlHandler = (event: Event, target: Element, controller: Controller) => void;

export interface ControllerConfig {
  /** The element this controller looks after */
  root: Element;
  /** Events to handle: `{ 'nx-button.save': { click: save }, 'nx-input': { input: onType, change: [a, b] } }` */
  control?: Record<string, Record<string, ControlHandler | ControlHandler[]>>;
  /** A view model (or the config for one) shared with the elements: it is bound with `bindAll()` when the controller starts */
  viewModel?: ViewModel | ViewModelConfig;
  /** Bind `bind-…` attributes under the root to the view model (default true when there is one) */
  bind?: boolean;
}

/** Events that do not bubble: they are caught in the capture phase instead */
const CAPTURE = new Set(['focus', 'blur', 'mouseenter', 'mouseleave', 'load', 'error', 'scroll', 'toggle']);

export class Controller {
  readonly root: Element;
  readonly viewModel: ViewModel | null;
  private ownsModel = false;
  private cleanups: Array<() => void> = [];

  constructor(config: ControllerConfig) {
    this.root = config.root;
    if (config.viewModel instanceof ViewModel) this.viewModel = config.viewModel;
    else if (config.viewModel) { this.viewModel = new ViewModel(config.viewModel); this.ownsModel = true; }
    else this.viewModel = null;

    // One listener per event type, however many selectors want it
    const byEvent = new Map<string, Array<[string, ControlHandler[]]>>();
    for (const [selector, events] of Object.entries(config.control ?? {})) {
      for (const [event, handler] of Object.entries(events)) {
        if (!byEvent.has(event)) byEvent.set(event, []);
        byEvent.get(event)!.push([selector, Array.isArray(handler) ? handler : [handler]]);
      }
    }
    for (const [event, rules] of byEvent) {
      const listener = (e: Event) => this.dispatch(e, rules);
      const capture = CAPTURE.has(event);
      this.root.addEventListener(event, listener, capture);
      this.cleanups.push(() => this.root.removeEventListener(event, listener, capture));
    }

    if (this.viewModel && config.bind !== false) {
      const binding = this.viewModel.bindAll(this.root);
      this.cleanups.push(() => binding.destroy());
    }
  }

  private dispatch(e: Event, rules: Array<[string, ControlHandler[]]>): void {
    // The path crosses shadow roots, so an event from inside a component still finds its host
    const path = (e.composedPath?.() ?? []).filter((n): n is Element => n instanceof Element);
    const inside = path.slice(0, path.indexOf(this.root) === -1 ? path.length : path.indexOf(this.root) + 1);
    for (const [selector, handlers] of rules) {
      let target: Element | undefined;
      try {
        target = inside.find(el => el.matches(selector));
      } catch {
        continue; // a selector the browser rejects: skip it rather than break every other handler
      }
      if (!target) continue;
      for (const handler of handlers) {
        try {
          handler(e, target, this);
        } catch (err) {
          console.error(err); // one handler failing does not stop the rest
        }
      }
    }
  }

  /** The element marked `reference="name"` under the root (or the root itself) */
  lookup<T extends Element = HTMLElement>(name: string): T | null {
    const sel = `[reference="${CSS?.escape ? CSS.escape(name) : name.replace(/["\\]/g, '\\$&')}"]`;
    return (this.root.matches(sel) ? this.root : this.root.querySelector(sel)) as T | null;
  }

  /** Every element under the root that matches a selector */
  query<T extends Element = HTMLElement>(selector: string): T[] {
    return Array.from(this.root.querySelectorAll<T>(selector));
  }

  /** Stop listening and unbind. A view model the controller made is destroyed too. */
  destroy(): void {
    this.cleanups.forEach(c => c());
    this.cleanups = [];
    if (this.ownsModel) this.viewModel?.destroy();
  }
}

export function createController(config: ControllerConfig): Controller {
  return new Controller(config);
}
