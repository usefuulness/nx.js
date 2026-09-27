/**
 * Pages of the static site. Plain JSX that reads like HTML — the same code
 * would run in the browser, but here it is rendered once at build time.
 *
 * Only serializable props (strings, numbers, arrays, objects) survive into the
 * HTML. Behaviour belongs in client.ts, which listens for component events.
 */
import {
  Accordion, AccordionItem, Badge, Breadcrumb, Button, Card, CardActions, CardFooter, Checkbox, DataGrid, Dialog, DialogFooter,
  Divider, Drawer, Form, Grid, HStack, Input, Menu, MenuBar, Panel, Progress, RadioGroup, Select, Separator, Skeleton, Spinner, Switch,
  Tab, Tabs, Textarea, Toolbar, Tree, VStack
} from 'nx.js';

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
      <Button id="theme" variant="ghost" icon="moon" aria-label="Toggle theme" />
    </HStack>
    {children}
  </main>
);

export const Home = () => (
  <Layout title="Nexaro, pre-rendered">
    <Card title="Rendered at build time" subtitle="Declarative Shadow DOM: this card is visible before any JavaScript loads.">
      <p>The client bundle only upgrades the elements; nothing is re-created.</p>
      <CardFooter>
        <Button id="hello" icon="zap">Say hello</Button>
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

      <Card title="Form controls">
        <VStack gap={12}>
          <Input name="q" label="Search" icon="search" placeholder="Anything…" clearable />
          <Select name="plan" label="Plan" value="pro" options={{ free: 'Free', pro: 'Pro', team: 'Team' }} />
          <Checkbox name="terms" label="Accept terms" checked />
          <Switch name="alerts" label="Email alerts" description="Weekly summary." />
          <RadioGroup name="size" label="Size" value="m" orientation="horizontal" options={{ s: 'Small', m: 'Medium', l: 'Large' }} />
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
        <HStack gap={8}>
          <Button id="open-dialog" variant="outline">Open dialog</Button>
          <Button id="open-drawer" variant="outline">Open drawer</Button>
        </HStack>
      </VStack>
    </Card>

    <Grid minColumnWidth="18rem" gap={16}>
      <Panel title="Tree">
        <Tree data={[
          { text: 'src', expanded: true, children: [{ text: 'index.ts' }, { text: 'ssr', children: [{ text: 'index.ts' }] }] },
          { text: 'README.md' }
        ]} />
      </Panel>
      <Card title="Form" subtitle="Validates, then fires submit">
        <Form id="profile" columns={1}>
          <Input name="name" label="Name" required />
          <Textarea name="bio" label="Bio" rows={2} />
          <Button slot="buttons" type="submit">Save</Button>
        </Form>
      </Card>
    </Grid>

    <Dialog id="dialog" title="Server-rendered dialog" description="Closed until you open it.">
      <p>Dialogs render in the HTML too, closed.</p>
      <DialogFooter><Button id="close-dialog">Close</Button></DialogFooter>
    </Dialog>
    <Drawer id="drawer" title="Drawer" description="A sheet from the side.">
      <p>Drawer content.</p>
    </Drawer>
  </Layout>
);

export const pages = { index: Home, components: Components, contact: Contact };
