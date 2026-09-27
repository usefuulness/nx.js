/**
 * @file @/jsx/components.tsx
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * shadcn-style JSX components. Each is a thin, typed wrapper around an
 * `<nx-*>` element, so you can write UIs like HTML:
 *
 * ```tsx
 * import { Button, Card, CardFooter, Input } from 'nx.js';
 *
 * <Card title="Create project" subtitle="Deploy in one click.">
 *   <Input name="name" label="Name" placeholder="my-app" required />
 *   <CardFooter>
 *     <Button variant="outline">Cancel</Button>
 *     <Button onClick={deploy}>Deploy</Button>
 *   </CardFooter>
 * </Card>
 * ```
 *
 * Props are the same as the `{ xtype }` config keys, so everything in the
 * README's config docs applies. Children become the element's content.
 */
import type { Child, KnownProps, LooseProps } from '@/jsx/jsx-runtime';
import type { ButtonConfig } from '@/components/ui/button';
import type { BadgeConfig } from '@/components/ui/badge';
import type { CardConfig } from '@/components/ui/card';
import type { PanelConfig } from '@/layout/panel';
import type { ToolbarConfig } from '@/components/ui/toolbar';
import type { TabPanelConfig } from '@/components/ui/tabpanel';
import type { TreeConfig } from '@/components/ui/tree';
import type { GridConfig } from '@/data/grid';
import type { FormConfig } from '@/components/ui/form';
import type { RadioGroupConfig } from '@/components/ui/form/radio';
import type { TextFieldConfig } from '@/components/ui/form/textfield';
import type { SelectConfig } from '@/components/ui/form/select';
import type { CheckboxConfig } from '@/components/ui/form/checkbox';
import type { ModalConfig } from '@/components/ui/modal';
import type { MenuItemLike } from '@/components/ui/menu';
import type { ProgressConfig } from '@/components/ui/progress';
import type { AccordionConfig } from '@/components/ui/accordion';
import type { BreadcrumbConfig } from '@/components/ui/breadcrumb';
import type { DrawerConfig } from '@/components/ui/drawer';
import type { SpinnerConfig } from '@/components/ui/spinner';
import type { SkeletonConfig } from '@/components/ui/skeleton';
import type { ViewportConfig } from '@/layout/viewport';

/** Component props = config keys + common element props (class, style, onXxx, ref, children…). */
export type Props<C = {}, T extends HTMLElement = HTMLElement> = Omit<KnownProps<T>, keyof C> & C & {
  region?: 'north' | 'south' | 'east' | 'west' | 'center';
  flex?: number | string;
  cls?: string;
} & LooseProps;

export interface ContainerConfig {
  layout?: 'vbox' | 'hbox' | 'grid' | 'fit';
  gap?: number | string;
  padding?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  pack?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  /** grid layout: fixed column count */
  columns?: number;
  /** grid layout: responsive columns of at least this width */
  minColumnWidth?: number | string;
  scrollable?: boolean;
}

export interface MenuConfig {
  text?: string;
  icon?: string;
  variant?: ButtonConfig['variant'];
  size?: ButtonConfig['size'];
  placement?: 'bottom-start' | 'bottom-end';
  items?: MenuItemLike[];
}

export interface TabProps {
  title: string;
  icon?: string;
  closable?: boolean;
  disabled?: boolean;
  /** Initially selected */
  active?: boolean;
}

// ────────── Typed <nx-*> tags ──────────

declare module './jsx-runtime' {
  interface NexaroElements {
    'nx-button': Props<ButtonConfig>;
    'nx-badge': Props<BadgeConfig>;
    'nx-card': Props<CardConfig>;
    'nx-panel': Props<PanelConfig>;
    'nx-container': Props<ContainerConfig>;
    'nx-toolbar': Props<ToolbarConfig>;
    'nx-tabpanel': Props<TabPanelConfig>;
    'nx-tabs': Props<TabPanelConfig>;
    'nx-tab': Props<TabProps>;
    'nx-tree': Props<TreeConfig>;
    'nx-grid': Props<GridConfig>;
    'nx-form': Props<FormConfig>;
    'nx-textfield': Props<TextFieldConfig>;
    'nx-input': Props<TextFieldConfig>;
    'nx-textarea': Props<Omit<TextFieldConfig, 'multiline'>>;
    'nx-radio-group': Props<RadioGroupConfig>;
    'nx-select': Props<SelectConfig>;
    'nx-checkbox': Props<CheckboxConfig>;
    'nx-switch': Props<Omit<CheckboxConfig, 'switch'>>;
    'nx-modal': Props<ModalConfig>;
    'nx-dialog': Props<ModalConfig>;
    'nx-menu': Props<MenuConfig>;
    'nx-progress': Props<ProgressConfig>;
    'nx-accordion': Props<AccordionConfig>;
    'nx-drawer': Props<DrawerConfig>;
    'nx-spinner': Props<SpinnerConfig>;
    'nx-skeleton': Props<SkeletonConfig>;
    'nx-breadcrumb': Props<BreadcrumbConfig>;
    'nx-viewport': Props<ViewportConfig>;
  }
}

// ────────── Buttons & display ──────────

export const Button = (props: Props<ButtonConfig>) => <nx-button {...props} />;
export const Badge = (props: Props<BadgeConfig>) => <nx-badge {...props} />;
export const Spinner = (props: Props<SpinnerConfig>) => <nx-spinner {...props} />;
export const Skeleton = (props: Props<SkeletonConfig>) => <nx-skeleton {...props} />;
export const Progress = (props: Props<ProgressConfig>) => <nx-progress {...props} />;

