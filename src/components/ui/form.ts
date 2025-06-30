import { BaseComponent, ComponentState } from '@/components/abstracts/base';

export interface FormConfig {
  method?: 'get' | 'post';
  action?: string;
  noValidate?: boolean;
  onSubmit?: (data: FormData) => void;
}

export class NXForm extends BaseComponent {
  static get observedAttributes(): string[] {
    return ['method', 'action', 'novalidate'];
  }

  protected initializeState(): void {
    this[ComponentState].set('isValid', true);
    this[ComponentState].set('isDirty', false);
    this[ComponentState].set('errors', {});
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected render(): string {
    const method = this.getProp('method', 'post');
    const action = this.getProp('action', '');
    const noValidate = this.getProp('novalidate', false);

    return `
      <form class="nx-form" 
            part="form"
            method="${method}"
            action="${action}"
            ${noValidate ? 'novalidate' : ''}>
        <slot></slot>
      </form>
    `;
  }

  protected styles(): string {
    return `
      :host {
        display: block;
      }

      .nx-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    `;
  }

  protected afterRender(): void {
    const form = this.$('form') as HTMLFormElement;
    if (form) {
      this.on(form, 'submit', (e: Event) => this.handleSubmit(e));
      this.on(form, 'reset', () => this.handleReset());
      this.on(form, 'change', () => this.setState('isDirty', true));
    }
  }

  private handleSubmit(e: Event): void {
    e.preventDefault();
    
    const form = this.$('form') as HTMLFormElement;
    const formData = new FormData(form);
    
    if (this.validate()) {
      this.emit('submit', Object.fromEntries(formData));
    }
  }

  private handleReset(): void {
    this.setState('isDirty', false);
    this.setState('errors', {});
    this.setState('isValid', true);
    this.emit('reset');
  }

  validate(): boolean {
    const form = this.$('form') as HTMLFormElement;
    const isValid = form.checkValidity();
    this.setState('isValid', isValid);
    return isValid;
  }

  getData(): FormData {
    const form = this.$('form') as HTMLFormElement;
    return new FormData(form);
  }

  setData(data: Record<string, any>): void {
    const form = this.$('form') as HTMLFormElement;
    Object.entries(data).forEach(([_name, value]) => {
      const input = form.elements.namedItem(_name) as HTMLInputElement;
      if (input) {
        input.value = String(value);
      }
    });
  }

  reset(): void {
    const form = this.$('form') as HTMLFormElement;
    form.reset();
    this.handleReset();
  }
}

customElements.define('nx-form', NXForm);
