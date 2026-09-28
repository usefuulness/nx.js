/**
 * Nexaro showcase — a kitchen-sink page for stakeholders.
 *
 * Every control here is a Nexaro component. build.tsx renders this JSX to HTML
 * at build time (Declarative Shadow DOM, so it paints before JavaScript), and
 * client.tsx hydrates the same JSX so the inline handlers attach.
 */
import {
  NX, Accordion, AccordionItem, Alert, Avatar, Badge, Breadcrumb, Button, Card, CardFooter, Checkbox, Combobox,
  Command, DataGrid, DatePicker, Dialog, DialogFooter, Drawer, DrawerFooter, Form, Input, Menu, MenuBar, Popover,
  PopoverTrigger, Progress, RadioGroup, Select, Skeleton, Slider, Spinner, Switch, Tab, Tabs, Textarea, Tooltip, Tree,
  type CommandItem, type Child
} from 'nx.js';

type Openable = HTMLElement & { open(): unknown; close(): void };
type Valued = HTMLElement & { value: any };

const dialog = { current: null as Openable | null };
const drawer = { current: null as Openable | null };
const progress = { current: null as HTMLElement | null };
const payload = { current: null as HTMLElement | null };
const themeCode = { current: null as HTMLElement | null };

// ────────── Sample data ──────────

const deployments = [
  { service: 'checkout-api', region: 'eu-central-1', status: 'Live', duration: '1m 42s', commit: 'a3f9c21' },
  { service: 'search', region: 'us-east-1', status: 'Live', duration: '2m 05s', commit: '7be01d4' },
  { service: 'billing-worker', region: 'eu-west-2', status: 'Building', duration: '0m 58s', commit: 'c41a9e0' },
  { service: 'web', region: 'us-west-2', status: 'Live', duration: '3m 11s', commit: '19d7f3b' },
  { service: 'auth', region: 'eu-central-1', status: 'Failed', duration: '0m 21s', commit: 'f02cc6a' },
  { service: 'notifications', region: 'ap-south-1', status: 'Live', duration: '1m 09s', commit: '5e8b2d1' },
  { service: 'media-resizer', region: 'us-east-1', status: 'Queued', duration: '—', commit: '8aa41f7' },
  { service: 'analytics', region: 'eu-west-2', status: 'Live', duration: '4m 37s', commit: 'd6e90b2' },
  { service: 'admin', region: 'us-east-1', status: 'Live', duration: '1m 55s', commit: '0c7f5a9' },
  { service: 'reports', region: 'ap-northeast-1', status: 'Building', duration: '2m 14s', commit: 'b91e3c8' },
  { service: 'webhooks', region: 'eu-central-1', status: 'Live', duration: '0m 47s', commit: '3d2a6f0' },
  { service: 'feature-flags', region: 'us-west-2', status: 'Live', duration: '1m 03s', commit: 'e7c12b5' }
];

const checks = [
  { check: 'Unit tests', scope: 'Vitest, plus server rendering in Node', result: '125 passing' },
  { check: 'End-to-end tests', scope: 'Playwright: demo app, SSR pages, template server', result: '65 passing' },
  { check: 'Accessibility', scope: 'WCAG 2.1 AA, every page × 3 themes, overlays open', result: '0 violations' },
  { check: 'Hydration', scope: 'Layout compared before and after JavaScript', result: '0 px moved' },
  { check: 'Forms without JavaScript', scope: 'Forms posted with JavaScript disabled', result: 'All fields posted' },
  { check: 'Editor support', scope: 'Autocomplete data generated from the sources', result: '47 tags' }
];

const accents = [
  { value: 'zinc', text: 'Zinc', description: 'Default', primary: '', dark: '' },
  { value: 'cobalt', text: 'Cobalt', description: '#2446d8', primary: '#2446d8', dark: '#1a36b0' },
  { value: 'emerald', text: 'Emerald', description: '#047857', primary: '#047857', dark: '#065f46' },
  { value: 'crimson', text: 'Crimson', description: '#be123c', primary: '#be123c', dark: '#9f1239' }
];

