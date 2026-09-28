# Building apps

[`src/main.tsx`](../src/main.tsx) is a complete example of everything on this page (`pnpm dev`).

## App shell and routing

`NX.app()` builds a full-screen border layout. Put children in regions with `region="north" | "south" | "west" | "east" | "center"`; children without a region go to the center.

```tsx
const app = NX.app({
  el: '#app',                 // default: document.body
  title: 'Admin',             // document title; route titles become "Users · Admin"
  theme: 'dark',              // default theme; a theme the user picked wins
  stores: { users: { data } },

  items: [
    <Toolbar region="north">
      <Button icon="menu" tooltip="Menu" class="nx-mobile-only" onClick={() => app.toggleRegion('west')} />
      <strong>Admin</strong>
      <Spacer />
      <Button icon="moon" tooltip="Toggle theme" onClick={() => NX.theme.toggle()} />
    </Toolbar>,
    <Panel region="west" width={240}>
      <Tree data={[{ text: 'Home', icon: 'home', route: '/' }, { text: 'Users', icon: 'users', route: '/users' }]} />
    </Panel>,
    <Outlet region="center" />
  ],

  router: [
    { path: '/', view: () => <HomePage /> },
    { path: '/users/:id', title: 'User', view: route => <UserPage id={route.params.id} /> }, // may be async
    { path: '*', view: () => <p>Not found</p> }
  ],
  ready: app => {}
});

app.navigate('/users/42');
app.toggleRegion('west');   // open the side nav on phones, collapse a collapsible panel on desktop
```

- Routes render their `view` into the `<Outlet />`.
- Tree nodes with a `route` navigate when selected, and the tree highlights the node for the current route.
- Below 768px (`breakpoint`), `west`/`east` regions become off-canvas drawers. `class="nx-mobile-only"` and `"nx-desktop-only"` show things per screen size.

## Layout

```tsx
<HStack gap={8} align="center">…</HStack>                   // row
<VStack gap={16} padding={24}>…</VStack>                     // column
<Grid columns={3} gap={16}>…</Grid>                          // fixed grid
<Grid minColumnWidth={240} gap={16}>…</Grid>                 // responsive grid
<Panel title="Details" icon="file" collapsible closable bodyPadding={0}>…</Panel>
<Card title="Revenue" subtitle="Last 30 days" icon="chart">…</Card>
```

`align` (`start` `center` `end` `stretch` `baseline`) and `pack` (`start` `center` `end` `between` `around` `evenly`) map to flexbox alignment. The config equivalents are `{ xtype: 'hbox' | 'vbox' | 'container', layout: 'grid', … }`.

## Data grid

```ts
{
  xtype: 'grid',
  title: 'Users',
  store: 'users',              // a registered store name or a Store; or use `data: [...]`
  search: true,                // quick filter across columns
  pageSize: 20,
  checkboxSelection: true,     // or selectable: 'single' | 'multiple'
  striped: true, dense: false,
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'address.city', header: 'City' },                  // dot paths
    { field: 'role', header: 'Role', type: 'badge', badges: { Admin: 'info', Banned: 'error' } },
    { field: 'revenue', header: 'Revenue', type: 'currency', width: 120 }, // number | currency | percent | date | boolean
    { field: 'name', header: '', sortable: false, width: 90,
      renderer: (v, row) => <Button size="sm" variant="ghost" onClick={() => open(row)}>Open</Button> }
      // renderer returns JSX (or an HTML string you escape yourself); formatter returns text
  ],
  onRowClick: e => console.log(e.detail.row),
  onSelectionChange: e => console.log(e.detail.selected)
}
```

- API: `getSelected()`, `select(rows)`, `selectAll()`, `clearSelection()`, `sort(field, dir)`, `setFilter(text)`, `setPage(n)`, `setData(rows)`, `exportCSV(filename)`.
- Events: `row-click`, `row-dblclick`, `selection-change`, `sort-change`.
- Clicks on buttons, links and inputs inside cells don't select the row. Sortable headers are buttons, so sorting works from the keyboard.
- Cell values are always escaped. Only a `renderer` that returns an HTML string bypasses that.

## Stores

Stores hold records and notify the components bound to them:

