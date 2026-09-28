/**
 * Demo app — `pnpm dev`. Written the way apps are meant to be written:
 * JSX that reads like HTML, shadcn-style components, and the public API only.
 */
import {
  NX, Badge, Box, Button, Card, CardActions, CardFooter, Checkbox, Combobox, DataGrid, Form, Grid, HStack,
  Input, Menu, Outlet, Panel, Popover, PopoverTrigger, Progress, RadioGroup, Select, Spacer, Switch, Tab, Tabs, Textarea, Toolbar, Tooltip, Tree,
  VStack, type Child, type GridColumn, type NXGrid, type NXForm
} from '@/index';

// ────────── Sample data ──────────

type User = { id: number; name: string; email: string; role: string; status: string; revenue: number; joined: string };

const roles = ['Admin', 'Editor', 'Viewer'];
const statuses = ['Active', 'Invited', 'Suspended'];
const firstNames = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara', 'Ken', 'Radia', 'Dennis', 'Frances', 'Tim', 'Hedy', 'John', 'Katherine', 'Guido', 'Anders'];
const lastNames = ['Lovelace', 'Hopper', 'Torvalds', 'Hamilton', 'Turing', 'Liskov', 'Thompson', 'Perlman', 'Ritchie', 'Allen', 'Berners-Lee', 'Lamarr', 'McCarthy', 'Johnson', 'van Rossum', 'Hejlsberg'];

const users: User[] = Array.from({ length: 48 }, (_, i) => {
  const first = firstNames[i % firstNames.length];
  const last = lastNames[(i * 7) % lastNames.length];
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
    role: roles[i % 3 === 0 ? 0 : i % 3],
    status: statuses[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0],
    revenue: Math.round(((i * 7919) % 9000) + 500),
    joined: new Date(2024, (i * 5) % 12, (i * 3) % 28 + 1).toISOString()
  };
});

const orders = Array.from({ length: 6 }, (_, i) => ({
  id: `#30${42 + i}`,
  customer: users[i * 5].name,
  total: [249, 1290, 89, 540, 72, 1999][i],
  status: ['Paid', 'Paid', 'Pending', 'Refunded', 'Paid', 'Pending'][i]
}));

// ────────── Small building blocks (plain function components) ──────────

const Page = ({ title, description, actions, children }: { title: string; description: string; actions?: Child; children?: Child }) => (
  <VStack gap={24} style="max-width: 1200px; margin: 0 auto; width: 100%; padding: clamp(1rem, 4vw, 2rem)">
    <HStack align="end" gap={12} wrap>
      <VStack flex="1 1 16rem" gap={4}>
        <h1 class="page-title">{title}</h1>
        <p class="muted">{description}</p>
      </VStack>
      {actions}
    </HStack>
    {children}
  </VStack>
);

const Stat = ({ label, value, delta, icon }: { label: string; value: string; delta: number; icon: string }) => (
  <Card>
    <div class="stat">
      <div class="stat-top">
        <span>{label}</span>
        <span html={NX.icons.get(icon)} />
      </div>
      <div class="stat-value">{value}</div>
      <div class={['stat-delta', delta >= 0 ? 'up' : 'down']}>
        {delta >= 0 ? '+' : ''}{delta}% <span>from last month</span>
      </div>
    </div>
  </Card>
);

// ────────── Pages ──────────

const DashboardPage = () => (
  <Page
    title="Dashboard"
    description="Everything at a glance."
    actions={
      <Button variant="outline" icon="download" onClick={() => NX.toast.success('Report exported', { description: 'dashboard-2025-06.csv' })}>
        Download
      </Button>
    }
  >
    <Grid minColumnWidth={220} gap={16}>
      <Stat label="Revenue" value="$45,231" delta={20.1} icon="dollar" />
      <Stat label="Customers" value="2,350" delta={18.2} icon="users" />
      <Stat label="Orders" value="12,234" delta={4.3} icon="cart" />
      <Stat label="Error rate" value="0.12%" delta={-2.4} icon="activity" />
    </Grid>

    <Grid columns={3} gap={16}>
      <DataGrid
        title="Recent orders"
        style="grid-column: span 2"
        data={orders}
        columns={[
          { field: 'id', header: 'Order', width: 90 },
          { field: 'customer', header: 'Customer' },
          { field: 'status', header: 'Status', type: 'badge', width: 110, badges: { Paid: 'success', Pending: 'warning', Refunded: 'neutral' } },
          { field: 'total', header: 'Total', type: 'currency', width: 110 }
        ]}
      />
      <Card title="Goals" subtitle="Q2 progress">
        <VStack gap={20}>
          {([['New customers', 72], ['Revenue target', 54], ['NPS survey', 91]] as const).map(([label, value]) => (
            <VStack gap={8}>
              <div class="goal"><span>{label}</span><span class="muted">{value}%</span></div>
              <Progress value={value} size="sm" />
            </VStack>
          ))}
        </VStack>
      </Card>
    </Grid>
  </Page>
);