// ────────── Behaviour ──────────

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** ⌘K palette: jump to a section or run something. */
export const commandItems = (): CommandItem[] => [
  { text: 'Components', icon: 'components', group: 'Jump to', handler: () => scrollTo('components') },
  { text: 'Brand playground', icon: 'theme', group: 'Jump to', keywords: ['theme', 'color', 'radius'], handler: () => scrollTo('theming') },
  { text: 'Forms without JavaScript', icon: 'form', group: 'Jump to', handler: () => scrollTo('forms') },
  { text: 'Any stack', icon: 'code', group: 'Jump to', keywords: ['twig', 'blade', 'jinja', 'html'], handler: () => scrollTo('stack') },
  { text: 'Quality', icon: 'check', group: 'Jump to', keywords: ['tests', 'accessibility', 'axe'], handler: () => scrollTo('quality') },
  { text: 'Toggle dark mode', icon: 'moon', group: 'Actions', keywords: ['theme', 'light'], handler: () => NX.theme.toggle() },
  { text: 'Show a toast', icon: 'bell', group: 'Actions', handler: () => NX.toast.success('Toasts stack, pause on hover and dismiss on swipe') },
  { text: 'Open the drawer', icon: 'layout', group: 'Actions', handler: () => drawer.current?.open() }
];

const brand = { accent: 'zinc', radius: 8 };

/** Brand overrides live in their own stylesheet, so theme switches keep them. */
function applyBrand(): void {
  let style = document.getElementById('sc-brand');
  if (!style) {
    style = document.createElement('style');
    style.id = 'sc-brand';
    document.head.append(style);
  }
  const accent = accents.find(a => a.value === brand.accent);
  const r = brand.radius;
  const vars = [
    `--radius-sm: ${Math.round(r * 0.6)}px`, `--radius-md: ${r}px`, `--radius-lg: ${Math.round(r * 1.5)}px`,
    ...(accent?.primary
      ? [`--color-primary: ${accent.primary}`, `--color-primary-dark: ${accent.dark}`, '--color-primary-foreground: #ffffff', `--color-ring: ${accent.primary}`]
      : [])
  ];
  style.textContent = `:root { ${vars.map(v => `${v} !important`).join('; ')} }`;
  if (themeCode.current) {
    themeCode.current.textContent = accent?.primary
      ? `NX.theme.extend('brand', '${NX.theme.get() === 'light' ? 'light' : 'dark'}', {\n  colors: { primary: '${accent.primary}', primaryDark: '${accent.dark}' },\n  radius: { md: '${r}px' }\n});`
      : `/* Default zinc palette */\n:root { --radius-md: ${r}px; }`;
  }
}

const deploy = async (e: MouseEvent) => {
  const button = e.currentTarget as HTMLElement & { setLoading(on: boolean): void };
  button.setLoading(true);
  await new Promise(resolve => setTimeout(resolve, 1200));
  button.setLoading(false);
  NX.toast.success('Project deployed', { description: 'acme-web is live in eu-central-1' });
};

// ────────── Pieces ──────────

/** A labelled specimen: the tag name, then the live component. */
const Specimen = ({ tag, span, children }: { tag: string; span?: boolean; children?: Child }) => (
  <figure class={['sc-specimen', { 'sc-span-2': span }]} style="margin: 0">
    <figcaption class="sc-specimen-label">{`<${tag}>`}</figcaption>
    <div class="sc-specimen-body">{children}</div>
  </figure>
);

const SectionHead = ({ title, children }: { title: string; children?: Child }) => (
  <div class="sc-section-head">
    <h2>{title}</h2>
    <p>{children}</p>
  </div>
);

