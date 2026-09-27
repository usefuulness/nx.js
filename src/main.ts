/**
 * Demo app — `pnpm dev`. Everything here uses the public API only.
 */
import { NX, type ComponentConfig } from '@/index';

// ────────── Sample data ──────────

const roles = ['Admin', 'Editor', 'Viewer'];
const statuses = ['Active', 'Invited', 'Suspended'];
const firstNames = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara', 'Ken', 'Radia', 'Dennis', 'Frances', 'Tim', 'Hedy', 'John', 'Katherine', 'Guido', 'Anders'];
const lastNames = ['Lovelace', 'Hopper', 'Torvalds', 'Hamilton', 'Turing', 'Liskov', 'Thompson', 'Perlman', 'Ritchie', 'Allen', 'Berners-Lee', 'Lamarr', 'McCarthy', 'Johnson', 'van Rossum', 'Hejlsberg'];

const users = Array.from({ length: 48 }, (_, i) => {
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
  status: ['Paid', 'Paid', 'Pending', 'Refunded', 'Paid', 'Pending'][i],
  date: new Date(2025, 5, 28 - i).toISOString()
}));

// ────────── A custom component in a few lines ──────────

NX.define('stat', {
  observedAttributes: ['label', 'value', 'delta', 'icon'],
  render() {
    const delta = Number(this.getProp('delta', 0));
    return `
      <div class="stat">
        <div class="top">
          <span class="label">${this.getProp('label', '')}</span>
          <span class="icon">${NX.icons.get(this.getProp('icon', 'activity'))}</span>
        </div>
        <div class="value">${this.getProp('value', '')}</div>
        <div class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}% <span>from last month</span></div>
      </div>`;
  },
  styles() {
    return `
      :host { display: block; }
      .stat { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: var(--radius-lg);
              background: var(--color-surface); box-shadow: var(--shadow-sm); }
      .top { display: flex; justify-content: space-between; align-items: center; color: var(--color-text-secondary); font-size: .875rem; font-weight: 500; }
      .icon { display: inline-flex; font-size: 1rem; }
      .value { margin-top: .5rem; font-size: 1.75rem; font-weight: 700; letter-spacing: -.02em; }
      .delta { margin-top: .25rem; font-size: .75rem; font-weight: 500; }
      .delta span { color: var(--color-text-secondary); font-weight: 400; }
      .up { color: var(--color-success); } .down { color: var(--color-error); }`;
  }
});

// ────────── Views ──────────

const heading = (title: string, subtitle: string, actions: ComponentConfig[] = []): ComponentConfig => ({
  xtype: 'hbox',
  align: 'end',
  gap: 12,
  items: [
    {
      xtype: 'vbox',
      flex: 1,
      gap: 4,
      items: [
        { html: `<h1 style="margin:0;font-size:1.5rem;font-weight:700;letter-spacing:-.02em">${title}</h1>` },
        { html: `<p style="margin:0;color:var(--color-text-secondary)">${subtitle}</p>` }
      ]
    },
    ...actions
  ]
});

const page = (...items: ComponentConfig[]): ComponentConfig => ({
  xtype: 'vbox',
  gap: 24,
  style: 'max-width: 1200px; margin: 0 auto; width: 100%; padding: clamp(1rem, 4vw, 2rem)',
  items
});