const userColumns: GridColumn<User>[] = [
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'role', header: 'Role', type: 'badge', width: 110, badges: { Admin: 'info' } },
  { field: 'status', header: 'Status', type: 'badge', width: 120, badges: { Active: 'success', Invited: 'warning', Suspended: 'error' } },
  { field: 'revenue', header: 'Revenue', type: 'currency', width: 120 },
  { field: 'joined', header: 'Joined', type: 'date', width: 130 }
];

const UsersPage = () => {
  const grid = { current: null as NXGrid<User> | null };
  const deleteButton = { current: null as HTMLElement | null };

  async function addUser() {
    const form = { current: null as NXForm | null };
    const values = await NX.dialog({
      title: 'Add user',
      description: 'They will receive an invitation by email.',
      items: [
        <Form ref={form}>
          <Input name="name" label="Name" placeholder="Ada Lovelace" required />
          <Input name="email" type="email" label="Email" icon="mail" placeholder="ada@example.com" required />
          <Select name="role" label="Role" options={roles} value="Viewer" />
        </Form>
      ],
      buttons: [
        { text: 'Cancel', variant: 'outline' },
        {
          text: 'Invite',
          variant: 'primary',
          handler: modal => {
            const values = form.current!.submit();
            if (values) modal.close(values);
            return false; // stays open while invalid; errors are shown
          }
        }
      ]
    });
    if (!values) return;
    NX.store('users').add({ id: Date.now(), ...values, status: 'Invited', revenue: 0, joined: new Date().toISOString() });
    NX.toast.success(`Invited ${values.name}`, { description: values.email });
  }

  async function deleteSelected() {
    const selected = grid.current!.getSelected();
    if (!selected.length) return;
    const plural = selected.length > 1 ? 's' : '';
    const ok = await NX.confirm(`This will permanently remove ${selected.length} user${plural}.`, {
      title: 'Delete users?',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    const store = NX.store<User>('users');
    store.remove(store.getRange().filter(record => selected.includes(record.data)));
    NX.toast(`${selected.length} user${plural} deleted`, { action: { text: 'Undo', handler: () => store.add(selected) } });
  }

  return (
    <Page
      title="Users"
      description="Manage your team and their permissions."
      actions={
        <HStack gap={8}>
          <Menu icon="more" items={[
            { text: 'Export CSV', icon: 'download', handler: () => grid.current!.exportCSV('users.csv') },
            { text: 'Select all', icon: 'check', handler: () => grid.current!.selectAll() },
            { text: 'Clear selection', handler: () => grid.current!.clearSelection() }
          ]} />
          <Button ref={deleteButton} id="delete-users" variant="outline" icon="trash" disabled onClick={deleteSelected}>Delete</Button>
          <Button icon="plus" onClick={addUser}>Add user</Button>
        </HStack>
      }
    >
      <DataGrid
        ref={grid}
        id="users-grid"
        store="users"
        search
        pageSize={10}
        checkboxSelection
        columns={userColumns}
        onSelectionChange={(e: CustomEvent) => deleteButton.current!.toggleAttribute('disabled', !e.detail.selected.length)}
        onRowDblclick={(e: CustomEvent) => NX.alert(`${e.detail.row.name} <${e.detail.row.email}>`, { title: 'User' })}
      />
    </Page>
  );
};

const SettingsPage = () => (
  <Page title="Settings" description="Forms with validation — it's just markup.">
    <Card title="Profile" subtitle="This is how others will see you.">
      <Form
        columns={2}
        values={{ first: 'Ada', last: 'Lovelace', role: 'Admin', notifications: true }}
        onSubmit={(e: CustomEvent) => NX.toast.success('Profile saved', { description: JSON.stringify(e.detail.values).slice(0, 80) + '…' })}
        onInvalid={() => NX.toast.error('Please fix the highlighted fields')}
      >
        <Input name="first" label="First name" required />
        <Input name="last" label="Last name" required />
        <Input name="email" type="email" label="Email" icon="mail" placeholder="you@example.com" helperText="We never share it." required />
        <Select name="role" label="Role" options={roles} />
        <Input
          name="password" type="password" label="Password" minLength={8}
          validator={(v: string) => (v && !/\d/.test(v) ? 'Include at least one number' : undefined)}
        />
        <Input name="age" type="number" label="Age" min={0} max={150} />
        <Textarea name="bio" label="Bio" placeholder="Tell us a little about yourself" style="grid-column: 1 / -1" />
        <RadioGroup name="plan" label="Plan" value="pro" variant="cards" orientation="horizontal" style="grid-column: 1 / -1" options={[
          { value: 'free', text: 'Free', description: 'For side projects' },
          { value: 'pro', text: 'Pro', description: 'For growing teams' },
          { value: 'enterprise', text: 'Enterprise', description: 'SSO, audit logs, SLA' }
        ]} />
        <Switch name="notifications" label="Email notifications" description="Product updates and weekly digest." style="grid-column: 1 / -1" />
        <Checkbox name="terms" label="I accept the terms and conditions" required style="grid-column: 1 / -1" />

        <Button slot="buttons" type="reset" variant="ghost">Reset</Button>
        <Button slot="buttons" type="submit">Save changes</Button>
      </Form>
    </Card>
  </Page>
);

const ComponentsPage = () => (
  <Page title="Components" description="A quick tour.">
    <Card title="Buttons">
      <HStack gap={8} wrap align="center">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
        <nx-separator />
        <Button icon="send">With icon</Button>
        <Button icon="settings" variant="outline" tooltip="Settings" />
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button variant="outline" menu={[{ text: 'CSV', icon: 'file' }, { text: 'JSON', icon: 'code' }, '-', { text: 'Print…', shortcut: '⌘P' }]}>
          Export
        </Button>
      </HStack>
    </Card>

    <Grid minColumnWidth={320} gap={16}>
      <Card title="Feedback" subtitle="Promise-based dialogs and toasts.">
        <HStack gap={8} wrap>
          <Button variant="outline" onClick={() => NX.toast('Event has been created', { description: 'Sunday, December 03 at 9:00 AM' })}>Toast</Button>
          <Button variant="outline" onClick={() => NX.toast.success('Saved!')}>Success</Button>
          <Button variant="outline" onClick={() => NX.toast.error('Something went wrong', { action: { text: 'Retry', handler: () => NX.toast('Retrying…') } })}>Error</Button>
          <Button variant="outline" onClick={async () => NX.toast(`You chose: ${(await NX.confirm('Continue with this action?')) ? 'yes' : 'no'}`)}>Confirm</Button>
          <Button variant="outline" onClick={async () => { const name = await NX.prompt('What is your name?'); if (name) NX.toast(`Hello, ${name}!`); }}>Prompt</Button>
        </HStack>
      </Card>

      <Card title="Popover, tooltip, combobox" subtitle="Floating UI in the top layer.">
        <VStack gap={16}>
          <HStack gap={8} wrap>
            <Popover label="Dimensions">
              <PopoverTrigger><Button variant="outline" icon="layout">Dimensions</Button></PopoverTrigger>
              <VStack gap={12}>
                <strong>Dimensions</strong>
                <Input name="width" label="Width" value="100%" size="sm" />
                <Input name="height" label="Height" value="25px" size="sm" />
              </VStack>
            </Popover>
            <Tooltip content="Add to library">
              <Button variant="outline" icon="plus" aria-label="Add" />
            </Tooltip>
            <Tooltip content="Copies the link to your clipboard" placement="bottom">
              <Button variant="ghost" icon="copy">Copy link</Button>
            </Tooltip>
          </HStack>
          <Combobox name="framework" label="Framework" placeholder="Search frameworks…" options={[
            'Nexaro', 'Astro', 'Next.js', 'Nuxt', 'Remix', 'SvelteKit', 'Laravel', 'Django', 'Rails', 'Phoenix'
          ]} />
        </VStack>
      </Card>

      <Card title="Badges & menus">
        <VStack gap={16}>
          <HStack gap={8} wrap>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success" icon="check">Paid</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="destructive">Failed</Badge>
          </HStack>
          <HStack gap={8}>
            <Menu text="Actions" items={[
              { text: 'Edit', icon: 'edit', shortcut: '⌘E' },
              { text: 'Share', icon: 'send', items: [{ text: 'Email' }, { text: 'Copy link' }] },
              '-',
              { text: 'Delete', icon: 'trash', danger: true, handler: () => NX.toast.error('Deleted') }
            ]} />
            <Box
              padding={12}
              style="border: 1px dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-text-secondary); flex: 1"
              onContextMenu={(e: MouseEvent) => {
                e.preventDefault();
                NX.menu([{ text: 'Copy', icon: 'copy' }, { text: 'Paste' }, '-', { text: 'Inspect', icon: 'code' }], e);
              }}
            >
              Right-click me
            </Box>
          </HStack>
        </VStack>
      </Card>

      <Card title="Tabs" padding={false}>
        <Tabs>
          <Tab title="Account" icon="user"><p style="margin: 0">Make changes to your account here.</p></Tab>
          <Tab title="Password" icon="lock"><Input type="password" label="New password" /></Tab>
          <Tab title="Closable" closable><p style="margin: 0">Close me with the × or the Delete key.</p></Tab>
        </Tabs>
      </Card>

      <Card title="Progress">
        <VStack gap={16}>
          <Progress value={33} />
          <Progress value={66} variant="success" />
          <Progress indeterminate />
        </VStack>
      </Card>

      <Card title="Tree">
        <Tree data={[
          { text: 'src', icon: 'folder', expanded: true, children: [
            { text: 'components', icon: 'folder', children: [{ text: 'button.ts', icon: 'code' }, { text: 'grid.ts', icon: 'code' }] },
            { text: 'index.ts', icon: 'code' }
          ] },
          { text: 'package.json', icon: 'file' },
          { text: 'README.md', icon: 'file' }
        ]} />
      </Card>

      <Card title="Card with actions" subtitle="Header actions and a footer.">
        <CardActions><Button variant="ghost" icon="more" /></CardActions>
        <p class="muted">Anything can go in a card — it's just children.</p>
        <CardFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Continue</Button>
        </CardFooter>
      </Card>
    </Grid>
  </Page>
);

// ────────── App ──────────

const themeIcon = () => (NX.theme.get() === 'light' ? 'moon' : 'sun');
const themeButton = { current: null as HTMLElement | null };

const app = NX.app({
  el: '#app',
  title: 'Nexaro',
  stores: { users: { data: users } },

  items: [
    <Toolbar region="north" style="border-bottom: 1px solid var(--color-border)">
      <Button icon="menu" tooltip="Menu" class="nx-mobile-only" onClick={() => app.toggleRegion('west')} />
      <span class="brand" html={`${NX.icons.get('box')} Nexaro`} />
      <Spacer />
      <Input
        type="search" icon="search" clearable placeholder="Search users…" class="nx-desktop-only" style="width: 16rem"
        onChange={(e: CustomEvent) => {
          app.navigate('/users');
          setTimeout(() => NX.get<NXGrid>('users-grid')?.setFilter(e.detail.value));
        }}
      />
      <Button ref={themeButton} id="theme-toggle" icon={themeIcon()} tooltip="Toggle theme" onClick={() => NX.theme.toggle()} />
      <Button icon="github" tooltip="Source" href="https://github.com/usefuulness/nx.js" />
    </Toolbar>,

    <Panel region="west" width={240} bodyPadding={12}>
      <Tree data={[
        { id: 'dashboard', text: 'Dashboard', icon: 'dashboard', route: '/' },
        { id: 'users', text: 'Users', icon: 'users', route: '/users' },
        { id: 'forms', text: 'Settings', icon: 'settings', route: '/forms' },
        { id: 'components', text: 'Components', icon: 'components', route: '/components' }
      ]} />
    </Panel>,

    <Outlet region="center" />
  ],

  router: [
    { path: '/', title: 'Dashboard', view: DashboardPage },
    { path: '/users', title: 'Users', view: UsersPage },
    { path: '/forms', title: 'Settings', view: SettingsPage },
    { path: '/components', title: 'Components', view: ComponentsPage },
    { path: '*', view: () => <p style="padding: 2rem">Not found.</p> }
  ]
});

NX.theme.onChange(() => themeButton.current?.setAttribute('icon', themeIcon()));
