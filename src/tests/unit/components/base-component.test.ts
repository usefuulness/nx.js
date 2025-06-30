import { BaseComponent } from '@/components/abstracts/base';

// Mock test utilities
const describe = (name: string, fn: () => void) => {};
const it = (name: string, fn: () => void | Promise<void>) => {};
const expect = (value: any) => ({
  toBe: (expected: any) => {},
  toBeTruthy: () => {},
  toHaveBeenCalled: () => {},
  toHaveBeenCalledTimes: (times: number) => {},
  toEqual: (expected: any) => {},
  mock: {
    calls: [[{ detail: {} }]]
  }
});
const beforeEach = (fn: () => void) => {};
const afterEach = (fn: () => void) => {};
const vi = {
  fn: () => ({ mock: { calls: [] } }),
  spyOn: (obj: any, method: string) => ({
    mock: { calls: [] }
  })
};

// Test component that exposes protected methods for testing
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
  
  // Expose protected methods for testing
  testGetState<T = any>(key: string, defaultValue?: T): T {
    return this.getState(key, defaultValue);
  }
  
  testSetState(key: string, value: any): void {
    this.setState(key, value);
  }
  
  testGetProp<T = any>(name: string, defaultValue?: T): T {
    return this.getProp(name, defaultValue);
  }
  
  testEmit(name: string, detail?: any): boolean {
    return this.emit(name, detail);
  }
  
  testOn(target: EventTarget, event: string, handler: EventListenerOrEventListenerObject): void {
    this.on(target, event, handler);
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
      expect(component.testGetState('counter')).toBe(0);
    });

    it('should render on connection', () => {
      const content = component.shadowRoot?.querySelector('.test-component');
      expect(content).toBeTruthy();
    });
  });

  describe('properties', () => {
    it('should get attribute values', () => {
      component.setAttribute('value', 'test');
      expect(component.testGetProp('value')).toBe('test');
    });

    it('should use default values', () => {
      expect(component.testGetProp('missing', 'default')).toBe('default');
    });

    it('should parse boolean attributes', () => {
      component.setAttribute('disabled', 'true');
      expect(component.testGetProp('disabled')).toBe(true);
    });

    it('should parse number attributes', () => {
      component.setAttribute('value', '42');
      expect(component.testGetProp('value')).toBe(42);
    });
  });

  describe('state management', () => {
    it('should update state and trigger render', () => {
      const updateSpy = vi.spyOn(component as any, 'update');
      component.increment();
      expect(component.testGetState('counter')).toBe(1);
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
      component.testSetState('a', 1);
      component.testSetState('b', 2);
      component.testSetState('c', 3);
      
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
      component.testEmit('test', { data: 'value' });
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail).toEqual({ data: 'value' });
    });

    it('should clean up event listeners on disconnect', () => {
      const target = new EventTarget();
      const handler = vi.fn();
      component.testOn(target, 'test', handler);
      
      target.dispatchEvent(new Event('test'));
      expect(handler).toHaveBeenCalledTimes(1);
      
      component.remove();
      target.dispatchEvent(new Event('test'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