const dashboardView = (): ComponentConfig => page(
  heading('Dashboard', 'Everything at a glance.', [
    { xtype: 'button', text: 'Download', icon: 'download', variant: 'outline', handler: () => NX.toast.success('Report exported', { description: 'dashboard-2025-06.csv' }) }
  ]),
  {
    xtype: 'container',
    layout: 'grid',
    minColumnWidth: 220,
    gap: 16,
    items: [
      { xtype: 'stat', label: 'Revenue', value: '$45,231', delta: 20.1, icon: 'dollar' },
      { xtype: 'stat', label: 'Customers', value: '2,350', delta: 18.2, icon: 'users' },
      { xtype: 'stat', label: 'Orders', value: '12,234', delta: 4.3, icon: 'cart' },
      { xtype: 'stat', label: 'Error rate', value: '0.12%', delta: -2.4, icon: 'activity' }
    ]
  },
  {
    xtype: 'container',
    layout: 'grid',
    columns: 3,
    gap: 16,
    items: [
      {
        xtype: 'grid',
        title: 'Recent orders',
        style: 'grid-column: span 2',
        data: orders,
        columns: [
          { field: 'id', header: 'Order', width: 90 },
          { field: 'customer', header: 'Customer' },
          { field: 'status', header: 'Status', type: 'badge', width: 110, badges: { Paid: 'success', Pending: 'warning', Refunded: 'neutral' } },
          { field: 'total', header: 'Total', type: 'currency', width: 110 }
        ]
      },
      {
        xtype: 'card',
        title: 'Goals',
        subtitle: 'Q2 progress',
        items: [
          {
            xtype: 'vbox',
            gap: 20,
            items: [
              ...([['New customers', 72], ['Revenue target', 54], ['NPS survey', 91]] as const).map(([label, value]) => ({
                xtype: 'vbox',
                gap: 8,
                items: [
                  { html: `<div style="display:flex;justify-content:space-between;font-size:.875rem"><span>${label}</span><span style="color:var(--color-text-secondary)">${value}%</span></div>` },
                  { xtype: 'progress', value, size: 'sm' }
                ]
              }))
            ]
          }
        ]
      }
    ]
  }
);

const usersView = (): ComponentConfig => page(
  heading('Users', 'Manage your team and their permissions.', [
    { xtype: 'button', text: 'Delete', icon: 'trash', variant: 'outline', id: 'delete-users', disabled: true, handler: deleteSelected },
    { xtype: 'button', text: 'Add user', icon: 'plus', handler: addUser }
  ]),
  {
    xtype: 'grid',
    id: 'users-grid',
    store: 'users',
    search: true,
    pageSize: 10,
    checkboxSelection: true,
    style: 'min-height: 0',
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'role', header: 'Role', type: 'badge', width: 110, badges: { Admin: 'info' } },
      { field: 'status', header: 'Status', type: 'badge', width: 120, badges: { Active: 'success', Invited: 'warning', Suspended: 'error' } },
      { field: 'revenue', header: 'Revenue', type: 'currency', width: 120 },
      { field: 'joined', header: 'Joined', type: 'date', width: 130 }
    ],
    onSelectionChange: (e: CustomEvent) => {
      NX.get('delete-users')?.set('disabled', e.detail.selected.length === 0);
    },
    onRowDblclick: (e: CustomEvent) => NX.alert(`${e.detail.row.name} <${e.detail.row.email}>`, { title: 'User' })
  }
);

async function addUser(): Promise<void> {
  const values = await NX.dialog({
    title: 'Add user',
    description: 'They will receive an invitation by email.',
    items: [{
      xtype: 'form',
      id: 'add-user-form',
      items: [
        { xtype: 'textfield', name: 'name', label: 'Name', required: true, placeholder: 'Ada Lovelace' },
        { xtype: 'email', name: 'email', label: 'Email', required: true, icon: 'mail', placeholder: 'ada@example.com' },
        { xtype: 'select', name: 'role', label: 'Role', options: roles, value: 'Viewer' }
      ]
    }],
    buttons: [
      { text: 'Cancel', variant: 'outline' },
      {
        text: 'Invite',
        variant: 'primary',
        handler: modal => {
          const values = NX.get('add-user-form').submit();
          if (!values) return false; // keep open, errors are shown
          modal.close(values);
          return false;
        }
      }
    ]
  });

  if (!values) return;
  const store = NX.store('users');
  store.add({ id: Date.now(), ...values, status: 'Invited', revenue: 0, joined: new Date().toISOString() });
  NX.toast.success(`Invited ${values.name}`, { description: values.email });
}

async function deleteSelected(): Promise<void> {
  const grid = NX.get('users-grid');
  const selected = grid.getSelected();
  if (!selected.length) return;
  const ok = await NX.confirm(`This will permanently remove ${selected.length} user${selected.length > 1 ? 's' : ''}.`, {
    title: 'Delete users?',
    confirmText: 'Delete',
    danger: true
  });
  if (!ok) return;
  const store = NX.store('users');
  const removed = store.getRange().filter(record => selected.includes(record.data));
  store.remove(removed);
  NX.toast(`${selected.length} user${selected.length > 1 ? 's' : ''} deleted`, {
    action: { text: 'Undo', handler: () => store.add(selected) }
  });
}

