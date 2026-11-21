# Data and logic

The parts of nx.js that are not on the screen: stores, models, proxies, view models, controllers, remembered state and formatting. They work without any component, so they are easy to test, and every one is also on the `NX` object.

## Stores

A store holds a list of records and gives you the usual list operations.

```ts
import { Store } from 'nx.js';

const users = new Store({
  data: [{ id: 1, name: 'Ada', country: 'UK', revenue: 30 }, { id: 2, name: 'Bob', country: 'US', revenue: 10 }],
  sorters: [{ property: 'name', direction: 'ASC' }]
});

users.filter({ property: 'country', value: 'UK' });   // eq, ne, gt, gte, lt, lte, like, in, or filterFn
users.filter({ property: '*', operator: 'like', value: 'ad' });   // any field: what a search box wants
users.sort({ property: 'revenue', direction: 'DESC' });
users.sum('revenue'); users.average('revenue'); users.min('revenue'); users.max('revenue');
users.getGroups('country', 'revenue');    // [{ key, records, count, sum, average, min, max }]
```

- **Filtering keeps everything.** Records that are filtered out are still in the store: they can be found by id, and edits to them are still saved.
- **Sorting** is ascending unless you say `DESC`, and empty values come last either way.
- **Changes** are tracked: `update(record, { name: 'Ada L.' })`, `add()`, `remove()`; then `getModifiedRecords()`, `isDirty()`, `rejectChanges()`, `commitChanges()`. `sync()` sends them through the proxy.
- **Events:** `load`, `add`, `remove`, `update`, `datachanged`, `filterchange`, `sortchange`, `validate`, `exception`, `beforesync`, `sync`.
- **Grouping:** `groupField: 'country'` in the config, or `users.group('country', 'DESC')` later (`group()` removes it). Groups stay together (the group field is the first thing the store sorts by), `getGroups()` uses it, and a `groupchange` event fires.
- Also `first()`, `last()`, `indexOf()`, `insert(index, records)`, `removeAt(index)`, `getFilters()`, `getSorters()`.

`NX.store('name', config)` registers a store under a name so a component can say `store="name"`.

## Proxies: talking to a server

Give a store a `proxy` and it loads and saves through it:

```ts
const orders = new Store({
  proxy: { type: 'rest', url: '/api/orders', reader: { rootProperty: 'items', totalProperty: 'total' } },
  autoLoad: true
});
```

| `type` | What it does |
| --- | --- |
| `rest` | One request per record, the id in the URL: `POST /api/orders`, `PUT /api/orders/7`, `DELETE /api/orders/7` |
| `ajax` | Records sent together: `POST`/`PUT` with an array, `DELETE` with `{ ids }` |
| `memory` | Records kept in an array (tests, demos); start them with `data` |
| `localstorage` | Records kept in `localStorage` under `url` as the key |

Options: `api` (a different URL per operation), `reader` and `writer` (`rootProperty` wraps what is sent and unwraps what comes back), `headers`, `extraParams` (added to every read), `timeout` (milliseconds) and `idProperty`.

### `NX.ajax`

The request helper the proxies use, for your own calls:

```ts
const user = await NX.ajax('/api/users/7');
await NX.ajax('/api/users', { method: 'POST', body: { name: 'Ada' }, timeout: 5000 });
```

It sends `body` as JSON (strings, `FormData` and `URLSearchParams` go as they are), adds `params` to the query string, reads JSON back, and **throws an `AjaxError` for a bad status**, with the status and the server's `message`. Pass `signal` to cancel it.

## The API client

Describe a server once and get requests, models and stores that all go through it, so views talk to it without glue.