// ────────── Layout ──────────

/** Flex / grid box. `<Box layout="grid" columns={3} gap={16}>` */
export const Box = (props: Props<ContainerConfig>) => <nx-container {...props} />;
/** Horizontal stack */
export const HStack = (props: Props<Omit<ContainerConfig, 'layout'>>) => <nx-container layout="hbox" {...props} />;
/** Vertical stack */
export const VStack = (props: Props<Omit<ContainerConfig, 'layout'>>) => <nx-container layout="vbox" {...props} />;
/** CSS grid. Give `columns` or `minColumnWidth`. */
export const Grid = (props: Props<Omit<ContainerConfig, 'layout'>>) => <nx-container layout="grid" {...props} />;
export const Spacer = (props: Props) => <nx-spacer {...props} />;
export const Separator = (props: Props) => <nx-separator {...props} />;
export const Divider = (props: Props<{ label?: string }>) => <nx-divider {...props} />;
export const Panel = (props: Props<PanelConfig>) => <nx-panel {...props} />;
export const Toolbar = (props: Props<ToolbarConfig>) => <nx-toolbar {...props} />;
export const Viewport = (props: Props<ViewportConfig>) => <nx-viewport {...props} />;
/** Router outlet: routes render here. */
export const Outlet = (props: Props) => <nx-outlet {...props} />;

// ────────── Card ──────────

export const Card = (props: Props<CardConfig>) => <nx-card {...props} />;
/** Right-aligned actions at the bottom of a card */
export const CardFooter = ({ children, ...rest }: Props<{}, HTMLDivElement>) => <div slot="footer" style="display: contents" {...rest}>{children}</div>;
/** Actions in the card header, next to the title */
export const CardActions = ({ children, ...rest }: Props<{}, HTMLDivElement>) => <div slot="header-actions" style="display: flex; gap: 0.25rem" {...rest}>{children}</div>;

// ────────── Navigation ──────────

export const Tabs = (props: Props<TabPanelConfig>) => <nx-tabs {...props} />;
export const Tab = (props: Props<TabProps>) => <nx-tab {...props} />;
export const Tree = (props: Props<TreeConfig>) => <nx-tree {...props} />;
export const Menu = (props: Props<MenuConfig>) => <nx-menu {...props} />;
export const MenuBar = (props: Props<{ items?: MenuItemLike[] }>) => <nx-menubar {...props} />;
export const Breadcrumb = (props: Props<BreadcrumbConfig>) => <nx-breadcrumb {...props} />;
export const Accordion = (props: Props<AccordionConfig>) => <nx-accordion {...props} />;
export const AccordionItem = (props: Props<{ title: string; expanded?: boolean; disabled?: boolean }>) => <nx-accordion-item {...props} />;
/** Slide-in panel (shadcn's Sheet). Open it with a ref: `drawer.open()`. */
export const Drawer = (props: Props<DrawerConfig>) => <nx-drawer {...props} />;
export const DrawerFooter = ({ children, ...rest }: Props<{}, HTMLDivElement>) => <div slot="footer" style="display: contents" {...rest}>{children}</div>;

// ────────── Data ──────────

export const DataGrid = <T extends Record<string, any>>(props: Props<GridConfig<T>>) => <nx-grid {...props} />;
/** Alias of DataGrid (shadcn naming) */
export const DataTable = DataGrid;

// ────────── Forms ──────────

export const Form = (props: Props<FormConfig>) => <nx-form {...props} />;
export const Input = (props: Props<TextFieldConfig>) => <nx-input {...props} />;
export const Textarea = (props: Props<Omit<TextFieldConfig, 'multiline'>>) => <nx-textarea {...props} />;
export const Select = (props: Props<SelectConfig>) => <nx-select {...props} />;
export const Checkbox = (props: Props<CheckboxConfig>) => <nx-checkbox {...props} />;
export const Switch = (props: Props<Omit<CheckboxConfig, 'switch'>>) => <nx-switch {...props} />;
export const RadioGroup = (props: Props<RadioGroupConfig>) => <nx-radio-group {...props} />;

// ────────── Overlays ──────────

/**
 * Declarative dialog. Open it with a ref: `<Dialog ref={d => (dialog = d)} title="…">…</Dialog>`
 * then `dialog.open()`. For one-off dialogs prefer `NX.dialog()` / `NX.confirm()`.
 */
export const Dialog = (props: Props<Omit<ModalConfig, 'items' | 'html'>>) => <nx-dialog {...props} />;
export const DialogFooter = ({ children, ...rest }: Props<{}, HTMLDivElement>) => <div slot="footer" style="display: contents" {...rest}>{children}</div>;

// ────────── Helpers ──────────

/** Render children only when `when` is truthy. `{cond && …}` works too. */
export const Show = ({ when, children, fallback }: { when: unknown; children?: Child; fallback?: Child }): Node => {
  const fragment = document.createDocumentFragment();
  const content = when ? children : fallback;
  (Array.isArray(content) ? content : [content]).forEach(c => {
    if (c instanceof Node) fragment.append(c);
    else if (c !== null && c !== undefined && c !== false && c !== true) fragment.append(String(c));
  });
  return fragment;
};