const formsView = (): ComponentConfig => page(
  heading('Settings', 'Forms with validation, in a few lines of config.'),
  {
    xtype: 'card',
    title: 'Profile',
    subtitle: 'This is how others will see you.',
    items: [{
      xtype: 'form',
      columns: 2,
      values: { first: 'Ada', last: 'Lovelace', role: 'Admin', notifications: true },
      items: [
        { xtype: 'textfield', name: 'first', label: 'First name', required: true },
        { xtype: 'textfield', name: 'last', label: 'Last name', required: true },
        { xtype: 'email', name: 'email', label: 'Email', required: true, icon: 'mail', placeholder: 'you@example.com', helperText: 'We never share it.' },
        { xtype: 'select', name: 'role', label: 'Role', options: roles },
        {
          xtype: 'password', name: 'password', label: 'Password', minLength: 8,
          validator: (v: string) => v && !/\d/.test(v) ? 'Include at least one number' : undefined
        },
        { xtype: 'numberfield', name: 'age', label: 'Age', min: 0, max: 150 },
        { xtype: 'textarea', name: 'bio', label: 'Bio', placeholder: 'Tell us a little about yourself', style: 'grid-column: 1 / -1' },
        { xtype: 'switch', name: 'notifications', label: 'Email notifications', description: 'Product updates and weekly digest.', style: 'grid-column: 1 / -1' },
        { xtype: 'checkbox', name: 'terms', label: 'I accept the terms and conditions', required: true, style: 'grid-column: 1 / -1' }
      ],
      buttons: [
        { xtype: 'button', text: 'Reset', type: 'reset', variant: 'ghost' },
        { xtype: 'button', text: 'Save changes', type: 'submit' }
      ],
      onSubmit: (e: CustomEvent) => NX.toast.success('Profile saved', { description: JSON.stringify(e.detail.values).slice(0, 80) + '…' }),
      onInvalid: () => NX.toast.error('Please fix the highlighted fields')
    }]
  }
);

const componentsView = (): ComponentConfig => page(
  heading('Components', 'A quick tour.'),
  {
    xtype: 'card',
    title: 'Buttons',
    items: [{
      xtype: 'hbox',
      gap: 8,
      wrap: true,
      align: 'center',
      items: [
        { xtype: 'button', text: 'Primary' },
        { xtype: 'button', text: 'Secondary', variant: 'secondary' },
        { xtype: 'button', text: 'Outline', variant: 'outline' },
        { xtype: 'button', text: 'Ghost', variant: 'ghost' },
        { xtype: 'button', text: 'Danger', variant: 'danger' },
        { xtype: 'button', text: 'Link', variant: 'link' },
        '|',
        { xtype: 'button', text: 'With icon', icon: 'send' },
        { xtype: 'button', icon: 'settings', variant: 'outline', tooltip: 'Settings' },
        { xtype: 'button', text: 'Loading', loading: true },
        { xtype: 'button', text: 'Disabled', disabled: true }
      ]
    }]
  },
  {
    xtype: 'container',
    layout: 'grid',
    minColumnWidth: 320,
    gap: 16,
    items: [
      {
        xtype: 'card',
        title: 'Feedback',
        subtitle: 'Promise-based dialogs and toasts.',
        items: [{
          xtype: 'hbox',
          gap: 8,
          wrap: true,
          items: [
            { xtype: 'button', text: 'Toast', variant: 'outline', handler: () => NX.toast('Event has been created', { description: 'Sunday, December 03 at 9:00 AM' }) },
            { xtype: 'button', text: 'Success', variant: 'outline', handler: () => NX.toast.success('Saved!') },
            { xtype: 'button', text: 'Error', variant: 'outline', handler: () => NX.toast.error('Something went wrong', { action: { text: 'Retry', handler: () => NX.toast('Retrying…') } }) },
            { xtype: 'button', text: 'Confirm', variant: 'outline', handler: async () => NX.toast(`You chose: ${await NX.confirm('Continue with this action?') ? 'yes' : 'no'}`) },
            { xtype: 'button', text: 'Prompt', variant: 'outline', handler: async () => { const name = await NX.prompt('What is your name?'); if (name) NX.toast(`Hello, ${name}!`); } }
          ]
        }]
      },
      {
        xtype: 'card',
        title: 'Tabs',
        padding: false,
        items: [{
          xtype: 'tabpanel',
          items: [
            { title: 'Account', icon: 'user', html: '<p style="margin:0">Make changes to your account here.</p>' },
            { title: 'Password', icon: 'lock', items: [{ xtype: 'password', label: 'New password' }] },
            { title: 'Closable', closable: true, html: '<p style="margin:0">Close me with the × or the Delete key.</p>' }
          ]
        }]
      },
      {
        xtype: 'card',
        title: 'Progress',
        items: [{
          xtype: 'vbox',
          gap: 16,
          items: [
            { xtype: 'progress', value: 33 },
            { xtype: 'progress', value: 66, variant: 'success' },
            { xtype: 'progress', indeterminate: true }
          ]
        }]
      },
      {
        xtype: 'card',
        title: 'Tree',
        items: [{
          xtype: 'tree',
          data: [
            { text: 'src', icon: 'folder', expanded: true, children: [
              { text: 'components', icon: 'folder', children: [{ text: 'button.ts', icon: 'code' }, { text: 'grid.ts', icon: 'code' }] },
              { text: 'index.ts', icon: 'code' }
            ] },
            { text: 'package.json', icon: 'file' },
            { text: 'README.md', icon: 'file' }
          ]
        }]
      }
    ]
  }
);