```ts
const users = NX.store('users', { data: [...] });   // create and register
NX.store('users').add({ name: 'Ada' });             // look up and add; bound grids update
users.remove(users.getRange().filter(r => r.data.banned));
users.sort({ property: 'name', direction: 'ASC' });

// Remote data
NX.store('orders', { proxy: { type: 'rest', url: '/api/orders' }, autoLoad: true });
```

## Dialogs and toasts

The helpers return promises:

```ts
await NX.alert('Saved.');
if (await NX.confirm('Delete 3 users?', { title: 'Are you sure?', confirmText: 'Delete', danger: true })) { … }
const name = await NX.prompt('Project name', { defaultValue: 'Untitled' });   // null when cancelled

const values = await NX.dialog({
  title: 'Invite',
  description: 'They will get an email.',
  size: 'md',                                 // sm | md | lg | xl | full
  items: [{ xtype: 'form', id: 'invite', items: [...] }],
  buttons: [
    { text: 'Cancel', variant: 'outline' },
    { text: 'Send', variant: 'primary', handler: modal => {
        const v = NX.get('invite').submit();
        if (v) modal.close(v);
        return false;                          // false keeps the dialog open
    } }
  ]
});
```

For a dialog written in JSX, keep a ref and call `open()` / `close()`:

```tsx
const dialog = { current: null as NXModal | null };

<Dialog ref={dialog} title="Archive project?" description="You can restore it within 30 days.">
  <DialogFooter>
    <Button variant="outline" onClick={() => dialog.current?.close()}>Cancel</Button>
    <Button variant="danger" onClick={archive}>Archive</Button>
  </DialogFooter>
</Dialog>
```

Dialogs and drawers use the native `<dialog>` element, so focus trapping, Escape handling and the inert background come from the browser. Menus, popovers and comboboxes opened inside a dialog still work.

```ts
NX.toast('Event created', { description: 'Sunday at 9:00' });
NX.toast.success('Saved');
NX.toast.warning('Your trial ends in 3 days');
NX.toast.error('Upload failed', { action: { text: 'Retry', handler: retry }, duration: 0 });
```

## Menus

```tsx
<Menu text="Actions" items={[
  { text: 'Edit', icon: 'edit', shortcut: '⌘E', handler: edit },
  { text: 'Share', items: [{ text: 'Email' }, { text: 'Copy link' }] },   // submenu
  '-',
  { heading: 'Danger zone' },
  { text: 'Delete', icon: 'trash', danger: true, handler: remove }
]} />

<Button variant="outline" menu={[{ text: 'CSV' }, { text: 'JSON' }]}>Export</Button>

<div onContextMenu={e => { e.preventDefault(); NX.menu([{ text: 'Copy' }, { text: 'Paste' }], e); }} />

<MenuBar items={[{ text: 'File', items: [...] }, { text: 'Edit', items: [...] }]} />
```

Menus render in the browser's top layer, so `overflow: hidden` containers never clip them. They flip when there is no room, and support full keyboard navigation and type-ahead. Item options include `checked`, `disabled` and `href`.

## Command palette

A searchable list of actions: shadcn's Command, and the familiar ⌘K dialog.

```ts
const commands = () => [
  { text: 'Dashboard', icon: 'dashboard', group: 'Go to', handler: () => app.navigate('/') },
  { text: 'Settings', icon: 'settings', group: 'Go to', keywords: ['preferences'], handler: () => app.navigate('/settings') },
  { text: 'Toggle theme', icon: 'theme', group: 'Actions', shortcut: '⇧D', handler: () => NX.theme.toggle() }
];

NX.command.bind('mod+k', commands);        // ⌘K on macOS, Ctrl+K elsewhere; returns an unbind function
const item = await NX.command(commands()); // open it yourself; resolves with the item, or null
```

Results rank by prefix, then word start, then substring, then `keywords`, then letters in order, and stay grouped. For an inline list, use `<Command items={…} />`, which emits `select`.

## Icons

About 60 icons are built in, all 24px stroke icons: `menu`, `close`, `plus`, `trash`, `edit`, `save`, `search`, `settings`, `users`, `dashboard`, `mail`, `bell`, `sun`, `moon`, `check`, the chevrons, `info`, `success`, `warning`, `error` and more. `NX.icons.names()` lists them all.

```ts
NX.icons.register('rocket', '<path d="…"/>');   // inner markup of a 24×24 stroke icon, or a full <svg>
<Button icon="rocket">Launch</Button>
<Button icon="<svg>…</svg>" />                    // raw SVG works anywhere too
```
