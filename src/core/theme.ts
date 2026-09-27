// src/core/theme.ts

export interface ThemeColors {
  /** Brand / primary action background */
  primary: string;
  /** Primary hover */
  primaryDark: string;
  /** Text on top of `primary` */
  primaryForeground: string;
  /** Secondary action background */
  secondary: string;
  /** Text on top of `secondary` */
  secondaryForeground: string;
  /** Page background */
  background: string;
  /** Cards, panels, popovers */
  surface: string;
  /** Subtle backgrounds (headers, table heads, tracks) */
  muted: string;
  /** Hover / selected backgrounds */
  accent: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Focus ring */
  ring: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeShadow {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  spacing?: ThemeSpacing;
  radius?: ThemeRadius;
  shadow?: ThemeShadow;
  fontFamily?: string;
  customProperties?: Record<string, string>;
}

/**
 * Built-in themes
 */
const lightTheme: ThemeConfig = {
  name: 'light',
  colors: {
    primary: '#18181b',
    primaryDark: '#27272a',
    primaryForeground: '#fafafa',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    background: '#ffffff',
    surface: '#ffffff',
    muted: '#f4f4f5',
    accent: '#f4f4f5',
    text: '#09090b',
    textSecondary: '#6b6b74',
    border: '#e4e4e7',
    ring: '#a1a1aa',
    error: '#dc2626',
    success: '#16a34a',
    warning: '#d97706',
    info: '#2563eb'
  }
};

const darkTheme: ThemeConfig = {
  name: 'dark',
  colors: {
    primary: '#fafafa',
    primaryDark: '#e4e4e7',
    primaryForeground: '#18181b',
    secondary: '#27272a',
    secondaryForeground: '#fafafa',
    background: '#09090b',
    surface: '#0f0f11',
    muted: '#18181b',
    accent: '#27272a',
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    border: '#27272a',
    ring: '#71717a',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
};

const midnightTheme: ThemeConfig = {
  name: 'midnight',
  colors: {
    primary: '#818cf8',
    primaryDark: '#6366f1',
    primaryForeground: '#0b1020',
    secondary: '#1e293b',
    secondaryForeground: '#f8fafc',
    background: '#020617',
    surface: '#0b1224',
    muted: '#0f172a',
    accent: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#1e293b',
    ring: '#818cf8',
    error: '#fb7185',
    success: '#4ade80',
    warning: '#facc15',
    info: '#38bdf8'
  }
};

/**
 * Perceived-lightness check for a #rgb / #rrggbb color.
 */
function isDarkColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

/**
 * Theme manager for handling application themes
 */
export class ThemeManager {
  private static themes: Map<string, ThemeConfig> = new Map([
    ['light', lightTheme],
    ['dark', darkTheme],
    ['midnight', midnightTheme]
  ]);

  private static currentTheme = 'light';
  private static root = document.documentElement;
  private static mediaQuery: MediaQueryList = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : ({ matches: false, addEventListener: () => {} } as unknown as MediaQueryList);
  private static listeners: Set<(theme: string) => void> = new Set();
  private static defaultTheme: string | null = null;
  private static initialized = false;

  /**
   * Initialize theme manager
   */
  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Saved choice, else a theme the server rendered (<html data-theme>), else the app default, else the OS
    const savedTheme = this.saved();
    const serverTheme = this.root.getAttribute('data-theme');
    const systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
    const pick = [savedTheme, serverTheme, this.defaultTheme, systemTheme].find(t => t && this.themes.has(t))!;
    this.setTheme(pick, { persist: false });

    // Follow OS changes until the user picks a theme
    this.mediaQuery.addEventListener('change', (e) => {
      if (!this.saved() && !this.defaultTheme) {
        this.setTheme(e.matches ? 'dark' : 'light', { persist: false });
      }
    });
  }

  /**
   * Set the theme used when the user hasn't picked one yet.
   */
  static setDefault(themeName: string): void {
    this.defaultTheme = themeName;
    const saved = this.saved();
    if (!saved || !this.themes.has(saved)) {
      this.setTheme(themeName, { persist: false });
    }
  }

  private static saved(): string | null {
    try {
      const stored = localStorage.getItem('nx-theme');
      if (stored) return stored;
    } catch {
      // storage unavailable
    }
    const cookie = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )nx-theme=([^;]+)/) : null;
    return cookie ? decodeURIComponent(cookie[1]) : null;
  }

  /**
   * Register a custom theme
   */
  static registerTheme(theme: ThemeConfig): void {
    this.themes.set(theme.name, theme);
  }

  /**
   * Set the active theme
   */
  static setTheme(themeName: string, options: { persist?: boolean } = {}): void {
    const theme = this.themes.get(themeName);
    if (!theme) {
      console.warn(`Theme "${themeName}" not found`);
      return;
    }

    this.currentTheme = themeName;
    this.applyTheme(theme);
    
    // Save preference (explicit user choices only)
    if (options.persist !== false) {
      try {
        localStorage.setItem('nx-theme', themeName);
      } catch {
        // storage unavailable (private mode, sandboxed iframe)
      }
      // A cookie too, so servers can render the right theme (<html data-theme>) with no flash
      document.cookie = `nx-theme=${encodeURIComponent(themeName)}; path=/; max-age=31536000; SameSite=Lax`;
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener(themeName));
  }

  /**
   * Apply theme to DOM
   */
  private static applyTheme(theme: ThemeConfig): void {
    this.root.setAttribute('data-theme', theme.name);
    Object.entries(this.variables(theme)).forEach(([name, value]) => this.root.style.setProperty(name, value));
    this.root.style.colorScheme = isDarkColor(theme.colors.background) ? 'dark' : 'light';
    this.applyBaseStyles();
  }

  /**
   * Every CSS custom property a theme defines (colors, radius, shadows, font, custom).
   * Pure: used both to apply a theme in the browser and to generate `nx.css`.
   */
  static variables(theme: ThemeConfig): Record<string, string> {
    const vars: Record<string, string> = {};
    Object.entries(theme.colors).forEach(([key, value]) => (vars[`--color-${this.kebabCase(key)}`] = value));
    const spacing = theme.spacing ?? { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' };
    const radius = theme.radius ?? { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' };
    const shadow = theme.shadow ?? {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.08)'
    };
    Object.entries(spacing).forEach(([k, v]) => (vars[`--spacing-${k}`] = v));
    Object.entries(radius).forEach(([k, v]) => (vars[`--radius-${k}`] = v));
    Object.entries(shadow).forEach(([k, v]) => (vars[`--shadow-${k}`] = v));
    vars['--backdrop-bg'] = `rgb(0 0 0 / ${isDarkColor(theme.colors.background) ? '0.7' : '0.5'})`;
    if (theme.fontFamily) vars['--font-family'] = theme.fontFamily;
    Object.assign(vars, theme.customProperties ?? {});
    return vars;
  }

  /**
   * A complete static stylesheet: base styles, token aliases and every registered
   * theme under `:root[data-theme="…"]` (no `data-theme` = light, or dark via
   * `prefers-color-scheme`). Serve it as `nx.css` so server-rendered pages
   * (SSR/SSG, other template engines) are themed before any JavaScript runs.
   */
  static stylesheet(options: { hideUndefined?: boolean } = {}): string {
    const block = (selector: string, theme: ThemeConfig) => {
      const vars = Object.entries(this.variables(theme)).map(([k, v]) => `  ${k}: ${v};`).join('\n');
      return `${selector} {\n  color-scheme: ${isDarkColor(theme.colors.background) ? 'dark' : 'light'};\n${vars}\n}`;
    };
    const light = this.themes.get('light')!;
    const dark = this.themes.get('dark')!;
    const parts = [
      '/* Nexaro — generated by ThemeManager.stylesheet() */',
      this.baseStyles(),
      block(':root:not([data-theme])', light),
      `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme])', dark)}\n}`,
      ...Array.from(this.themes.values()).map(theme => block(`:root[data-theme="${theme.name}"]`, theme))
    ];
    if (options.hideUndefined !== false && typeof customElements !== 'undefined') {
      // Until the script defines them, hide components that weren't server-rendered
      // (server-rendered ones carry [nx-ssr] and already have their shadow DOM)
      const tags = this.componentTags();
      if (tags.length) parts.push(`:is(${tags.join(', ')}):not(:defined):not([nx-ssr]) { visibility: hidden; }`);
    }
    return parts.join('\n\n');
  }

  private static componentTags(): string[] {
    // Registered Nexaro elements (the registry keeps no list, so probe the known prefix)
    const known = ['nx-accordion', 'nx-badge', 'nx-breadcrumb', 'nx-button', 'nx-card', 'nx-checkbox', 'nx-container',
      'nx-data-table', 'nx-drawer', 'nx-form', 'nx-grid', 'nx-loader', 'nx-menu', 'nx-menubar', 'nx-modal', 'nx-panel',
      'nx-progress', 'nx-select', 'nx-skeleton', 'nx-spinner', 'nx-tabpanel', 'nx-textfield', 'nx-toast', 'nx-toolbar',
      'nx-tree', 'nx-viewport'];
    return known.filter(tag => customElements.get(tag));
  }

  /**
   * Apply theme-specific styles
   */
  private static applyBaseStyles(): void {
    if (document.getElementById('nx-theme-styles')) return;
    const style = document.createElement('style');
    style.id = 'nx-theme-styles';
    style.textContent = this.baseStyles();
    document.head.appendChild(style);
  }

  /**
   * Get theme-specific CSS
   */
  /** Theme-independent base styles and token aliases. */
  static baseStyles(): string {

    return `
      /* Design tokens: component-facing aliases of the theme colors.
         :where() keeps specificity at zero so apps can override anything. */
      :where(:root) {
        --font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        --transition-duration: 150ms;
        --transition-easing: cubic-bezier(0.4, 0, 0.2, 1);

        --color-danger: var(--color-error);

        /* Status colors as *text* (badges, deltas, error messages): pulled toward
           the text color so they keep 4.5:1 contrast on their own tints, in any theme */
        --color-success-text: color-mix(in srgb, var(--color-success) 65%, var(--color-text));
        --color-warning-text: color-mix(in srgb, var(--color-warning) 65%, var(--color-text));
        --color-error-text: color-mix(in srgb, var(--color-error) 65%, var(--color-text));
        --color-info-text: color-mix(in srgb, var(--color-info) 65%, var(--color-text));
        --bg-color: var(--color-background);
        --surface-color: var(--color-surface);
        --border-color: var(--color-border);
        --text-color: var(--color-text);
        --text-color-secondary: var(--color-text-secondary);
        --hover-bg: var(--color-accent);
        --active-bg: var(--color-muted);
        --selected-bg: var(--color-accent);
        --selected-color: var(--color-text);
        --modal-bg: var(--color-surface);
        --modal-shadow: var(--shadow-xl);
        --drawer-bg: var(--color-surface);
        --drawer-shadow: var(--shadow-xl);
        --skeleton-base: var(--color-muted);
        --spinner-color: var(--color-primary);
        --spinner-track-color: var(--color-muted);
        --loader-color: var(--color-primary);
        --progress-color: var(--color-primary);
        --progress-bg: var(--color-muted);
        --nx-grid-border: var(--color-border);
        --nx-grid-header-bg: var(--color-muted);
        --nx-grid-row-hover: var(--color-accent);
        --nx-grid-row-selected: var(--color-accent);
      }

      :where(html, body) {
        margin: 0;
        height: 100%;
      }

      :where(body) {
        font-family: var(--font-family);
        font-size: 14px;
        line-height: 1.5;
        background: var(--color-background);
        color: var(--color-text);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* Scrollbars */
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }

      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 9999px;
        border: 2px solid transparent;
        background-clip: content-box;
      }

      ::-webkit-scrollbar-thumb:hover {
        background-color: var(--color-text-secondary);
      }

      ::selection {
        background: color-mix(in srgb, var(--color-info) 30%, transparent);
      }

      :focus-visible {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
      }

      ::placeholder {
        color: var(--color-text-secondary);
        opacity: 0.8;
      }

      code, pre {
        font-family: var(--font-mono);
        background: var(--color-muted);
        border-radius: var(--radius-sm);
      }

      code {
        padding: 0.125rem 0.375rem;
        font-size: 0.875em;
      }

      a {
        color: inherit;
        text-underline-offset: 4px;
      }

      /* Responsive helpers (outer styles beat :host, so these always apply) */
      @media (min-width: 769px) {
        .nx-mobile-only { display: none !important; }
      }

      @media (max-width: 768px) {
        .nx-desktop-only { display: none !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
  }

  /**
   * Get current theme name
   */
  static get current(): string {
    return this.currentTheme;
  }

  /**
   * Get current theme config
   */
  static getCurrentTheme(): ThemeConfig | undefined {
    return this.themes.get(this.currentTheme);
  }

  /**
   * Get all available themes
   */
  static getThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Toggle between light and dark themes
   */
  static toggle(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Cycle through all themes
   */
  static cycle(): void {
    const themes = this.getThemes();
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  /**
   * Subscribe to theme changes
   */
  static subscribe(listener: (theme: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Create a theme from a base theme
   */
  static createTheme(
    name: string,
    base: string,
    overrides: Partial<Omit<ThemeConfig, 'colors'>> & { colors?: Partial<ThemeColors> } = {}
  ): ThemeConfig | null {
    const baseTheme = this.themes.get(base);
    if (!baseTheme) {
      console.warn(`Base theme "${base}" not found`);
      return null;
    }

    const newTheme: ThemeConfig = {
      ...baseTheme,
      name,
      colors: { ...baseTheme.colors, ...(overrides.colors || {}) },
      spacing: baseTheme.spacing || overrides.spacing
        ? { ...(baseTheme.spacing || {}), ...(overrides.spacing || {}) } as ThemeSpacing
        : undefined,
      radius: baseTheme.radius || overrides.radius
        ? { ...(baseTheme.radius || {}), ...(overrides.radius || {}) } as ThemeRadius
        : undefined,
      shadow: baseTheme.shadow || overrides.shadow
        ? { ...(baseTheme.shadow || {}), ...(overrides.shadow || {}) } as ThemeShadow
        : undefined,
      fontFamily: overrides.fontFamily || baseTheme.fontFamily,
      customProperties: { ...baseTheme.customProperties, ...(overrides.customProperties || {}) }
    };

    this.registerTheme(newTheme);
    return newTheme;
  }

  /**
   * Convert camelCase to kebab-case
   */
  private static kebabCase(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Get CSS custom property value
   */
  static getCSSVariable(name: string): string {
    return getComputedStyle(this.root).getPropertyValue(name).trim();
  }

  /**
   * Set CSS custom property
   */
  static setCSSVariable(name: string, value: string): void {
    this.root.style.setProperty(name, value);
  }

  /**
   * Export theme as CSS
   */
  static exportThemeCSS(themeName: string): string | null {
    const theme = this.themes.get(themeName);
    if (!theme) return null;

    const lines: string[] = [`/* Nexaro Theme: ${theme.name} */`];
    lines.push(`[data-theme="${theme.name}"] {`);

    // Colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      lines.push(`  --color-${this.kebabCase(key)}: ${value};`);
    });

    // Spacing
    if (theme.spacing) {
      Object.entries(theme.spacing).forEach(([key, value]) => {
        lines.push(`  --spacing-${key}: ${value};`);
      });
    }

    // Radius
    if (theme.radius) {
      Object.entries(theme.radius).forEach(([key, value]) => {
        lines.push(`  --radius-${key}: ${value};`);
      });
    }

    // Shadows
    if (theme.shadow) {
      Object.entries(theme.shadow).forEach(([key, value]) => {
        lines.push(`  --shadow-${key}: ${value};`);
      });
    }

    // Custom properties
    if (theme.customProperties) {
      Object.entries(theme.customProperties).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value};`);
      });
    }

    lines.push('}');
    return lines.join('\n');
  }
}

// Initialize on load
// Initialize right away so design tokens exist before the first component renders
if (typeof window !== 'undefined') {
  ThemeManager.initialize();
}
