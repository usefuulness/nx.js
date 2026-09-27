/**
 * Pages of the static site. Plain JSX that reads like HTML — the same code
 * would run in the browser, but here it is rendered once at build time.
 *
 * Only serializable props (strings, numbers, arrays, objects) survive into the
 * HTML. Behaviour belongs in client.ts, which listens for component events.
 */
import { Accordion, AccordionItem, Badge, Button, Card, CardFooter, Checkbox, DataGrid, Form, HStack, Input, Select, Tab, Tabs, Textarea, VStack } from 'nx.js';

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
      <nav><a href="./index.html">Home</a> · <a href="./contact.html">Contact</a></nav>
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

export const pages = { index: Home, contact: Contact };