```ts
const api = NX.api({
  baseUrl: 'https://api.example.com/v1',
  auth: { token: () => session.token, refresh: async () => { await signIn.renew(); } },   // Authorization: Bearer …; on 401: renew, repeat once
  timeout: 10_000,
  retries: 2,                       // reads and dropped connections are repeated (a write that reached the server is not)
  onError: error => error.status === 403 && NX.toast.error('You are not allowed to do that'),
  resources: {
    users: { path: '/users', fields: ['id', 'name', { name: 'age', type: 'int' }], pageSize: 25 },
    notes: { path: '/notes', reader: { rootProperty: 'items', totalProperty: 'count' }, remote: false }   // sort and filter in the browser
  }
});

api.register();                          // a named store per resource, so views can say store="users"
```

```html
<nx-grid store="users"></nx-grid>       <!-- loads, sorts, searches and saves through the API -->
```

```ts
await api.store('users').load();         // the same store every time; pass options for a separate one
const User = api.model('users');         // a model that loads and saves through the client
const { data, total } = await api.client('users').list({ page: 2 });
await api.client('users').update(7, { name: 'Ada L.' });
await api.get('/me');  await api.post('/login', { email, password });   // any other call
```

- **A store for a resource** loads with the server sorting, filtering and paging (`page`, `start`, `limit`, `sort` and `filter` as JSON), saves edits per record (`PUT /users/7`), and a grid bound to it asks the server when you sort a column or search, instead of re-sorting what it has. Set `remote: false` on a resource to keep that in the browser.
- **`params`** renames the parameters for a server that wants others: `params: s => ({ _page: s.page, per_page: s.limit, order: s.sort.map(x => (x.direction === 'DESC' ? '-' : '') + x.property).join(',') })`.
- **`headers`** can be an object or an async function; `onRequest(url, options)` can change any request before it is sent, `onResponse(data, url)` sees every answer, and `onError(error, url)` sees every failure after a refresh and repeats were tried. Errors are `AjaxError`s with the status and the server's message.

### Clients made from a description

You do not have to write the resources out. If the server describes itself, let the client read it.

**OpenAPI** (3.x or Swagger 2, as JSON: an object, a JSON string, or the URL of a document):

```ts
const api = await NX.openapi('/openapi.json', { auth: { token: () => session.token } });

await api.operations.listPets({ limit: 10, species: 'cat' });      // every operation is a function, named by its operationId
await api.operations.getPet({ petId: 7 });                         // path, query and header parameters in one object
await api.operations.updatePet({ petId: 7 }, { name: 'Rex' });     // the JSON body is the second argument

api.register();                    // and every collection with its item path is already a resource:
// <nx-grid store="pets"></nx-grid>
const Pet = api.model('pets');     // typed fields, required fields, lengths, ranges, patterns, enums and formats from the schema
```

