/**
 * Nexaro — declarative web components.
 *
 * ```typescript
 * import { NX } from 'nx.js';
 *
 * NX.app({
 *   title: 'My App',
 *   items: [
 *     { xtype: 'toolbar', region: 'north', title: 'My App' },
 *     { xtype: 'panel', title: 'Hello', html: '<p>It works.</p>' }
 *   ]
 * });
 * ```
 */

// Defines every <nx-*> element
import '@/components';

export { NX, NXApplication } from '@/app';
export type { ApplicationConfig, LayoutConfig, Plugin } from '@/app';

// JSX — write UIs like HTML (set "jsxImportSource": "nx.js" in tsconfig)
export { jsx, jsxs, h, Fragment, cn } from '@/jsx/jsx-runtime';
export type { BaseProps, KnownProps, LooseProps, ElementProps, StyleObject, Child, ClassValue, Ref, Component } from '@/jsx/jsx-runtime';
export * from '@/jsx/components';
export type { Props, ContainerConfig, MenuConfig, TabProps } from '@/jsx/components';
export { variants } from '@/core/variants';
export type { VariantProps, VariantsConfig } from '@/core/variants';

// Core
export { BaseComponent, escapeHTML, toKebab, eventName } from '@/components/abstracts/base';
export type { ComponentConfig as BaseComponentConfig } from '@/components/abstracts/base';
export { ComponentRegistry, define } from '@/core/registry';
export type { ComponentConfig, ItemConfig, ItemsAware } from '@/core/registry';
export { ThemeManager } from '@/core/theme';
export type { ThemeConfig, ThemeColors } from '@/core/theme';
export { Icons, icon } from '@/core/icons';
export { Router } from '@/core/router';
export type { Route, RouteConfig, RouterConfig } from '@/core/router';

// Data
export { Store, createStore } from '@/data/store';
export type { StoreConfig, StoreRecord, ProxyConfig, Sorter, Filter } from '@/data/store';
export { NXGrid, NXDataTable } from '@/data/grid';
export type { GridColumn, GridConfig, BadgeTone } from '@/data/grid';

// Layout
export { NXContainer, NXSpacer, NXSeparator, NXDivider } from '@/layout/container';
export { NXPanel } from '@/layout/panel';
export type { PanelConfig } from '@/layout/panel';
export { NXViewport, NXRegion } from '@/layout/viewport';

// UI
export { NXAccordion, NXAccordionItem } from '@/components/ui/accordion';
export type { AccordionConfig, AccordionItem as AccordionItemConfig } from '@/components/ui/accordion';
export { NXBreadcrumb } from '@/components/ui/breadcrumb';
export { NXBadge } from '@/components/ui/badge';
export type { BadgeConfig } from '@/components/ui/badge';
export { NXButton } from '@/components/ui/button';
export type { ButtonConfig } from '@/components/ui/button';
export { NXCard } from '@/components/ui/card';
export { NXDrawer } from '@/components/ui/drawer';
export type { DrawerConfig } from '@/components/ui/drawer';
export { NXLoader } from '@/components/ui/loader';
export { NXMenu, NXMenuPopup, showMenu } from '@/components/ui/menu';
export type { MenuItem, MenuItemLike, MenuOpenOptions } from '@/components/ui/menu';
export { NXMenuBar } from '@/components/ui/menubar';
export { NXModal, dialog, alert, confirm, prompt } from '@/components/ui/modal';
export type { ModalConfig, ModalButton } from '@/components/ui/modal';
export { NXProgress } from '@/components/ui/progress';
export { NXSkeleton } from '@/components/ui/skeleton';
export { NXSpinner } from '@/components/ui/spinner';
export { NXTabPanel, NXTab } from '@/components/ui/tabpanel';
export type { TabConfig } from '@/components/ui/tabpanel';
export { NXToast, toast } from '@/components/ui/toast';
export type { ToastOptions, ToastType } from '@/components/ui/toast';
export { NXToolbar } from '@/components/ui/toolbar';
export { NXTree } from '@/components/ui/tree';
export type { TreeNode } from '@/components/ui/tree';

// Forms
export { NXForm } from '@/components/ui/form';
export type { FormConfig } from '@/components/ui/form';
export { NXField } from '@/components/ui/form/field';
export type { FieldConfig, Validator } from '@/components/ui/form/field';
export { NXTextField } from '@/components/ui/form/textfield';
export type { TextFieldConfig } from '@/components/ui/form/textfield';
export { NXSelect } from '@/components/ui/form/select';
export type { SelectConfig, SelectOption } from '@/components/ui/form/select';
export { NXCheckbox } from '@/components/ui/form/checkbox';
export type { CheckboxConfig } from '@/components/ui/form/checkbox';
