/**
 * @file @/core/variants.ts
 *
 * `variants()` — a tiny class-variance-authority: map props to class names.
 *
 * ```tsx
 * const button = variants({
 *   base: 'btn',
 *   variants: {
 *     variant: { primary: 'btn-primary', outline: 'btn-outline' },
 *     size: { sm: 'btn-sm', md: '', lg: 'btn-lg' }
 *   },
 *   compoundVariants: [{ variant: 'outline', size: 'sm', class: 'btn-outline-sm' }],
 *   defaultVariants: { variant: 'primary', size: 'md' }
 * });
 *
 * <button class={button({ variant: 'outline' })} />   // "btn btn-outline"
 * ```
 */
import { cn, type ClassValue } from '@/jsx/jsx-runtime';

type VariantMap = Record<string, Record<string, ClassValue>>;

/** A variant value; `true`/`false` keys also accept real booleans (like cva). */
type VariantValue<O> = keyof O | ('true' extends keyof O ? boolean : never) | ('false' extends keyof O ? boolean : never);

export interface VariantsConfig<V extends VariantMap> {
  base?: ClassValue;
  variants?: V;
  compoundVariants?: Array<{ [K in keyof V]?: VariantValue<V[K]> | Array<VariantValue<V[K]>> } & { class?: ClassValue }>;
  defaultVariants?: { [K in keyof V]?: VariantValue<V[K]> };
}

export type VariantProps<F> = F extends (props?: infer P) => string ? NonNullable<P> : never;

export function variants<V extends VariantMap>(config: VariantsConfig<V>) {
  return (props: { [K in keyof V]?: VariantValue<V[K]> | null } & { class?: ClassValue } = {}): string => {
    const selected: Record<string, unknown> = { ...config.defaultVariants };
    Object.entries(props).forEach(([k, v]) => {
      if (v !== undefined && v !== null && k !== 'class') selected[k] = v;
    });

    const classes: ClassValue[] = [config.base];
    Object.entries(config.variants ?? {}).forEach(([name, options]) => {
      const value = selected[name];
      if (value !== undefined) classes.push(options[String(value)]);
    });
    (config.compoundVariants ?? []).forEach(({ class: cls, ...conditions }) => {
      const match = Object.entries(conditions).every(([k, v]) =>
        Array.isArray(v) ? v.map(String).includes(String(selected[k])) : String(selected[k]) === String(v)
      );
      if (match) classes.push(cls);
    });
    classes.push(props.class);
    return cn(...classes);
  };
}

export { cn };