- **Resources** are found where a path can be listed (`GET /pets`) and has an item path (`/pets/{petId}`). Fields come from the item's schema (`$ref`, `allOf` and `oneOf` are followed): types, defaults, `nullable`, required fields as `presence`, and `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `enum`, `format: email|uri` as validators. `readOnly` fields are never sent back.
- **A list** can be a bare array or an object with the array in `data`, `items`, `results` and the like; the total is read from `total`, `totalCount` and the like.
- **Parameters** are worked out from what the list declares: `limit` or `per_page`, `offset` or `page`, `sort` (with `-name`, or a separate `order` or `direction`), and `q` or `search` for a search box. A property with a query parameter of its own is sent as that parameter.
- **What was checked against a real server:** the Swagger Petstore (`https://petstore3.swagger.io/api/v3/openapi.json`), its document and its live API: all 19 operations, path and query parameters, a root-relative `servers` address (`/api/v3`, resolved against the document's own site), text answers (`loginUser`), lists as repeated query names (`tags=a&tags=b`) and the server's own error answers. That API has no listable collection with an item path, so no resources are made from it: use `api.operations`. Security schemes (API keys, OAuth flows) are not read from the document: pass `auth` or `headers` yourself.
- An operation whose success answer is a string (or has no JSON form) is read as text. A query parameter given a list of plain values is sent as the name repeated (`tags=a&tags=b`).
- The base URL comes from `servers` (or `host` and `basePath`); `baseUrl` in the config wins. Anything you list under `resources` replaces what was found. A document that is not JSON (YAML) must be converted first.

**HAL** (hypermedia): start at one address and follow links.

```ts
const hal = NX.hal('/api', { auth: { token: () => session.token } });

await hal.resources();             // ['orders', 'customers']: the entry document's relations, by short name
await hal.register();              // a named store for each, so views can say store="orders"
const orders = await hal.store('orders');
await orders.load();               // follows  /api/orders{?page,size,sort,q}  with the template filled in

const order = (await hal.follow('orders')).embedded('orders')[0];
const customer = await order.follow('customer');         // links on any resource
order.href('payment', { method: 'card' });               // a templated link, filled in
```

- **Stores** read the embedded records (`_embedded.orders`), take each record's id from its `id` field or its `self` link, and read the total from `page.totalElements` (or `total`, `count`). `page`, `size` and `sort` are filled in only where the link's template has them: a template with `sort` makes the server sort, one without keeps sorting in the browser. Page numbers start at zero, like Spring; pass `zeroBasedPages: false` for servers that start at one.
- **Saving** uses each record's own links: `PUT` and `DELETE` go to its `self`, new records are `POST`ed to the collection, and what the server sends back is read as HAL.
- **URI templates** (`{id}`, `{+path}`, `{/a,b}`, `{.ext}`, `{?a,b}`, `{&a}`, and `*` for lists) are filled in by `expandTemplate(template, vars)`. A variable you leave out is left out.

## Models

A model describes a kind of record: typed fields, defaults, rules, and how to load and save it.

```ts
const User = NX.model<{ id: number; name: string; email: string; age: number }>({
  fields: [
    { name: 'id', type: 'int', allowNull: true },
    { name: 'name', validators: ['presence', { type: 'length', max: 40 }] },
    { name: 'email', validators: ['email'] },
    { name: 'age', type: 'int', defaultValue: 18, validators: [{ type: 'range', min: 0, max: 130 }] },
    { name: 'city', mapping: 'address.city' }            // read from nested data
  ],
  proxy: { type: 'rest', url: '/api/users' }
});

const ada = new User({ name: 'Ada', email: 'ada@example.com' });
ada.set('age', '36');             // converted to the number 36
ada.dirty;  ada.modified;         // what changed, with the old values
ada.validate();                   // { valid: true, errors: {} }
await ada.save();                 // POST, or PUT once it has an id; takes what the server sends back
const grace = await User.load(7); // GET /api/users/7
```

- **Field types:** `string`, `int`, `float`, `number`, `boolean`, `date`, `auto` (kept as is). Bad values become a safe default (`0`, `''`, `false`) unless `allowNull` keeps `null`. `convert(value, data)` is your own conversion, and can compute a field from others. `persist: false` leaves a field out of what is saved.
- **Validators:** `presence`, `email`, `url`, `length` (`min`, `max`), `range` (`min`, `max`), `format` (`matcher`), `inclusion` and `exclusion` (`list`), or a function that returns `true`, a message, or a list of messages. Every rule except `presence` lets an empty value through. Messages are translated (`validate('es')`, or the page's language), and `message` sets your own.
- **A store can use a model:** `new Store({ model: User, data })` converts what it holds, checks every edit (`record.errors`, a `validate` event), and uses the model's id property. `store.validate()` checks everything and returns the records with problems.

### Associations

Models can point at each other. Nested data in the incoming record is used as it is; otherwise the other side is loaded through its own proxy.

```ts
const Order = NX.model({ name: 'order', fields: ['id', 'userId', { name: 'total', type: 'float' }], proxy: { type: 'rest', url: '/api/orders' } });
const User = NX.model({
  name: 'user',
  fields: ['id', 'name'],
  proxy: { type: 'rest', url: '/api/users' },
  associations: [{ type: 'hasMany', name: 'orders', model: () => Order, foreignKey: 'userId' }]   // a function when the model is defined later
});

const ada = new User({ id: 1, name: 'Ada', orders: [{ id: 10, total: 5 }] });
ada.orders();                      // a Store of her orders (from the nested data: no request), converted by Order
ada.orders().add({ total: 3 });    // gets userId = 1 (and follows the id if ada is saved later)
await ada.loadAssoc('orders');     // GET /api/orders?userId=1

const Line = NX.model({ name: 'line', fields: ['id', 'orderId'], associations: [{ type: 'belongsTo', name: 'order', model: () => Order }] });
line.getOrder();                   // the order if it is known (nested data, setOrder, or an earlier load), else undefined
await line.loadAssoc('order');     // GET /api/orders/<orderId>
line.setOrder(other);              // changes orderId; setOrder(null) clears it
```

`foreignKey` defaults to `<owner name>Id` for `hasMany` and `<name>Id` for `belongsTo`. Nested data is kept out of the record's fields, so it is never saved with it.

## Sessions

A session is one place records live while a screen is in use. Asking for the same record twice gives the same object, so an edit shows everywhere it is shown, and all the changes save together.

```ts
const session = NX.session();
const ada = await session.load(User, 1);        // fetched once; the next load(User, 1) is the same object
const cleo = session.create(User, { name: 'Cleo' });
ada.set('name', 'Ada L.');
session.erase(bob);

session.getChanges();     // { created: [cleo], updated: [ada], erased: [bob] }
await session.save();     // creates, then updates, then deletes: { saved: 3, errors: [] }
session.reject();         // undo everything instead
```

One failing save does not stop the others: it is listed in `errors` and its record stays changed, so you can try again. Events: `change`, `beforesave`, `save`, `reject`.

## Tree stores

A tree store holds records with parents and children.

```ts
const tree = NX.treeStore({
  root: [{ id: 'fruit', name: 'Fruit', children: [{ id: 'apple', name: 'Apple' }, { id: 'pear', name: 'Pear' }] }, { id: 'veg', name: 'Vegetables' }],
  sorters: [{ property: 'name' }]
});

await tree.expand('fruit');            // or expandAll(), collapse(), toggle(), reveal(id)
tree.getVisible();                     // the nodes to show: open nodes' children, in order
tree.filter({ property: 'name', operator: 'like', value: 'app' });   // matches and the way down to them; nothing is opened for good
tree.appendChild({ name: 'Plum' }, 'fruit');   tree.moveNode('pear', 'veg');   tree.removeNode('apple');
treeElement.data = tree.toItems({ text: 'name' });      // feed <nx-tree>
```

A node marked `leaf: false` with no children is **loaded when first opened**: with a `proxy`, `GET <url>?node=<id>` answers a list of nodes. `toItems()` marks such nodes `lazy`, so `<nx-tree>` shows an expander for them and emits `toggle` when you open one: load the children, then set the tree's data again. A node cannot be moved into itself or below itself. Events: `load`, `add`, `remove`, `move`, `expand`, `collapse`, `update`, `filterchange`, `sortchange`, `datachanged`.

## View models: data that views bind to

A view model holds data and **formulas** computed from it. Bind to it, and everything bound updates, once, when the data changes.

```ts
const vm = NX.viewModel({
  data: { user: { first: 'Ada', last: 'Lovelace' }, accepted: false },
  formulas: {
    full: get => `${get('user.first')} ${get('user.last')}`,     // what it reads is what it depends on
    canSubmit: get => get('accepted') && get('full').length > 3
  },
  stores: { users: { proxy: { type: 'rest', url: '/api/users' } } }   // made when first asked for: vm.getStore('users')
});

vm.get('user.first');
vm.set('user.first', 'Grace');                 // or vm.set({ 'user.first': 'Grace', accepted: true })
vm.bind('Hello {full}!', text => (label.textContent = text));
```

An expression is a path (`user.first`), a template (`Hello {user.first}`; it waits until everything in it has a value), `{path}` for the raw value, `!path` for the opposite, or a list of paths. Calls are batched in the next microtask (`vm.flush()` runs them now) and only happen when the value really changed. A formula that is read-only becomes settable with `{ get, set }`. `vm.createChild()` makes a model that sees its parent's data and can add its own; setting data that belongs to the parent changes the parent.

### Binding to elements

```html
<nx-input bind-value="user.first" label="First name"></nx-input>
<p bind-text="Hello, {full}!"></p>
<nx-button bind-disabled="!canSubmit">Save</nx-button>
<div bind-class-open="menuOpen" bind-attr-data-user="user.first"></div>
```

```ts
vm.bindAll(document.querySelector('#form')!);    // reads every bind-… attribute under it
vm.bindElement(input, { value: 'user.first' });  // or one element, from code
```

`store` hands one of the view model's stores to a grid (`bind-store="users"`). `value` and `checked` are two-way: typing sets the data. `text` is always text, never markup. `hidden`, `disabled`, `readonly` and `required` toggle the attribute; `class:name` toggles a class; `attr:name` sets an attribute (`false` or `null` removes it). Going the other way, from a component into the data: `selection` (a grid's selected rows), `selected` (the first, or `null`) and `event:name` (any event's detail), as in `<nx-grid bind-store="users" bind-selection="picked" bind-event-sort-change="sort">`; then `<p bind-text="{picked.length} selected">` follows. Both return `{ destroy() }`.

## Controllers

A controller is the code for a part of a page, kept apart from the markup. It handles events by selector (elements added later work too, and events from inside a component's shadow DOM find their host), finds elements by `reference`, and can own a view model.

```ts
const c = NX.controller({
  root: document.querySelector('#orders')!,
  viewModel: { data: { query: '' } },               // bound to the bind-… attributes under root
  control: {
    'nx-button.save': { click: (e, button, c) => save(c.viewModel!.get('query')) },
    'nx-input': { input: [validate, track] }
  }
});
c.lookup('grid');            // the element marked reference="grid"
c.destroy();
```

A handler that throws does not stop the others. Events that do not bubble (`focus`, `blur`, `mouseenter`…) are caught too.

## Remembered state

```ts
NX.state.set('sidebar', { collapsed: true });
NX.state.get('sidebar', { collapsed: false });
NX.state.on('sidebar', value => update(value));
```

Values are JSON, kept in `localStorage` (`new StateProvider({ storage: 'session' })` for the tab only). It never throws: when storage is blocked or full, it keeps the value in memory for the page. The grid's `state-key` and the splitter's `state-key` use it too.

## Formatting and timing

```ts
NX.format.number(1234.5);                 // 1,234.5   (or 1.234,5 on a German page)
NX.format.currency(1234.5, 'EUR');
NX.format.percent(0.256, 1);              // 25.6%
NX.format.fileSize(1536);                 // 1.5 KB
NX.format.date('2026-03-04', 'long');     NX.format.relativeTime(date);   // 3 minutes ago
NX.format.duration(3725000);              // 1h 2m 5s
NX.format.plural(2, { one: 'item', other: 'items' });
NX.format.ellipsis(text, 40);             NX.format.htmlEncode(text);

const search = NX.utils.debounce(run, 250);   // also .cancel(), .flush(), .pending()
const scroll = NX.utils.throttle(update, 100);
const poll = NX.task({ run: refresh, interval: 5000, repeat: 10 });   // return false to stop; never overlaps itself
poll.stop();   NX.stopTasks();
```

Formatters take an optional `locale` and follow the page's `lang` otherwise. A value that is not a number or a date gives an empty string, never `NaN` or `Invalid Date`.