/** Colour tags and comments in a code sample (same output on server and client). */
function highlight(code: string): Child[] {
  const parts: Child[] = [];
  const pattern = /(<\/?(?:nx-[a-z-]+|[A-Z][A-Za-z]*)|\/?>|\{#.*?#\}|\{\{--.*?--\}\}|\/\/[^\n]*)/g;
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    parts.push(code.slice(last, match.index));
    const token = match[0];
    const comment = token.startsWith('{#') || token.startsWith('{{--') || token.startsWith('//');
    parts.push(<span class={comment ? 'c' : 't'}>{token}</span>);
    last = match.index! + token.length;
  }
  parts.push(code.slice(last));
  return parts;
}

const Code = ({ children }: { children: string }) => <pre class="sc-code"><code>{highlight(children)}</code></pre>;

const samples: Array<[string, string]> = [
  ['JSX', `// Any bundler; JSX creates real DOM, no React
<Card title="Invite a teammate">
  <Input name="email" type="email" label="Email" required />
  <CardFooter>
    <Button type="submit">Send invite</Button>
  </CardFooter>
</Card>`],
  ['HTML', `<nx-card title="Invite a teammate">
  <nx-input name="email" type="email" label="Email" required></nx-input>
  <nx-button slot="footer" type="submit">Send invite</nx-button>
</nx-card>`],
  ['Twig', `{# Symfony, Craft — attributes auto-escaped #}
<nx-card title="{{ 'invite.title'|trans }}">
  <nx-input name="email" type="email" label="Email"
            value="{{ form.email }}" error-text="{{ errors.email }}" required></nx-input>
  <nx-button slot="footer" type="submit">Send invite</nx-button>
</nx-card>`],
  ['Blade', `{{-- Laravel: errors come back from the server --}}
<nx-card title="Invite a teammate">
  <nx-input name="email" type="email" label="Email" value="{{ old('email') }}"
            @error('email') error-text="{{ $message }}" @enderror required></nx-input>
  <nx-button slot="footer" type="submit">Send invite</nx-button>
</nx-card>`],
  ['Jinja', `{# Flask, Django — tojson is safe in attributes #}
<nx-grid title="Team" columns='{{ columns|tojson }}'>
  <script type="application/json" data-nx-config>{"data": {{ users|tojson }}}</script>
</nx-grid>`]
];

// ────────── Page ──────────

/**
 * The page. `site` adds links to the docs, the demo app and GitHub (the GitHub
 * Pages build); the server and the client must pass the same value.
 */
export const Showcase = ({ site = false }: { site?: boolean } = {}) => (
  <div class="sc-page">
    <header class="sc-header">
      <div class="sc-wrap">
        <a class="sc-brand" href="#top"><code>{'<nx/>'}</code>Nexaro</a>
        <nav class="sc-nav" aria-label="Sections">
          <a href="#components">Components</a>
          <a href="#theming">Theming</a>
          <a href="#forms">Forms</a>
          <a href="#stack">Any stack</a>
          <a href="#quality">Quality</a>
        </nav>
        <div class="sc-header-end">
          {site && <a class="sc-header-link" href="docs/">Docs</a>}
          {site && <a class="sc-header-link" href="demo/">Demo</a>}
          <Button variant="outline" size="sm" icon="search" onClick={() => NX.command(commandItems())}>
            Search <span class="sc-kbd">⌘K</span>
          </Button>
          <Button variant="ghost" size="sm" icon="theme" tooltip="Toggle dark mode" tooltipPlacement="bottom" onClick={() => NX.theme.toggle()} />
          {site && <Button variant="ghost" size="sm" icon="github" tooltip="Source on GitHub" tooltipPlacement="bottom" href="https://github.com/usefuulness/nx.js" />}
        </div>
      </div>
    </header>

    <main id="top">
      <div class="sc-wrap">
        <section class="sc-hero" aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title">
              Write the interface as HTML. Ship it from any stack. <span class="sc-tag">{'<nx-*>'}</span>
            </h1>
            <p class="sc-lead">
              Nexaro is a library of accessible, themeable UI components. Teams use them as JSX in a web app, as plain
              tags in Twig, Blade or Jinja templates, or pre-rendered on a server, and they look and behave the same in each.
            </p>
            <div class="sc-actions">
              <Button icon="arrow-right" iconPosition="right" onClick={() => scrollTo('components')}>See every component</Button>
              {site
                ? <Button variant="outline" icon="file" href="docs/getting-started.html">Get started</Button>
                : <Button variant="outline" icon="theme" onClick={() => scrollTo('theming')}>Try your brand colors</Button>}
            </div>
          </div>

          <div>
            <span class="sc-specimen-label">{'<nx-card>'}</span>
            <Card title="Create project" subtitle="Deploy a new project in one click.">
              <div style="display: grid; gap: 0.875rem">
                <Input name="project" label="Name" value="acme-web" />
                <Combobox name="framework" label="Framework" value="nexaro" placeholder="Search frameworks…"
                          options={{ nexaro: 'Nexaro', astro: 'Astro', laravel: 'Laravel', django: 'Django', rails: 'Rails', symfony: 'Symfony' }} />
                <DatePicker name="launch" label="Launch date" value="2025-10-01" locale="en-US" />
              </div>
              <CardFooter>
                <Button variant="outline" onClick={() => NX.toast('Nothing was deployed')}>Cancel</Button>
                <Button onClick={deploy}>Deploy</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <div class="sc-facts" role="list" aria-label="Facts">
          <div class="sc-fact" role="listitem"><b>47</b><span>HTML tags, each a component</span></div>
          <div class="sc-fact" role="listitem"><b>0</b><span>axe violations (WCAG 2.1 AA)</span></div>
          <div class="sc-fact" role="listitem"><b>190</b><span>automated tests on every change</span></div>
          <div class="sc-fact" role="listitem"><b>≈50 kB</b><span>gzipped, every component</span></div>
          <div class="sc-fact" role="listitem"><b>0</b><span>runtime dependencies</span></div>
        </div>

        {/* ────────── Kitchen sink ────────── */}
        <section class="sc-section" id="components" aria-labelledby="components-title">
          <div class="sc-section-head">
            <h2 id="components-title">Everything in the box</h2>
            <p>Every specimen below is the real component, not a screenshot. Click, type, tab through them. Press ⌘K (Ctrl+K) anywhere for the command palette.</p>
          </div>

          <h3 class="sc-group">Actions and feedback</h3>
          <div class="sc-grid">
            <Specimen tag="nx-button">
              <div class="sc-row">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger" icon="trash">Delete</Button>
                <Button variant="link">Link</Button>
              </div>
              <div class="sc-row">
                <Button icon="download" onClick={deploy}>Click to load</Button>
                <Button variant="outline" menu={[
                  { text: 'CSV', icon: 'file', handler: () => NX.toast('Exported as CSV') },
                  { text: 'JSON', icon: 'code', handler: () => NX.toast('Exported as JSON') },
                  '-',
                  { text: 'Print…', shortcut: '⌘P', handler: () => NX.toast('Print is disabled in this preview') }
                ]}>Export</Button>
              </div>
            </Specimen>

            <Specimen tag="nx-toast">
              <p class="sc-note">Stacked, announced to screen readers, paused on hover.</p>
              <div class="sc-row">
                <Button variant="outline" onClick={() => NX.toast('Event created', { description: 'Friday, October 3 at 9:00' })}>Default</Button>
                <Button variant="outline" onClick={() => NX.toast.success('Changes saved')}>Success</Button>
                <Button variant="outline" onClick={() => NX.toast.warning('Your trial ends in 3 days')}>Warning</Button>
                <Button variant="outline" onClick={() => NX.toast.error('Payment failed', { action: { text: 'Retry', handler: () => NX.toast('Retrying…') } })}>With action</Button>
              </div>
            </Specimen>

            <Specimen tag="nx-dialog">
              <p class="sc-note">Built on the native dialog: focus trap, Escape, inert background. Helpers return promises.</p>
              <div class="sc-row">
                <Button variant="outline" onClick={() => dialog.current?.open()}>Open dialog</Button>
                <Button variant="outline" onClick={async () => NX.toast(`You chose ${(await NX.confirm('Archive this project?', { confirmText: 'Archive' })) ? 'Archive' : 'Cancel'}`)}>Confirm</Button>
                <Button variant="outline" onClick={async () => { const name = await NX.prompt('Rename project', { defaultValue: 'acme-web' }); if (name) NX.toast.success(`Renamed to ${name}`); }}>Prompt</Button>
              </div>
            </Specimen>

            <Specimen tag="nx-tooltip">
              <div class="sc-row">
                <Tooltip content="Add to library"><Button variant="outline" icon="plus" aria-label="Add" /></Tooltip>
                <Button variant="outline" icon="copy" tooltip="Copy link" />
                <Button variant="outline" icon="star" tooltip="Star this project" tooltipPlacement="bottom" />
                <Button variant="outline" icon="settings" tooltip="Settings" tooltipPlacement="right" />
              </div>
              <p class="sc-note">Hover, or reach them with Tab. Escape hides.</p>
            </Specimen>

            <Specimen tag="nx-alert">
              <Alert variant="info" title="New region available">Deploy to ap-southeast-2 from today.</Alert>
              <Alert variant="destructive" title="Build failed" dismissible>auth · commit f02cc6a · exit code 1</Alert>
            </Specimen>

            <Specimen tag="nx-progress">
              <Progress ref={progress} value={64} label="Storage used" showValue />
              <Slider name="storage" label="Drag to change" value={64} onInput={(e: Event) => {
                progress.current?.setAttribute('value', String((e.currentTarget as Valued).value));
              }} />
              <div class="sc-row" style="gap: 1rem">
                <Spinner size="sm" />
                <div style="flex: 1; min-width: 0"><Skeleton count={2} /></div>
              </div>
            </Specimen>
          </div>

          <h3 class="sc-group">Forms</h3>
          <div class="sc-grid">
            <Specimen tag="nx-input">
              <Input name="email" type="email" label="Work email" placeholder="you@company.com" icon="mail" helperText="Leave the field to see validation." required />
              <Input name="query" type="search" placeholder="Search…" icon="search" clearable value="deploy" />
            </Specimen>

            <Specimen tag="nx-combobox">
              <Combobox name="country" label="Country" placeholder="Type to search…" options={{
                de: 'Germany', fr: 'France', nl: 'Netherlands', es: 'Spain', it: 'Italy', se: 'Sweden',
                pl: 'Poland', pt: 'Portugal', at: 'Austria', ch: 'Switzerland', be: 'Belgium', dk: 'Denmark'
              }} />
              <Select name="plan" label="Plan (native select)" value="team" options={{ free: 'Free', team: 'Team', enterprise: 'Enterprise' }} />
            </Specimen>

            <Specimen tag="nx-datepicker">
              <DatePicker name="due" label="Due date" value="2025-10-15" locale="en-US" />
              <p class="sc-note">Arrow keys move by day and week; Page Up/Down by month, with Shift by year.</p>
            </Specimen>

            <Specimen tag="nx-slider">
              <Slider name="volume" label="Volume" value={40} showValue unit="%" />
              <Slider name="price" label="Budget" min={0} max={5000} step={250} value={1500} showValue unit=" €" />
            </Specimen>

            <Specimen tag="nx-radio-group">
              <RadioGroup name="billing" label="Billing" value="yearly" variant="cards" orientation="horizontal" options={[
                { value: 'monthly', text: 'Monthly', description: '€12 / seat' },
                { value: 'yearly', text: 'Yearly', description: '€10 / seat' }
              ]} />
            </Specimen>

            <Specimen tag="nx-switch">
              <Switch name="alerts" label="Deploy alerts" description="Email me when a build fails." checked />
              <Checkbox name="terms" label="I accept the terms" />
              <Textarea name="notes" label="Notes" rows={2} placeholder="Anything we should know?" />
            </Specimen>
          </div>

          <h3 class="sc-group">Data and display</h3>
          <div class="sc-grid">
            <Specimen tag="nx-grid" span>
              <DataGrid title="Deployments" data={deployments} search striped pageSize={5} columns={[
                { field: 'service', header: 'Service' },
                { field: 'region', header: 'Region' },
                { field: 'status', header: 'Status', width: 110 },
                { field: 'duration', header: 'Duration', width: 110, align: 'right' },
                { field: 'commit', header: 'Commit', width: 110 }
              ]} />
            </Specimen>

            <Specimen tag="nx-tree">
              <Tree data={[
                { text: 'acme-web', icon: 'folder', expanded: true, children: [
                  { text: 'src', icon: 'folder', expanded: true, children: [
                    { text: 'page.tsx', icon: 'file' }, { text: 'client.tsx', icon: 'file' }
                  ] },
                  { text: 'templates', icon: 'folder', children: [{ text: 'layout.twig', icon: 'file' }] },
                  { text: 'package.json', icon: 'file' }
                ] }
              ]} />
            </Specimen>

            <Specimen tag="nx-avatar">
              <div class="sc-row">
                <Avatar alt="Ada Lovelace" status="online" />
                <Avatar alt="Grace Hopper" status="away" />
                <Avatar alt="Alan Turing" />
                <Avatar alt="Katherine Johnson" status="busy" />
                <Avatar alt="Linus Torvalds" shape="square" />
              </div>
              <div class="sc-row">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success" icon="check">Live</Badge>
                <Badge variant="warning">Building</Badge>
                <Badge variant="destructive">Failed</Badge>
              </div>
            </Specimen>
          </div>

          <h3 class="sc-group">Navigation and overlays</h3>
          <div class="sc-grid">
            <Specimen tag="nx-tabs">
              <Tabs>
                <Tab title="Account">Update your name and email address.</Tab>
                <Tab title="Password">Change your password; other sessions sign out.</Tab>
                <Tab title="Billing">Invoices go to finance@acme.example.</Tab>
              </Tabs>
            </Specimen>

            <Specimen tag="nx-accordion">
              <Accordion>
                <AccordionItem title="Do I need Node on the server?" expanded>No. Any backend can write the tags; pre-rendering is optional.</AccordionItem>
                <AccordionItem title="Does it work with React?">Yes, they are standard custom elements.</AccordionItem>
                <AccordionItem title="Can I restyle it?">Every color, radius and shadow is a CSS variable.</AccordionItem>
              </Accordion>
            </Specimen>

            <Specimen tag="nx-menubar">
              <MenuBar items={[
                { text: 'File', items: [{ text: 'New project', shortcut: '⌘N', handler: () => NX.toast('New project') }, { text: 'Open…', shortcut: '⌘O', handler: () => NX.toast('Open') }] },
                { text: 'Edit', items: [{ text: 'Undo', shortcut: '⌘Z', handler: () => NX.toast('Undo') }, { text: 'Redo', shortcut: '⇧⌘Z', handler: () => NX.toast('Redo') }] },
                { text: 'View', items: [{ text: 'Toggle dark mode', handler: () => NX.theme.toggle() }] }
              ]} />
              <Breadcrumb items={[{ text: 'Projects', href: '#components' }, { text: 'acme-web', href: '#components' }, { text: 'Settings' }]} />
              <div class="sc-row">
                <Menu text="Actions" variant="outline" items={[
                  { text: 'Edit', icon: 'edit', shortcut: '⌘E', handler: () => NX.toast('Edit') },
                  { text: 'Share', icon: 'send', items: [{ text: 'Email', handler: () => NX.toast('Shared by email') }, { text: 'Copy link', handler: () => NX.toast('Link copied') }] },
                  '-',
                  { text: 'Delete', icon: 'trash', danger: true, handler: () => NX.toast.error('Deleted') }
                ]} />
              </div>
            </Specimen>

            <Specimen tag="nx-popover">
              <div class="sc-row">
                <Popover label="Dimensions">
                  <PopoverTrigger><Button variant="outline" icon="layout">Dimensions</Button></PopoverTrigger>
                  <div style="display: grid; gap: 0.75rem">
                    <strong>Dimensions</strong>
                    <Input name="width" label="Width" value="100%" size="sm" />
                    <Input name="height" label="Height" value="25px" size="sm" />
                  </div>
                </Popover>
                <Button variant="outline" icon="menu" onClick={() => drawer.current?.open()}>Open drawer</Button>
              </div>
              <p class="sc-note">Top layer, so never clipped; Escape and outside clicks close them.</p>
            </Specimen>

            <Specimen tag="nx-command" span>
              <div style="border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden">
                <Command placeholder="Search this page…" items={commandItems()} />
              </div>
            </Specimen>
          </div>
        </section>

        {/* ────────── Theming ────────── */}
        <section class="sc-section" id="theming" aria-labelledby="theming-title">
          <div class="sc-section-head">
            <h2 id="theming-title">Your brand, in one line</h2>
            <p>Components only read CSS variables. Pick a color and a corner radius: this whole page, including everything above, follows.</p>
          </div>
          <div class="sc-playground">
            <div class="sc-controls">
              <RadioGroup name="accent" label="Brand color" value="zinc" variant="cards" orientation="horizontal" options={accents}
                          onChange={(e: CustomEvent) => { brand.accent = e.detail.value; applyBrand(); }} />
              <Slider name="radius" label="Corner radius" min={0} max={16} value={8} showValue unit="px"
                      onInput={(e: Event) => { brand.radius = (e.currentTarget as Valued).value; applyBrand(); }} />
              <RadioGroup name="theme" label="Theme" value="light" orientation="horizontal"
                          options={{ light: 'Light', dark: 'Dark', midnight: 'Midnight' }}
                          onChange={(e: CustomEvent) => NX.theme.set(e.detail.value)} />
            </div>
            <div style="display: grid; gap: 1rem; min-width: 0">
              <div class="sc-preview">
                <Card title="Team plan" subtitle="Billed yearly">
                  <div style="display: grid; gap: 0.75rem">
                    <Progress value={72} label="Seats used" showValue />
                    <Switch name="sso" label="Single sign-on" checked />
                  </div>
                  <CardFooter><Button onClick={() => NX.toast.success('Upgraded')}>Upgrade</Button></CardFooter>
                </Card>
                <Card title="Invite">
                  <div style="display: grid; gap: 0.75rem">
                    <Input name="invite" label="Email" placeholder="name@acme.example" />
                    <div class="sc-row"><Badge variant="success">3 active</Badge><Badge variant="outline">2 pending</Badge></div>
                  </div>
                  <CardFooter><Button variant="outline">Cancel</Button><Button>Send</Button></CardFooter>
                </Card>
              </div>
              <pre class="sc-code"><code ref={themeCode}>{'/* Default zinc palette */\n:root { --radius-md: 8px; }'}</code></pre>
            </div>
          </div>
        </section>

        {/* ────────── Forms ────────── */}
        <section class="sc-section" id="forms" aria-labelledby="forms-title">
          <div class="sc-section-head">
            <h2 id="forms-title">Forms that work before JavaScript</h2>
            <p>
              Server-rendered fields carry native inputs, so a visitor can fill in and submit a form the moment it appears.
              When the script arrives it takes over what was typed. Submit this one to see the payload a server would receive.
            </p>
          </div>
          <div class="sc-grid sc-wide">
            <div class="sc-specimen">
              <span class="sc-specimen-label">{'<nx-form>'}</span>
              <Form columns={2} onSubmit={(e: CustomEvent) => {
                if (payload.current) payload.current.textContent = JSON.stringify(e.detail.values, null, 2);
                NX.toast.success('Valid — ready to send');
              }} onInvalid={() => NX.toast.error('Please fix the highlighted fields')}>
                <Input name="name" label="Full name" required />
                <Input name="workEmail" type="email" label="Work email" required />
                <Select name="size" label="Company size" options={['1–10', '11–50', '51–200', '200+']} required />
                <DatePicker name="start" label="Start date" locale="en-US" min="2025-01-01" />
                <RadioGroup name="contact" label="Contact me by" value="email" orientation="horizontal" style="grid-column: 1 / -1"
                            options={{ email: 'Email', phone: 'Phone' }} />
                <Checkbox name="agree" label="I agree to the data processing terms" required style="grid-column: 1 / -1" />
                <Button slot="buttons" type="reset" variant="ghost">Reset</Button>
                <Button slot="buttons" type="submit">Request access</Button>
              </Form>
            </div>
            <div class="sc-specimen">
              <span class="sc-specimen-label">Payload</span>
              <pre class="sc-code" style="flex: 1"><code ref={payload}>{'// Submit the form to see what the server receives'}</code></pre>
              <p class="sc-note">In a real app this is a normal POST: validation runs in the browser, errors come back as <span class="sc-inline-code">error-text</span>.</p>
            </div>
          </div>
        </section>

        {/* ────────── Any stack ────────── */}
        <section class="sc-section" id="stack" aria-labelledby="stack-title">
          <div class="sc-section-head">
            <h2 id="stack-title">One component, any stack</h2>
            <p>The same tags work in JSX, plain HTML and every server template language. Editors autocomplete every tag and attribute.</p>
          </div>
          <div class="sc-grid sc-wide">
            <Tabs>
              {samples.map(([name, code]) => <Tab title={name}><Code>{code}</Code></Tab>)}
            </Tabs>
            <div>
              <span class="sc-specimen-label">Result</span>
              <Card title="Invite a teammate">
                <Input name="teammate" type="email" label="Email" placeholder="name@acme.example" required />
                <CardFooter><Button type="submit" onClick={() => NX.toast.success('Invite sent')}>Send invite</Button></CardFooter>
              </Card>
            </div>
          </div>

          <h3 class="sc-group" style="margin-top: 3rem">How this page was delivered</h3>
          <ol class="sc-steps">
            <li>
              <h3>Rendered on the server</h3>
              <p>The page's JSX went through <code>renderToString()</code>. Template-engine apps pipe their HTML through <code>renderHTML()</code> or the <code>nx-ssr</code> proxy instead.</p>
            </li>
            <li>
              <h3>Painted before JavaScript</h3>
              <p>Components arrive as Declarative Shadow DOM, fully styled and themed. Forms can already be filled in and sent.</p>
            </li>
            <li>
              <h3>Hydrated in place</h3>
              <p><code>hydrate()</code> attached the click handlers you are using. No element was re-created, so nothing flickered or moved.</p>
            </li>
          </ol>
        </section>

        {/* ────────── Quality ────────── */}
        <section class="sc-section" id="quality" aria-labelledby="quality-title">
          <div class="sc-section-head">
            <h2 id="quality-title">Checked on every change</h2>
            <p>These run automatically before anything ships. The numbers are from the current build.</p>
          </div>
          <DataGrid data={checks} striped columns={[
            { field: 'check', header: 'Check', width: 190 },
            { field: 'scope', header: 'What it covers' },
            { field: 'result', header: 'Result', width: 150 }
          ]} />
        </section>
      </div>
    </main>

    <footer class="sc-footer">
      <div class="sc-wrap">
        <span>This page is built with Nexaro: server-rendered with <span class="sc-inline-code">nx.js/ssr</span>, then hydrated.</span>
        <a href="https://github.com/usefuulness/nx.js">github.com/usefuulness/nx.js</a>
      </div>
    </footer>

    <Dialog ref={dialog} title="Archive project?" description="acme-web will stop serving traffic. You can restore it within 30 days.">
      <p style="margin: 0">Deployments, domains and environment variables are kept.</p>
      <DialogFooter>
        <Button variant="outline" onClick={() => dialog.current?.close()}>Cancel</Button>
        <Button variant="danger" onClick={() => { dialog.current?.close(); NX.toast('Project archived'); }}>Archive</Button>
      </DialogFooter>
    </Dialog>

    <Drawer ref={drawer} title="Notifications" description="Choose what reaches your inbox.">
      <div style="display: grid; gap: 1rem">
        <Switch name="n-deploys" label="Deployments" description="Successful and failed builds." checked />
        <Switch name="n-billing" label="Billing" description="Invoices and payment problems." checked />
        <Switch name="n-news" label="Product news" description="At most once a month." />
      </div>
      <DrawerFooter><Button onClick={() => { drawer.current?.close(); NX.toast.success('Preferences saved'); }}>Save</Button></DrawerFooter>
    </Drawer>
  </div>
);

export { applyBrand };
