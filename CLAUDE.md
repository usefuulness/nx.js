# Nexaro (nx.js)

shadcn-style web components written in JSX that creates real DOM (own runtime in `src/jsx/`, no React).

- Follow the house style in `CONTRIBUTING.md`. `src/components/ui/badge.tsx` is the template for new components, and `src/main.tsx` is the template for app code.
- New UI code is JSX (`.tsx`): PascalCase components from `@/index` for apps, a `BaseComponent` subclass with JSX `render()`, `variants()` and design-token CSS for components.
- JSX props, HTML attributes and `{ xtype }` configs share one path (`BaseComponent.configure`). Don't add JSX-only or config-only behaviour.
- Component CSS uses tokens only (`var(--color-*)`, `--radius-*`, `--shadow-*`). Status-coloured text uses the `--color-*-text` tokens (contrast).
- Before committing, run `pnpm check` (tsc + vitest). For UI changes, also run `pnpm test:e2e`: it includes an axe WCAG 2.1 AA audit of every demo page and theme, which must stay at zero violations.
