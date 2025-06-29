// form.ts

import { NXDataComponent } from '@/components/abstracts/data';

/**
 * Abstract form component that wraps a native `<form>` and manages its data.
 *
 * @template T Shape of the form’s data object.
 */
export abstract class NXFormComponent<T extends Record<string, any> = Record<string, any>> extends NXDataComponent<T> {
  /**
   * Watch for `action` and `method` on the host.
   */
  static get observedAttributes(): string[] {
    return ['action', 'method'];
  }

  /**
   * @param initialData - Optional starting values for form fields.
   */
  constructor(initialData: Partial<T> = {} as T) {
    super(initialData as T);
    this.attachShadow({ mode: 'open' });
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (oldVal !== newVal) this.update();
  }

  /**
   * Render the `<form>` wrapper. Override if you need custom structure.
   */
  protected render(): string {
    const action = this.getProp('action') || '';
    const method = this.getProp('method') || 'get';
    return `
      <form action="${action}" method="${method}">
        <slot></slot>
      </form>
    `;
  }

  /**
   * Default styles for the form.
   */
  protected styles(): string {
    return `
      :host form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    `;
  }

  connectedCallback(): void {
    this.update();
    this.afterRender();
  }

  /**
   * Re-render shadow DOM.
   */
  protected update(): void {
    if (!this.shadow) return;
    this.shadow.innerHTML = `
      <style>${this.styles()}</style>
      ${this.render()}
    `;
  }

  /**
   * After render: wire up `submit` to collect data & emit a `submit` event.
   */
  protected afterRender(): void {
    const form = this.shadow?.querySelector('form');
    if (!form) return;
    form.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const fd = new FormData(form as HTMLFormElement);
      const data: Record<string, any> = {};
      fd.forEach((v, k) => (data[k] = v));
      this.setData(data as T);
      this.dispatchEvent(new CustomEvent('submit', { detail: this.getData() }));
    });
  }
}
