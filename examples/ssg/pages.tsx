/**
 * Pages of the static site. Plain JSX that reads like HTML, with its event
 * handlers inline: build.tsx renders it to HTML at build time, and client.tsx
 * hydrates the same JSX in the browser (the HTML stays; the handlers attach).
 */
import {
  Accordion, AccordionItem, Alert, Avatar, Badge, Breadcrumb, Button, Card, CardActions, CardFooter, Checkbox, Combobox, Command, DataGrid, DatePicker, Dialog, DialogFooter,
  Divider, Drawer, FileUpload, Form, Grid, HStack, Input, Chat, Chart, Calendar, OtpInput, Timeline, TimelineItem, Rating, Stepper, Step, Menu, MenuBar, Pagination, Panel, Popover, PopoverTrigger, Progress, RadioGroup, Select, Separator, Slider, Skeleton, Spinner, Splitter, Switch,
  List, Stat, PageHeader, Empty, Descriptions, Sidebar, Tab, Tabs, TagInput, Textarea, Toolbar, Tooltip, Tree, VStack, NX
} from 'nx.js';

type Openable = HTMLElement & { open(): void; close(): void };
const dialog = { current: null as Openable | null };
const drawer = { current: null as Openable | null };

const toggleTheme = () => NX.theme.set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

const releases = [
  { version: '0.3.0', date: '2025-06-02', notes: 'Server rendering, template engines' },
  { version: '0.2.0', date: '2025-04-18', notes: 'JSX components' },
  { version: '0.1.0', date: '2025-02-01', notes: 'First release' }
];

const Layout = ({ title, children }: { title: string; children?: any }) => (
  <main style="max-width: 56rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1.5rem">
    <HStack gap={12} align="center" wrap>
      <h1 style="margin: 0; font-size: 1.75rem">{title}</h1>
      <Badge variant="success">static</Badge>
      <span style="flex: 1" />
      <nav><a href="./index.html">Home</a> · <a href="./components.html">Components</a> · <a href="./contact.html">Contact</a></nav>
      <Button id="theme" variant="ghost" icon="moon" aria-label="Toggle theme" onClick={toggleTheme} />
    </HStack>
    {children}
  </main>
);

export const Home = () => (
  <Layout title="nx.js, pre-rendered">
    <Card title="Rendered at build time" subtitle="Declarative Shadow DOM: this card is visible before any JavaScript loads.">
      <p>The client bundle only upgrades the elements; nothing is re-created.</p>
      <CardFooter>
        <Button id="hello" icon="zap" onClick={() => NX.toast.success('Hello from the client')}>Say hello</Button>
      </CardFooter>
    </Card>

    <Tabs>
      <Tab title="Releases">
        <DataGrid data={releases} striped columns={[
          { field: 'version', header: 'Version', width: 110 },
          { field: 'date', header: 'Date', width: 140 },
          { field: 'notes', header: 'Notes' }
        ]} />
      </Tab>
      <Tab title="FAQ">
        <Accordion>
          <AccordionItem title="Does it need Node at runtime?" expanded>No — this page is plain HTML on a CDN.</AccordionItem>
          <AccordionItem title="Can I use my own template engine?">Yes, pipe its HTML through renderHTML().</AccordionItem>
        </Accordion>
      </Tab>
    </Tabs>
  </Layout>
);

export const Contact = () => (
  <Layout title="Contact">
    <Card title="Write to us" subtitle="A native form: it posts to the server like any HTML form.">
      <form id="contact" method="post" action="/contact">
        <VStack gap={16}>
          <Input name="email" type="email" label="Email" required autocomplete="email" />
          <Select name="topic" label="Topic" value="sales" options={{ sales: 'Sales', support: 'Support', other: 'Other' }} />
          <Textarea name="message" label="Message" required minlength={10} />
          <Checkbox name="newsletter" label="Send me the newsletter" />
          <HStack gap={8} justify="end">
            <Button type="reset" variant="ghost">Reset</Button>
            <Button type="submit" name="intent" value="send" icon="send">Send</Button>
          </HStack>
        </VStack>
      </form>
    </Card>

    <Card title="Newsletter" subtitle="<nx-form action> validates, then posts natively too.">
      <Form id="subscribe" action="/subscribe" method="post" columns={2}>
        <Input name="name" label="Name" />
        <Input name="email" type="email" label="Email" required />
        <Button slot="buttons" type="submit">Subscribe</Button>
      </Form>
    </Card>
  </Layout>
);

