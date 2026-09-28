# Custom components

Every built-in component is written the way this page describes, so reading one is the best reference. [`src/components/ui/badge.tsx`](../src/components/ui/badge.tsx) is the short one to copy, following the shadcn idea: a small file you own.

## The shape of a component

A class with a shadow root, a `variants()` map for the look, a JSX `render()`, and styles built from design tokens.

```tsx
import { BaseComponent, define, variants } from 'nx.js';

export interface CounterConfig {
  /** Text before the count */
  label?: string;
  tone?: 'neutral' | 'brand';
}

const counter = variants({
  base: 'counter',
  variants: { tone: { neutral: '', brand: 'brand' } },
  defaultVariants: { tone: 'neutral' }
});

/**
 * Counter: a button that counts its clicks.
 *
 * Events: `count`.
 */
export class Counter extends BaseComponent {
  // Attributes that re-render when they change
  static get observedAttributes() { return ['label', 'tone']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected initializeState() {
    this.setState('count', 0);
  }

  protected render() {
    const count = this.getState<number>('count', 0);
    return (
      <button part="button" class={counter({ tone: this.getProp('tone') })}
              onClick={() => {
                this.setState('count', count + 1);
                this.emit('count', { count: count + 1 });
              }}>
        {this.getProp('label', 'Clicks')}: {count}
      </button>
    );
  }

  protected styles() {
    return `
      .counter { padding: .5rem 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-md);
                 background: var(--color-surface); color: var(--color-text); }
      .brand { background: var(--color-primary); color: var(--color-primary-foreground); }
    `;
  }
}

define('x-counter', Counter);   // the tag, and the xtype 'x-counter'

export const CounterButton = (props: CounterConfig & { onCount?: (e: CustomEvent) => void }) => <x-counter {...props} />;
```

## The rules

- **Props.** `this.getProp('kebab-name', fallback)` reads an attribute first, then a value set through `configure()` (JSX props and configs). List the attributes that should re-render in `observedAttributes`.
- **Rich props.** Arrays, objects and functions arrive through a `setXxx()` method if you define one (`setData`, `setColumns`), or through `getProp()`.
- **State.** `this.setState(key, value)` batches one re-render per frame. Keyboard focus and the text caret survive re-renders.
- **Events.** `this.emit('kebab-name', detail)` fires a bubbling, composed `CustomEvent`. Users listen with `onKebabName` in JSX and configs, or `addEventListener('kebab-name')`.
- **Listeners.** Put them inline in JSX (`onClick={…}`); they go away with the old nodes on re-render. Listeners on `document` or `window` go in `afterRender()` through `this.on(…)`, which removes them automatically.
- **Children.** Light-DOM children render through `<slot>`. Use named slots for regions (`slot="footer"`) and offer a JSX wrapper for them, as `CardFooter` does.
- **Items.** Implement `applyItems(items, build)` to decide what `items` configs become (the tab panel turns them into tabs), or `setItems(items)` to take them as data (menus, breadcrumbs).
- **Escaping.** JSX text is always escaped. `html={…}` and template strings are not, so wrap user data in `escapeHTML()`.
- **Styling hooks.** Add `part="…"` to meaningful inner elements so apps can use `::part()`, and use only design tokens in CSS ([Theming](theming.md#tokens)).
- **Accessibility.** Use real `<button>`s and native inputs, roles and `aria-*`, a visible focus ring, and full keyboard support ([Accessibility](accessibility.md)). Never nest interactive elements.
- **Documentation.** The class's JSDoc (first paragraph, plus ``Events: `a`, `b` ``) and the prop docs of its `<Name>Config` interface become the [component reference](components.md) and editor autocompletion.

Quick one-offs can skip the class: `NX.define('stat', { render() { return <b>{this.getProp('value')}</b>; } })`.

## Making it server-renderable

A component that follows the rules above already renders on the server. A few more keep it correct there; [CONTRIBUTING.md](../CONTRIBUTING.md#server-rendering-rules) explains each:

- Don't touch `document` or `window` when the module loads, only in lifecycle methods.
- Keep state that matters in the DOM (attributes, children), so the server's HTML carries it.
- Don't rebuild server-rendered light-DOM children on connect; check what is already there.
- Form fields extend `NXField`, which provides form association, validation, and the native stand-ins that make forms work before JavaScript.
