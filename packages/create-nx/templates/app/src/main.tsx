import { NX, Button, Card, CardFooter, Input, Select, VStack } from 'nx.js';

// Components are plain functions that return real DOM elements: there is no virtual DOM.
// Design tokens, base styles and the light and dark themes come with `nx.js`, so no CSS import is needed.

NX.render(
  <VStack gap={24} style="max-width: 28rem; margin: 3rem auto; padding: 0 1rem">
    <Card title="Hello, nx.js" subtitle="Edit src/main.tsx and save.">
      <Input name="name" label="Your name" placeholder="Ada Lovelace" required />
      <Select name="role" label="Role" options={['Designer', 'Engineer', 'Product']} />
      <CardFooter>
        <Button variant="outline" onClick={() => NX.theme.toggle()}>Toggle theme</Button>
        <Button onClick={() => NX.toast.success('Saved!')}>Save</Button>
      </CardFooter>
    </Card>
  </VStack>,
  '#app'
);