// ────────── App ──────────

const app = NX.app({
  el: '#app',
  title: 'Nexaro',

  stores: {
    users: { data: users }
  },

  items: [
    {
      xtype: 'toolbar',
      region: 'north',
      style: 'border-bottom: 1px solid var(--color-border)',
      items: [
        { xtype: 'button', icon: 'menu', tooltip: 'Menu', cls: 'nx-mobile-only', handler: () => app.toggleRegion('west') },
        { html: `<span style="display:flex;align-items:center;gap:.5rem;font-weight:700;letter-spacing:-.02em;padding:0 .5rem">${NX.icons.get('box')} Nexaro</span>` },
        '->',
        { xtype: 'search', placeholder: 'Search users…', style: 'width: 16rem', cls: 'nx-desktop-only', onChange: (e: CustomEvent) => { app.navigate('/users'); setTimeout(() => NX.get('users-grid')?.setFilter(e.detail.value)); } },
        {
          xtype: 'button',
          id: 'theme-toggle',
          icon: NX.theme.get() === 'light' ? 'moon' : 'sun',
          tooltip: 'Toggle theme',
          handler: () => NX.theme.toggle()
        },
        { xtype: 'button', icon: 'github', tooltip: 'Source', href: 'https://github.com/usefuulness/nx.js' }
      ]
    },
    {
      xtype: 'panel',
      region: 'west',
      width: 240,
      bodyPadding: 12,
      items: [{
        xtype: 'tree',
        data: [
          { id: 'dashboard', text: 'Dashboard', icon: 'dashboard', route: '/' },
          { id: 'users', text: 'Users', icon: 'users', route: '/users' },
          { id: 'forms', text: 'Settings', icon: 'settings', route: '/forms' },
          { id: 'components', text: 'Components', icon: 'components', route: '/components' }
        ]
      }]
    },
    { xtype: 'outlet', region: 'center' }
  ],

  router: [
    { path: '/', title: 'Dashboard', view: dashboardView },
    { path: '/users', title: 'Users', view: usersView },
    { path: '/forms', title: 'Settings', view: formsView },
    { path: '/components', title: 'Components', view: componentsView },
    { path: '*', view: { html: '<p style="padding:2rem">Not found.</p>' } }
  ]
});

NX.theme.onChange(theme => NX.get('theme-toggle')?.set('icon', theme === 'light' ? 'moon' : 'sun'));
