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

`value` and `checked` are two-way: typing sets the data. `text` is always text, never markup. `hidden`, `disabled`, `readonly` and `required` toggle the attribute; `class:name` toggles a class; `attr:name` sets an attribute (`false` or `null` removes it). Both return `{ destroy() }`.

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
