import { describe, it, expect } from 'vitest';
import { NX, ThemeManager } from '@/index';

describe('theme', () => {
  it('switches themes and exposes tokens', () => {
    NX.theme.set('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#fafafa');
    NX.theme.toggle();
    expect(NX.theme.get()).toBe('light');
  });

  it('extends a theme with partial colors', () => {
    const brand = NX.theme.extend('brand-test', 'light', { colors: { primary: '#7c3aed' } });
    expect(brand?.colors.primary).toBe('#7c3aed');
    expect(brand?.colors.background).toBe('#ffffff');
    NX.theme.set('brand-test');
    expect(ThemeManager.current).toBe('brand-test');
  });

  it('injects design tokens once', () => {
    expect(document.querySelectorAll('#nx-theme-styles')).toHaveLength(1);
    expect(document.getElementById('nx-theme-styles')!.textContent).toContain('--surface-color');
  });
});
