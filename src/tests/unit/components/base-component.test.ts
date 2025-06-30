import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseComponent, ComponentState } from '@/components/abstracts/base';

class TestComponent extends BaseComponent {
  static get observedAttributes() {
    return ['value', 'disabled'];
  }

  protected initializeState(): void {
    this.setState('counter', 0);
  }

  protected render(): string {
    return `
      <div class="test-component">
        <span>${this.getProp('value', 'default')}</span>
        <span>${this.getState('counter')}</span>
      </div>
    `;
  }

  protected styles(): string {
    return `
      .test-component {
        padding: 1rem;
      }
    `;
  }

  increment(): void {
    this.setState('counter', this.getState('counter', 0) + 1);
  }
}

customElements.define('test-component', TestComponent);

describe('BaseComponent', () => {
  let component: TestComponent;

  beforeEach(() => {
    component = new TestComponent();
    component.attachShadow({ mode: 'open' });
    document.body.appendChild(component);
  });

  afterEach(() => {
    component.remove();
  });

  describe('lifecycle', () => {
    it('should initialize state on construction', () => {
      expect(component.getState('counter')).toBe(0);
    });

    it('should render on connection', () => {
      const content = component.shadowRoot?.querySelector('.test-component');
      expect(content).toBeTruthy();
    });
  });

  describe('properties', () => {
    it('should get attribute values', () => {
      component.setAttribute('value', 'test');
      expect(component.getProp('value')).toBe('test');
    });

    it('should use default values', () => {
      expect(component.getProp('missing', 'default')).toBe('default');
    });

    it('should parse boolean attributes', () => {
      component.setAttribute('disabled', 'true');
      expect(component.getProp('disabled')).toBe(true);
    });

    it('should parse number attributes', () => {
      component.setAttribute('value', '42');
      expect(component.getProp('value')).toBe(42);
    });
  });

  describe('state management', () => {
    it('should update state and trigger render', () => {
      const updateSpy = vi.spyOn(component as any, 'update');
      component.increment();
      expect(component.getState('counter')).toBe(1);
      // Update is scheduled
      expect(updateSpy).not.toHaveBeenCalled();
      // Wait for next frame
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(updateSpy).toHaveBeenCalled();
          resolve(undefined);
        });
      });
    });

    it('should batch multiple state updates', () => {
      const updateSpy = vi.spyOn(component as any, 'update');
      component.setState('a', 1);
      component.setState('b', 2);
      component.setState('c', 3);
      
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(updateSpy).toHaveBeenCalledTimes(1);
          resolve(undefined);
        });
      });
    });
  });

  describe('event handling', () => {
    it('should emit custom events', () => {
      const handler = vi.fn();
      component.addEventListener('test', handler);
      component.emit('test', { data: 'value' });
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail).toEqual({ data: 'value' });
    });

    it('should clean up event listeners on disconnect', () => {
      const target = new EventTarget();
      const handler = vi.fn();
      component.on(target, 'test', handler);
      
      target.dispatchEvent(new Event('test'));
      expect(handler).toHaveBeenCalledTimes(1);
      
      component.remove();
      target.dispatchEvent(new Event('test'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