/** Every component, server-rendered — the hydration audit in src/tests/e2e/ssr.spec.ts uses this page. */
export const Components = () => (
  <Layout title="Components">
    <Breadcrumb items={[{ text: 'Home', href: './index.html' }, { text: 'Components' }]} />
    <Alert variant="success" title="Server-rendered">Every component on this page was rendered at build time.</Alert>

    <Grid minColumnWidth="16rem" gap={16}>
      <Card title="Buttons">
        <HStack gap={8} wrap>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline" icon="plus">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon="trash">Delete</Button>
          <Button loading>Saving</Button>
          <Button icon="settings" aria-label="Settings" variant="outline" />
        </HStack>
      </Card>

      <Card title="Badges and status">
        <VStack gap={12}>
          <HStack gap={8} wrap>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Paid</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="destructive">Failed</Badge>
            <Badge variant="outline">Outline</Badge>
          </HStack>
          <Progress value={64} label="Storage" showValue />
          <HStack gap={12} align="center"><Spinner /><Skeleton width="60%" /></HStack>
        </VStack>
      </Card>

      <Card title="Calendar">
        <div style="max-width: 24rem"><Calendar value="2026-03-04" firstDay={1} events={[{ date: '2026-03-04', title: 'Standup', time: '09:30' }, { date: '2026-03-04', title: 'Deploy', status: 'error' }, { date: '2026-03-10', title: 'Design review', time: '14:00', status: 'success' }, { date: '2026-03-18', title: 'Release', status: 'info' }]} /></div>
      </Card>

      <Card title="Timeline">
        <Timeline label="Order history">
          <TimelineItem title="Delivered" time="2026-03-04" status="success">Left at the front door.</TimelineItem>
          <TimelineItem title="Order placed" time="2026-03-01T09:30" />
        </Timeline>
      </Card>

      <Card title="Chart">
        <Chart type="bar" label="Signups per month" data={[{ label: 'Jan', value: 12 }, { label: 'Feb', value: 19 }, { label: 'Mar', value: 8 }]} />
      </Card>

      <Card title="Stepper">
        <Stepper current={1}>
          <Step title="Account" /><Step title="Plan" /><Step title="Done" />
        </Stepper>
      </Card>

      <Card title="Chat">
        <Chat style="height: 15rem" messages={[
          { role: 'user', content: 'What does server rendering do for a chat?' },
          { role: 'assistant', content: 'The conversation arrives **already rendered**: no empty box, then a flash of text. Replies are shown as safe Markdown.' }
        ]} />
      </Card>

      <Card title="Splitter">
        <Splitter style="height: 8rem; border: 1px solid var(--color-border); border-radius: var(--radius-md)">
          <div size="30" min-size="80" style="padding: 0.75rem">Files</div>
          <div size="70" style="padding: 0.75rem">Drag the divider, or focus it and use the arrow keys.</div>
        </Splitter>
      </Card>

      <Card title="Pagination">
        <VStack gap={12}>
          <Pagination total={250} page={4} showTotal />
          <Pagination total={95} page={2} compact />
        </VStack>
      </Card>

      <Card title="Form controls">
        <VStack gap={12}>
          <Input name="q" label="Search" icon="search" placeholder="Anything…" clearable />
          <Select name="plan" label="Plan" value="pro" options={{ free: 'Free', pro: 'Pro', team: 'Team' }} />
          <Checkbox name="terms" label="Accept terms" checked />
          <Switch name="alerts" label="Email alerts" description="Weekly summary." />
          <RadioGroup name="size" label="Size" value="m" orientation="horizontal" options={{ s: 'Small', m: 'Medium', l: 'Large' }} />
          <Combobox name="country" label="Country" value="de" placeholder="Search…"
                    options={{ de: 'Germany', fr: 'France', it: 'Italy', es: 'Spain', nl: 'Netherlands' }} />
          <RadioGroup name="density" label="Density" variant="segmented" value="comfortable" options={{ compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }} />
          <OtpInput name="code" label="Verification code" length={6} />
          <Rating name="stars" label="Rating" value={4} />
          <Slider name="volume" label="Volume" value={30} showValue unit="%" />
          <DatePicker name="due" label="Due date" value="2025-06-15" locale="en-US" />
          <TagInput name="topics" label="Topics" value="css,html" max={5} suggestions="css,html,js,a11y" helperText="Press Enter or comma to add." />
          <FileUpload name="attachments" label="Attachments" multiple accept=".pdf,image/*" maxSize="5MB" helperText="PDF or images, up to 5 MB each." />
        </VStack>
      </Card>
    </Grid>

    <Card title="Menus and toolbars">
      <CardActions><Menu items={[{ text: 'Edit', icon: 'edit' }, { text: 'Delete', icon: 'trash' }]} /></CardActions>
      <VStack gap={12}>
        <MenuBar items={[
          { text: 'File', items: [{ text: 'New' }, { text: 'Open…' }] },
          { text: 'Edit', items: [{ text: 'Undo' }, { text: 'Redo' }] }
        ]} />
        <Toolbar>
          <Button icon="plus">New</Button>
          <Separator />
          <Button icon="refresh" aria-label="Refresh" />
        </Toolbar>
        <Divider label="or" />
        <HStack gap={8} wrap>
          <Button id="open-dialog" variant="outline" onClick={() => dialog.current?.open()}>Open dialog</Button>
          <Button id="open-drawer" variant="outline" onClick={() => drawer.current?.open()}>Open drawer</Button>
          <Popover label="Share">
            <PopoverTrigger><Button variant="outline" icon="send">Share</Button></PopoverTrigger>
            <Input name="link" label="Link" value="https://example.com/ssg" readonly />
          </Popover>
          <Avatar alt="Ada Lovelace" status="online" />
          <Button variant="outline" icon="settings" tooltip="Settings" />
          <Tooltip content="Server-rendered tooltip">
            <Button variant="ghost" icon="info" aria-label="About" />
          </Tooltip>
        </HStack>
      </VStack>
    </Card>

    <Grid minColumnWidth="18rem" gap={16}>
      <Panel title="Admin pieces">
        <Stat label="Revenue" value="$48,200" delta={12.5} deltaLabel="vs last month" trend={[4, 6, 5, 8, 7, 9, 12]} />
        <Descriptions columns={2} data={[{ label: 'Customer', value: 'Acme Corp' }, { label: 'Total', value: '$2,400' }]} />
        <Empty icon="inbox" title="No orders yet" description="They appear here." />
        <PageHeader title="Orders" level={2} description="This week"><Button slot="actions" size="sm">New</Button></PageHeader>
      </Panel>
      <Panel title="Sidebar layout">
        <Sidebar sideWidth="8rem" gap={8}><span>Side</span><span>Content</span></Sidebar>
      </Panel>
      <Panel title="List">
        <List label="Tasks" reorderable field="title" descriptionField="due" data={[
          { id: 1, title: 'Send invoices', due: 'Mon' }, { id: 2, title: 'Review pricing', due: 'Tue' }, { id: 3, title: 'Fix webhook', due: 'Wed' }
        ]} />
      </Panel>
      <Panel title="Tree">
        <Tree data={[
          { text: 'src', expanded: true, children: [{ text: 'index.ts' }, { text: 'ssr', children: [{ text: 'index.ts' }] }] },
          { text: 'README.md' }
        ]} />
      </Panel>
      <Card title="Form" subtitle="Validates, then fires submit">
        <Form id="profile" columns={1}
              onSubmit={(e: CustomEvent) => NX.toast.success('Saved', { description: JSON.stringify(e.detail.values) })}>
          <Input name="name" label="Name" required />
          <Textarea name="bio" label="Bio" rows={2} />
          <Button slot="buttons" type="submit">Save</Button>
        </Form>
      </Card>
    </Grid>

    <Card title="Command">
      <Command placeholder="Search…" items={[
        { text: 'Home', icon: 'home', group: 'Pages' },
        { text: 'Contact', icon: 'mail', group: 'Pages' },
        { text: 'Toggle theme', icon: 'theme', group: 'Actions' }
      ]} />
    </Card>

    <Dialog ref={dialog} id="dialog" title="Server-rendered dialog" description="Closed until you open it.">
      <p>Dialogs render in the HTML too, closed.</p>
      <DialogFooter><Button id="close-dialog" onClick={() => dialog.current?.close()}>Close</Button></DialogFooter>
    </Dialog>
    <Drawer ref={drawer} id="drawer" title="Drawer" description="A sheet from the side.">
      <p>Drawer content.</p>
    </Drawer>
  </Layout>
);

export const pages = { index: Home, components: Components, contact: Contact };
