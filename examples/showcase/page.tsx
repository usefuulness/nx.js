/**
 * nx.js showcase — a kitchen-sink page for stakeholders.
 *
 * Every control here is a nx.js component. build.tsx renders this JSX to HTML
 * at build time (Declarative Shadow DOM, so it paints before JavaScript), and
 * client.tsx hydrates the same JSX so the inline handlers attach.
 */
import {
  NX, Accordion, AccordionItem, Alert, Avatar, Badge, Breadcrumb, Button, Card, CardFooter, Checkbox, Combobox,
  Command, DataGrid, DatePicker, Dialog, DialogFooter, Drawer, DrawerFooter, Form, Input, Menu, MenuBar, Popover,
  PopoverTrigger, Calendar, OtpInput, Chat, Chart, Divider, Panel, Rating, Stepper, Step, Timeline, TimelineItem, Toolbar, Pagination, FileUpload, Progress, RadioGroup, Select, Skeleton, Slider, CodeEditor, List, Nav, Notifications, PropertyGrid, Stat, PageHeader, Empty, Descriptions, Sidebar, Switcher, Cluster, Box, Spinner, Splitter, Switch, Tab, Tabs, TagInput, Textarea, Tooltip, Tree,
  type CommandItem, type Child, type NXChat
} from 'nx.js';

type Openable = HTMLElement & { open(): unknown; close(): void };
type Valued = HTMLElement & { value: any };

const dialog = { current: null as Openable | null };
const drawer = { current: null as Openable | null };
const progress = { current: null as HTMLElement | null };
const payload = { current: null as HTMLElement | null };
const themeCode = { current: null as HTMLElement | null };
const scriptEditor = { current: null as (HTMLElement & { isDirty(): boolean; markClean(): void; revert(): void }) | null };
const scriptStatus = { current: null as HTMLElement | null };

const nightlyScript = `// A script, edited in the code editor.
// Tab indents; press Escape, then Tab, to leave the editor.
def run(ctx) {
  ctx.log.info("hello from \${ctx.job.name}")
  return [ok: true]
}
`;

const paintScriptStatus = () => {
  if (scriptStatus.current) scriptStatus.current.textContent = scriptEditor.current?.isDirty() ? 'Not saved' : 'Saved';
};

/** A stand-in for a model: streams a Markdown reply word by word, and stops when the signal aborts. */
async function* fakeReply(prompt: string, signal: AbortSignal): AsyncGenerator<string> {
  const reply = `Here is a short answer to **${prompt.replace(/[*_`<>]/g, '').slice(0, 60)}**.

- Replies stream in as they are written
- Press **Stop** to end one early
- Markdown is shown safely, so <b>this</b> stays text

