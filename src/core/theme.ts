// src/core/theme.ts

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
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
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    secondary: '#8b5cf6',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
};

const darkTheme: ThemeConfig = {
  name: 'dark',
  colors: {
    primary: '#60a5fa',
    primaryDark: '#3b82f6',
    secondary: '#a78bfa',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
    error: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#60a5fa'
  }
};

const midnightTheme: ThemeConfig = {
  name: 'midnight',
  colors: {
    primary: '#818cf8',
    primaryDark: '#6366f1',
    secondary: '#f472b6',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155',
    error: '#fb7185',
    success: '#4ade80',
    warning: '#facc15',
    info: '#38bdf8'
  }
};

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
  private static mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private static listeners: Set<(theme: string) => void> = new Set();

  /**
   * Initialize theme manager
   */
  static initialize(): void {
    // Load saved theme or use system preference
    const savedTheme = localStorage.getItem('nx-theme');
    const systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
    
    this.setTheme(savedTheme || systemTheme);

    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem('nx-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
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
  static setTheme(themeName: string): void {
    const theme = this.themes.get(themeName);
    if (!theme) {
      console.warn(`Theme "${themeName}" not found`);
      return;
    }

    this.currentTheme = themeName;
    this.applyTheme(theme);
    
    // Save preference
    localStorage.setItem('nx-theme', themeName);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(themeName));
  }

  /**
   * Apply theme to DOM
   */
  private static applyTheme(theme: ThemeConfig): void {
    // Set theme attribute
    this.root.setAttribute('data-theme', theme.name);

    // Apply colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--color-${this.kebabCase(key)}`;
      this.root.style.setProperty(cssVar, value);
    });

    // Apply spacing
    if (theme.spacing) {
      Object.entries(theme.spacing).forEach(([key, value]) => {
        this.root.style.setProperty(`--spacing-${key}`, value);
      });
    } else {
      // Default spacing
      this.root.style.setProperty('--spacing-xs', '0.25rem');
      this.root.style.setProperty('--spacing-sm', '0.5rem');
      this.root.style.setProperty('--spacing-md', '1rem');
      this.root.style.setProperty('--spacing-lg', '1.5rem');
      this.root.style.setProperty('--spacing-xl', '2rem');
    }

    // Apply radius
    if (theme.radius) {
      Object.entries(theme.radius).forEach(([key, value]) => {
        this.root.style.setProperty(`--radius-${key}`, value);
      });
    } else {
      // Default radius
      this.root.style.setProperty('--radius-sm', '0.25rem');
      this.root.style.setProperty('--radius-md', '0.375rem');
      this.root.style.setProperty('--radius-lg', '0.5rem');
      this.root.style.setProperty('--radius-xl', '0.75rem');
      this.root.style.setProperty('--radius-full', '9999px');
    }

    // Apply shadows
    if (theme.shadow) {
      Object.entries(theme.shadow).forEach(([key, value]) => {
        this.root.style.setProperty(`--shadow-${key}`, value);
      });
    } else {
      // Default shadows
      this.root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgb(0 0 0 / 0.05)');
      this.root.style.setProperty('--shadow-md', '0 4px 6px -1px rgb(0 0 0 / 0.1)');
      this.root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgb(0 0 0 / 0.1)');
      this.root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgb(0 0 0 / 0.1)');
    }

    // Apply font family
    if (theme.fontFamily) {
      this.root.style.setProperty('--font-family', theme.fontFamily);
    }

    // Apply custom properties
    if (theme.customProperties) {
      Object.entries(theme.customProperties).forEach(([key, value]) => {
        this.root.style.setProperty(key, value);
      });
    }

    // Apply additional theme-specific styles
    this.applyThemeStyles(theme.name);
  }

  /**
   * Apply theme-specific styles
   */
  private static applyThemeStyles(themeName: string): void {
    // Remove existing theme styles
    const existingStyle = document.getElementById('nx-theme-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add new theme styles
    const style = document.createElement('style');
    style.id = 'nx-theme-styles';
    
    const styles = this.getThemeStyles(themeName);
    style.textContent = styles;
    
    document.head.appendChild(style);
  }

  /**
   * Get theme-specific CSS
   */
  private static getThemeStyles(themeName: string): string {
    const isDark = themeName === 'dark' || themeName === 'midnight';

    return `
      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }

      ::-webkit-scrollbar-track {
        background: var(--color-background);
      }

      ::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: var(--radius-md);
        border: 3px solid var(--color-background);
      }

      ::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-secondary);
      }

      /* Selection colors */
      ::selection {
        background: var(--color-primary);
        color: white;
      }

      /* Focus styles */
      :focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      /* Form input styles */
      input, textarea, select {
        background: var(--color-surface);
        color: var(--color-text);
        border-color: var(--color-border);
      }

      /* Placeholder text */
      ::placeholder {
        color: var(--color-text-secondary);
        opacity: 0.8;
      }

      /* Disabled elements */
      :disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Code blocks */
      code, pre {
        background: ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)'};
        border-radius: var(--radius-sm);
      }

      /* Links */
      a {
        color: var(--color-primary);
      }

      a:hover {
        color: var(--color-primary-dark);
      }

      /* Animations */
      @media (prefers-reduced-motion: no-preference) {
        * {
          scroll-behavior: smooth;
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
  static createTheme(name: string, base: string, overrides: Partial<ThemeConfig>): ThemeConfig | null {
    const baseTheme = this.themes.get(base);
    if (!baseTheme) {
      console.warn(`Base theme "${base}" not found`);
      return null;
    }

    const newTheme: ThemeConfig = {
      ...baseTheme,
      name,
      colors: { ...baseTheme.colors, ...(overrides.colors || {}) },
      spacing: { ...baseTheme.spacing, ...(overrides.spacing || {}) },
      radius: { ...baseTheme.radius, ...(overrides.radius || {}) },
      shadow: { ...baseTheme.shadow, ...(overrides.shadow || {}) },
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
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.initialize());
  } else {
    ThemeManager.initialize();
  }
}