\`\`\`ts
const reply = await chat.respond(signal => stream(prompt, signal));
\`\`\`

See the [chat guide](https://usefuulness.github.io/nx.js/docs/chat.html).`;
  for (const word of reply.split(/(?<=\s)/)) {
    await new Promise(resolve => setTimeout(resolve, 22));
    if (signal.aborted) return;
    yield word;
  }
}

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
        <a class="sc-brand" href="#top"><code>{'<nx/>'}</code>nx.js</a>
        <nav class="sc-nav" aria-label="Sections">
          <a href="#components">Components</a>
          <a href="#layouts">Layouts</a>
          <a href="#theming">Theming</a>
          <a href="#forms">Forms</a>
          <a href="#data">Data</a>
          <a href="#editors">Editors</a>
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
              nx.js is a library of accessible, themeable UI components. Teams use them as JSX in a web app, as plain
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
                <Combobox name="framework" label="Framework" value="nxjs" placeholder="Search frameworks…"
                          options={{ nxjs: 'nx.js', astro: 'Astro', laravel: 'Laravel', django: 'Django', rails: 'Rails', symfony: 'Symfony' }} />
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
              <RadioGroup name="density" label="Density" variant="segmented" value="comfortable" options={{ compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }} />
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

            <Specimen tag="nx-code-editor" span>
              <CodeEditor label="Settings (JSON)" name="settings" language="json" languageSelect languages="json,yaml,xml,properties" height="9rem" value={'{\n  "retries": 2,\n  "notify": ["ops@example.com"]\n}'} />
            </Specimen>

            <Specimen tag="nx-property-grid" span>
              <PropertyGrid label="Job" schema={[
                { name: 'name', label: 'Name', required: true },
                { name: 'kind', label: 'Kind', type: 'select', options: ['scheduled', 'on demand'] },
                { name: 'retries', label: 'Retries', type: 'number', min: 0, max: 5 },
                { name: 'enabled', label: 'Enabled', type: 'boolean' }
              ]} value={{ name: 'Nightly export', kind: 'scheduled', retries: 2, enabled: true }} />
            </Specimen>

            <Specimen tag="nx-notifications">
              <Notifications label="Notifications" data={[
                { id: 1, title: 'Invoice #3052 paid', description: 'Acme Corp paid $2,400.', time: new Date(Date.now() - 6 * 60000), icon: 'success', tone: 'success' },
                { id: 2, title: 'Webhook failing', time: new Date(Date.now() - 3 * 3600000), icon: 'error', tone: 'error' },
                { id: 3, title: 'Workspace created', read: true }
              ]} />
            </Specimen>

            <Specimen tag="nx-nav">
              <Nav label="Sections" value="orders" data={[
  { id: 'home', text: 'Dashboard', icon: 'dashboard', href: '#' },
  { heading: true, text: 'Sales' },
  { id: 'orders', text: 'Orders', icon: 'cart', href: '#', badge: 12 },
  { id: 'reports', text: 'Reports', icon: 'chart', expanded: true, children: [{ id: 'monthly', text: 'Monthly', href: '#' }, { id: 'yearly', text: 'Yearly', href: '#' }] }
]} />
            </Specimen>

            <Specimen tag="nx-stat">
              <Stat label="Revenue" value="$48,200" delta={12.5} deltaLabel="vs last month" icon="dollar" trend={[4, 6, 5, 8, 7, 9, 12]} />
            </Specimen>

            <Specimen tag="nx-descriptions">
              <Descriptions columns={2} data={[
                { label: 'Customer', value: 'Acme Corp' }, { label: 'Total', value: '$2,400' },
                { label: 'Placed', value: 'June 11, 2026' }, { label: 'Phone', value: '' }
              ]} />
            </Specimen>

            <Specimen tag="nx-empty">
              <Empty icon="inbox" title="No orders yet" description="Orders appear here as soon as a customer checks out.">
                <Button size="sm">Create order</Button>
              </Empty>
            </Specimen>

            <Specimen tag="nx-page-header" span>
              <PageHeader title="Orders" description="Everything customers bought this week.">
                <Breadcrumb slot="breadcrumb" items={[{ text: 'Home', href: '#' }, { text: 'Orders' }]} />
                <Badge slot="meta" variant="success">Live</Badge>
                <Button slot="actions" variant="outline" size="sm">Export</Button>
                <Button slot="actions" size="sm">New order</Button>
              </PageHeader>
            </Specimen>

            <Specimen tag="nx-list">
              <List label="Release checklist" reorderable multiSelect field="title" descriptionField="owner" data={[
                { id: 1, title: 'Freeze the branch', owner: 'Ada' }, { id: 2, title: 'Run the end-to-end suite', owner: 'Grace' },
                { id: 3, title: 'Write the changelog', owner: 'Linus' }, { id: 4, title: 'Tag and publish', owner: 'Margaret' }
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

          <h3 class="sc-group">New in 0.2</h3>
          <div class="sc-grid">
            <Specimen tag="nx-pagination">
              <div style="display: grid; gap: 1rem">
                <Pagination total={250} page={4} showTotal sizes="10,25,50" />
                <Pagination total={95} page={2} compact />
              </div>
              <p class="sc-note">A window that keeps its width as you move, a range, and a page size.</p>
            </Specimen>

            <Specimen tag="nx-tag-input">
              <TagInput name="topics" label="Topics" value="css,html" max={5} suggestions="css,html,js,a11y" helperText="Enter or comma adds a tag; Backspace removes the last." />
              <p class="sc-note">Posts each tag as its own entry; changes are announced to screen readers.</p>
            </Specimen>

            <Specimen tag="nx-file-upload">
              <FileUpload name="attachments" label="Attachments" multiple accept=".pdf,image/*" maxSize="5MB" helperText="PDF or images, up to 5 MB each." />
              <p class="sc-note">A real file input underneath: keyboard, drag and drop, rules checked, refusals announced.</p>
            </Specimen>

            <Specimen tag="nx-chat" span>
              <Chat style="height: 22rem" suggestions="Explain streaming|Write a haiku"
                    onSend={(e: CustomEvent) => (e.target as NXChat).respond(signal => fakeReply(e.detail.text, signal))} />
              <p class="sc-note">Streams, renders Markdown safely (try the suggestions), and Stop ends a reply early. This one answers with a canned reply: connect your own model.</p>
            </Specimen>

            <Specimen tag="nx-stepper">
              <Stepper current={1} clickable>
                <Step title="Account" description="Your details" />
                <Step title="Plan" description="Pick a tier" />
                <Step title="Payment" status="error" description="Card declined" />
                <Step title="Done" />
              </Stepper>
              <p class="sc-note">The current step is an attribute, so server HTML carries it. Each state is written out for screen readers.</p>
            </Specimen>

            <Specimen tag="nx-calendar">
              <Calendar value="2026-03-04" firstDay={1} events={[{ date: '2026-03-04', title: 'Standup', time: '09:30' }, { date: '2026-03-04', title: 'Deploy', status: 'error' }, { date: '2026-03-10', title: 'Design review', time: '14:00', status: 'success' }, { date: '2026-03-18', title: 'Release', status: 'info' }]} />
              <p class="sc-note">An always-visible month: dots for days with events, and the list for the selected day.</p>
            </Specimen>

            <Specimen tag="nx-timeline">
              <Timeline label="Order history">
                <TimelineItem title="Delivered" time="2026-03-04" status="success">Left at the front door.</TimelineItem>
                <TimelineItem title="Payment retried" time="2026-03-02T14:10" status="warning" />
                <TimelineItem title="Order placed" time="2026-03-01T09:30" />
              </Timeline>
            </Specimen>

            <Specimen tag="nx-chart" span>
              <div style="display: flex; flex-wrap: wrap; gap: 1.5rem">
                <div style="flex: 1 1 16rem"><Chart type="bar" label="Signups per month" data={[{ label: 'Jan', value: 12 }, { label: 'Feb', value: 19 }, { label: 'Mar', value: 8 }, { label: 'Apr', value: 24 }]} /></div>
                <div style="flex: 1 1 16rem"><Chart type="line" label="Visits and orders" labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']} series={[{ name: 'Visits', data: [30, 42, 38, 55, 61] }, { name: 'Orders', data: [4, 9, 7, 12, 15] }]} /></div>
                <div style="flex: 1 1 12rem"><Chart type="donut" label="Traffic" data={[{ label: 'Search', value: 52 }, { label: 'Direct', value: 31 }, { label: 'Social', value: 17 }]} /></div>
              </div>
              <p class="sc-note">Bars, lines, areas and donuts in SVG, themed. The data is also a hidden table for screen readers.</p>
            </Specimen>

            <Specimen tag="nx-otp-input">
              <OtpInput name="code" label="Verification code" length={6} />
              <p class="sc-note">A box per character that moves on as you type, steps back on Backspace, and takes a pasted or autofilled code. It posts as one value.</p>
            </Specimen>

            <Specimen tag="nx-rating">
              <Rating name="stars" label="How was it?" value={4} />
              <Rating label="Average" value={3.5} readonly />
              <p class="sc-note">Native radios underneath, so the keys and form posting are the browser's own.</p>
            </Specimen>

            <Specimen tag="nx-toolbar">
              <Toolbar items={[
                { xtype: 'button', text: 'New', icon: 'plus', variant: 'primary' },
                '-',
                { xtype: 'button', icon: 'refresh', ariaLabel: 'Refresh' },
                '->',
                { xtype: 'textfield', placeholder: 'Search…', icon: 'search', ariaLabel: 'Search' }
              ]} />
            </Specimen>

            <Specimen tag="nx-panel">
              <Panel title="Details" icon="info" collapsible style="border: 1px solid var(--color-border); border-radius: var(--radius-md)">
                <div style="padding: 0.75rem">A titled region that can collapse.</div>
              </Panel>
              <Divider label="or" />
              <p class="sc-note"><code>nx-divider</code> separates content, with an optional label.</p>
            </Specimen>

            <Specimen tag="nx-splitter">
              <Splitter style="height: 9rem; border: 1px solid var(--color-border); border-radius: var(--radius-md)">
                <div size="30" min-size="80" style="padding: 0.75rem">Files</div>
                <Splitter orientation="vertical">
                  <div size="60" min-size="40" style="padding: 0.75rem">Editor</div>
                  <div size="40" min-size="40" style="padding: 0.75rem">Console</div>
                </Splitter>
              </Splitter>
              <p class="sc-note">Drag a divider, or focus one and use the arrow keys, Home, End and Enter.</p>
            </Specimen>
          </div>
        </section>

        {/* ────────── Layouts ────────── */}
        <section class="sc-section" id="layouts" aria-labelledby="layouts-title">
          <div class="sc-section-head">
            <h2 id="layouts-title">Layouts that adapt on their own</h2>
            <p>
              One container, a <code>layout</code> attribute. These respond to the space they are given, not to the
              screen, so they work in a narrow column as well as a wide page. Drag the corner of a box to try it.
            </p>
          </div>
          <div class="sc-grid sc-wide">
            <figure class="sc-specimen" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-container layout="sidebar">'}</figcaption>
              <div class="sc-specimen-body sc-resizable">
                <Sidebar sideWidth="9rem" contentMin="55%" gap={12}>
                  <Card title="Filters"><span class="sc-note">A fixed side</span></Card>
                  <Card title="Results"><span class="sc-note">The content takes the rest, and drops under the side when it would get too narrow.</span></Card>
                </Sidebar>
              </div>
            </figure>
            <figure class="sc-specimen" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-container layout="switcher">'}</figcaption>
              <div class="sc-specimen-body sc-resizable">
                <Switcher threshold="24rem" gap={12}>
                  <Card title="Plan A"><span class="sc-note">A row while there is room</span></Card>
                  <Card title="Plan B"><span class="sc-note">a column when there is not</span></Card>
                  <Card title="Plan C"><span class="sc-note">no media queries</span></Card>
                </Switcher>
              </div>
            </figure>
            <figure class="sc-specimen" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-container layout="table">'}</figcaption>
              <div class="sc-specimen-body">
                <Box layout="table" columns={3} gap={10}>
                  <Card span="2" title="Wide"><span class="sc-note">span="2"</span></Card>
                  <Card title="Narrow"><span class="sc-note">one</span></Card>
                  <Card title="One"><span class="sc-note">one</span></Card>
                  <Card span="2" title="Two"><span class="sc-note">span="2"</span></Card>
                </Box>
              </div>
            </figure>
            <figure class="sc-specimen" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-container layout="card">'}</figcaption>
              <div class="sc-specimen-body">
                <Box layout="card" id="lay-card" active="0" gap={10}>
                  <Card title="Step 1: Account"><span class="sc-note">One child at a time, like a wizard.</span></Card>
                  <Card title="Step 2: Plan"><span class="sc-note">The server's HTML already shows the right one.</span></Card>
                  <Card title="Step 3: Done"><span class="sc-note">next() and previous() move; activechange tells you.</span></Card>
                </Box>
                <Cluster gap={8} style="margin-top: 0.75rem">
                  <Button id="lay-prev" size="sm" variant="outline" onClick={() => (document.getElementById('lay-card') as any)?.previous()}>Back</Button>
                  <Button id="lay-next" size="sm" onClick={() => (document.getElementById('lay-card') as any)?.next()}>Next</Button>
                </Cluster>
              </div>
            </figure>
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

        {/* ────────── Data ────────── */}
        <section class="sc-section" id="data" aria-labelledby="data-title">
          <div class="sc-section-head">
            <h2 id="data-title">Talks to your server, without the glue</h2>
            <p>Point nx.js at an OpenAPI document or a HAL entry point and it builds the models, stores and requests itself. Everything below runs live in this page against a small server that sorts, searches, pages and validates like yours would. Watch the requests it sends.</p>
          </div>

          <div class="sc-demos">
            <figure class="sc-specimen sc-demo" id="oa-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'await NX.openapi("/openapi.json")'}</figcaption>
              <div class="sc-specimen-body">
                <div class="sc-demo-bar">
                  <Button id="oa-read" icon="download">Read the document</Button>
                  <span class="sc-note" id="oa-status" role="status">Not read yet: press the button and the client reads the server's own description.</span>
                </div>
                <div class="sc-demo-cols">
                  <div class="sc-demo-main">
                    <div class="sc-chips" id="oa-ops" aria-label="Operations found in the document"></div>
                    <DataGrid id="oa-grid" search striped emptyText="Nothing loaded yet" columns={[
                      { field: 'id', header: 'Id', width: 64, sortable: true },
                      { field: 'name', header: 'Name', sortable: true },
                      { field: 'species', header: 'Species', sortable: true, width: 110 },
                      { field: 'age', header: 'Age', type: 'number', sortable: true, width: 80 },
                      { field: 'adopted', header: 'Adopted', type: 'boolean', width: 100 }
                    ]} data={[]} />
                    <Pagination id="oa-pager" total={0} pageSize={8} compact />
                  </div>
                  <div class="sc-demo-side">
                    <form id="oa-form" class="sc-demo-form" novalidate>
                      <h3>Add a pet</h3>
                      <p class="sc-note">The rules come from the document: length, allowed values and a range. They are checked as you type, and again by the server.</p>
                      <Input id="oa-name" name="name" label="Name" placeholder="2 to 20 characters" />
                      <Select id="oa-species" name="species" label="Species" value="cat" options={["cat", "dog", "rabbit"]} />
                      <Input id="oa-age" name="age" type="number" label="Age" value="1" />
                      <Button id="oa-add" type="submit" disabled>Add</Button>
                    </form>
                    <div>
                      <span class="sc-specimen-label">Operation result</span>
                      <pre class="sc-code sc-json" id="oa-result" aria-live="polite"><code>{'// Press an operation above'}</code></pre>
                    </div>
                  </div>
                </div>
                <div>
                  <span class="sc-specimen-label">Requests</span>
                  <ol class="sc-log" id="oa-log" aria-label="Requests sent" aria-live="polite"><li class="sc-log-empty">None yet</li></ol>
                </div>
              </div>
            </figure>

            <figure class="sc-specimen sc-demo" id="hal-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'NX.hal("/api/")'}</figcaption>
              <div class="sc-specimen-body">
                <div class="sc-demo-bar">
                  <Button id="hal-start" icon="download">GET /api/</Button>
                  <span class="sc-note" id="hal-status" role="status">One address in. Everything else is found by following links.</span>
                </div>
                <div class="sc-chips" id="hal-rels" aria-label="Relations offered by the entry document"></div>
                <div class="sc-demo-cols">
                  <div class="sc-demo-main">
                    <DataGrid id="hal-grid" striped emptyText="Nothing loaded yet" columns={[
                      { field: 'id', header: 'Id', width: 64 },
                      { field: 'title', header: 'Title', sortable: true },
                      { field: 'year', header: 'Year', sortable: true, width: 90 },
                      { field: 'pages', header: 'Pages', type: 'number', width: 90 }
                    ]} data={[]} />
                    <Pagination id="hal-pager" total={0} pageSize={6} compact />
                  </div>
                  <div class="sc-demo-side">
                    <span class="sc-specimen-label">The resource you are on</span>
                    <nav class="sc-trail" id="hal-trail" aria-label="Links followed"></nav>
                    <pre class="sc-code sc-json" id="hal-detail" aria-live="polite"><code>{'// Click a row, then follow its links'}</code></pre>
                    <div class="sc-chips" id="hal-links" aria-label="Links on this resource"></div>
                  </div>
                </div>
                <div>
                  <span class="sc-specimen-label">Requests</span>
                  <ol class="sc-log" id="hal-log" aria-label="Requests sent" aria-live="polite"><li class="sc-log-empty">None yet</li></ol>
                </div>
              </div>
            </figure>

            <figure class="sc-specimen sc-demo" id="dash-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'NX.viewModel({ data, formulas })'}</figcaption>
              <div class="sc-specimen-body">
                <p class="sc-note" style="margin: 0">One view model holds the filters. Formulas work out the numbers and the chart data from them, and everything on this card is bound to it. Nothing here is wired by hand.</p>
                <div class="sc-demo-controls">
                  <RadioGroup id="dash-region" name="region" label="Region" variant="segmented" value="all" options={{ all: 'All', eu: 'EU', us: 'US', apac: 'APAC' }} />
                  <Select id="dash-category" name="category" label="Category" value="all" options={{ all: 'All categories', hardware: 'Hardware', software: 'Software', services: 'Services' }} />
                  <Input id="dash-query" name="query" label="Search products" placeholder="e.g. cloud" />
                </div>
                <div class="sc-kpis" role="group" aria-label="Key figures">
                  <div class="sc-kpi"><span class="sc-kpi-label">Revenue</span><strong id="dash-revenue">…</strong></div>
                  <div class="sc-kpi"><span class="sc-kpi-label">Orders</span><strong id="dash-count">…</strong></div>
                  <div class="sc-kpi"><span class="sc-kpi-label">Average order</span><strong id="dash-average">…</strong></div>
                  <div class="sc-kpi"><span class="sc-kpi-label">Top product</span><strong id="dash-top">…</strong></div>
                </div>
                <div class="sc-demo-charts">
                  <Chart id="dash-trend" type="area" label="Revenue by month" labels={['Jan']} series={[{ name: 'Revenue', data: [0] }]} />
                  <Chart id="dash-split" type="donut" label="Revenue by region" data={[{ label: 'Loading', value: 1 }]} />
                </div>
                <DataGrid id="dash-grid" striped pageSize={5} emptyText="No orders match" columns={[
                  { field: 'date', header: 'Date', width: 120, sortable: true },
                  { field: 'product', header: 'Product', sortable: true },
                  { field: 'region', header: 'Region', width: 90 },
                  { field: 'amount', header: 'Amount', type: 'number', width: 110, sortable: true }
                ]} data={[]} />
                <div>
                  <span class="sc-specimen-label">The view model's data</span>
                  <pre class="sc-code sc-json" id="dash-state"><code>{'{ }'}</code></pre>
                </div>
              </div>
            </figure>

            <figure class="sc-specimen sc-demo" id="tree-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'NX.treeStore({ root, proxy })'}</figcaption>
              <div class="sc-specimen-body">
                <p class="sc-note" style="margin: 0">Folders marked as having children load them the first time you open them: open Pictures or Music and watch the request. Searching keeps the way down to each match, without leaving anything open afterwards.</p>
                <div class="sc-demo-controls">
                  <Input id="tree-query" name="treequery" label="Search files" placeholder="e.g. jpg" />
                  <div class="sc-demo-buttons">
                    <Button id="tree-expand" variant="outline" size="sm">Expand all</Button>
                    <Button id="tree-collapse" variant="outline" size="sm">Collapse all</Button>
                  </div>
                </div>
                <div class="sc-demo-cols">
                  <Tree id="tree-view" data={[{ id: 'loading', text: 'Loading…' }]} />
                  <div>
                    <span class="sc-specimen-label">Requests</span>
                    <ol class="sc-log" id="tree-log" aria-label="Requests sent" aria-live="polite"><li class="sc-log-empty">None yet</li></ol>
                    <p class="sc-note" id="tree-count" role="status" style="margin-top: 0.75rem"></p>
                  </div>
                </div>
              </div>
            </figure>

            <figure class="sc-specimen sc-demo" id="book-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'Stepper + Calendar + Rating, on one view model'}</figcaption>
              <div class="sc-specimen-body">
                <p class="sc-note" style="margin: 0">A booking flow. The steps, the calendar's dots, the times you can still pick, the form's messages and the Next button all read from one view model. Pick a day with a dot to see a taken time.</p>
                <Stepper id="book-steps" current={0}>
                  <Step title="Day" description="Pick a date" />
                  <Step title="Time" description="Pick a slot" />
                  <Step title="Details" description="Who is coming" />
                  <Step title="Confirm" description="Check and book" />
                </Stepper>
                <div id="book-panels" class="sc-book-panels">
                  <section id="book-p0" aria-label="Pick a day">
                    <Calendar id="book-cal" firstDay={1} value="" month="2026-03-01" events={[]} />
                  </section>
                  <section id="book-p1" aria-label="Pick a time" hidden>
                    <RadioGroup id="book-slot" name="slot" label="Available times" variant="segmented" options={['09:00', '10:30', '13:00', '15:30']} />
                    <p class="sc-note" id="book-slot-note" style="margin-top: 0.5rem" />
                  </section>
                  <section id="book-p2" aria-label="Your details" hidden>
                    <div class="sc-demo-controls">
                      <Input id="book-name" name="bookname" label="Name" placeholder="Your name" />
                      <Input id="book-email" name="bookemail" type="email" label="Email" placeholder="name@example.com" />
                    </div>
                    <div class="sc-demo-controls" style="margin-top: 1rem">
                      <Rating id="book-urgency" name="urgency" label="How urgent is it?" />
                      <Switch id="book-reminder" name="reminder" label="Remind me the day before" checked />
                    </div>
                  </section>
                  <section id="book-p3" aria-label="Confirm" hidden>
                    <Timeline id="book-summary" label="Your booking" />
                  </section>
                </div>
                <div class="sc-demo-bar">
                  <Button id="book-back" variant="outline" disabled>Back</Button>
                  <Button id="book-next" disabled>Next</Button>
                  <span class="sc-note" id="book-hint" role="status">Pick a day to start.</span>
                </div>
              </div>
            </figure>

            <figure class="sc-specimen sc-demo" id="scale-demo" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-grid virtual> with 20,000 rows'}</figcaption>
              <div class="sc-specimen-body">
                <p class="sc-note" style="margin: 0">Only the rows in view are in the page. Scroll fast, sort, search, edit a cell (double-click) or select some: the totals follow.</p>
                <div class="sc-demo-bar">
                  <Button id="scale-load" icon="download">Load 20,000 rows</Button>
                  <Button id="scale-csv" variant="outline" disabled>Export CSV</Button>
                  <span class="sc-note" id="scale-stats" role="status">Press the button, or scroll here: it loads when it comes into view.</span>
                </div>
                <DataGrid id="scale-grid" virtual rowHeight={40} height={320} search selectable="multiple" checkboxSelection striped emptyText="Nothing loaded yet" data={[]} columns={[
                  { field: 'id', header: 'Id', width: 90, type: 'number', pinned: 'left' },
                  { field: 'name', header: 'Account', editable: true, sortable: true },
                  { field: 'city', header: 'City', width: 150, sortable: true },
                  { field: 'plan', header: 'Plan', width: 120, type: 'badge', badges: { Free: 'neutral', Pro: 'info', Team: 'success' }, editable: true, editor: 'select', options: ['Free', 'Pro', 'Team'] },
                  { field: 'mrr', header: 'MRR', width: 160, type: 'currency', sortable: true, summary: 'sum' }
                ]} />
              </div>
            </figure>
          </div>
        </section>

        {/* ────────── Editors ────────── */}
        <section class="sc-section" id="editors" aria-labelledby="editors-title">
          <div class="sc-section-head">
            <h2 id="editors-title">A code editor for admin tools</h2>
            <p>
              Scripts and definitions are edited in a form field, not a separate app. Line numbers, indentation, colours for 38 languages,
              checks for JSON, XML and properties as you type, the cursor position and an unsaved-changes mark. Type in it, then save or revert.
            </p>
          </div>
          <div class="sc-grid sc-wide">
            <figure class="sc-specimen sc-span-2" style="margin: 0">
              <figcaption class="sc-specimen-label">{'<nx-code-editor>'}</figcaption>
              <div class="sc-specimen-body">
                <CodeEditor ref={scriptEditor} id="script-editor" label="nightly.groovy" filename="nightly.groovy" languageSelect value={nightlyScript}
                            height="14rem" onDirtyChange={paintScriptStatus} />
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
                  <Button id="script-save" onClick={() => { scriptEditor.current?.markClean(); paintScriptStatus(); NX.toast.success('Script saved'); }}>Save</Button>
                  <Button variant="outline" onClick={() => { scriptEditor.current?.revert(); paintScriptStatus(); }}>Revert</Button>
                  <span ref={scriptStatus} id="script-status" class="sc-note" role="status">Saved</span>
                </div>
                <p class="sc-note">
                  Light by design: it colours and checks, and stays a normal form field (<span class="sc-inline-code">name</span>, <span class="sc-inline-code">required</span>, validation).
                  For completion or find and replace, plug in Ace, CodeMirror or Monaco with <span class="sc-inline-code">engine</span>.
                </p>
              </div>
            </figure>
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
        <span>This page is built with nx.js: server-rendered with <span class="sc-inline-code">nx.js/ssr</span>, then hydrated.</span>
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
