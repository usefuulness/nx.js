/**
 * The live data demos on the showcase page. The page's markup is server-rendered; this wires it up in the browser
 * once the components have upgraded, against the small server in mock-server.ts. Nothing here runs on the server.
 */
import { NX, type Store } from 'nx.js';
import { installMockServer, onMockRequest } from './mock-server';

type El = HTMLElement & Record<string, any>;
const $ = (id: string) => document.getElementById(id) as El | null;

/** Where the mock server lives, as an absolute address that works wherever the page is hosted */
const ROOT = new URL('__mock__/', location.href).href;

// ────────── Small helpers ──────────

function textEl(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Show each request the client sends, newest first: what it asked for, what came back, how long it took. */
function requestLog(list: HTMLElement | null, wanted: (url: string) => boolean): void {
  if (!list) return;
  onMockRequest(r => {
    if (!wanted(r.url)) return;
    list.querySelector('.sc-log-empty')?.remove();
    const row = document.createElement('li');
    row.append(
      textEl('span', 'verb', r.method),
      textEl('span', 'url', decodeURIComponent(r.url).replace(/\+/g, ' ')),
      textEl('span', r.status < 400 ? 'ok' : 'bad', String(r.status)),
      textEl('span', 'ms', `${r.ms} ms`)
    );
    list.prepend(row);
    while (list.children.length > 12) list.lastElementChild?.remove();
  });
}

function chip(verb: string, label: string, onClick?: () => void, title?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sc-chip';
  if (verb) b.append(textEl('span', 'verb', verb));
  b.append(document.createTextNode(label));
  if (title) b.title = title;
  if (onClick) b.addEventListener('click', onClick); else b.disabled = true;
  return b;
}

const pretty = (value: unknown, lines = 22) => {
  const text = JSON.stringify(value, null, 2) ?? '';
  const all = text.split('\n');
  return all.length > lines ? `${all.slice(0, lines).join('\n')}\n  …` : text;
};

const setCode = (pre: HTMLElement | null, text: string) => {
  const code = pre?.querySelector('code');
  if (code) code.textContent = text;
};

const busy = (button: El | null, on: boolean) => button?.setLoading?.(on);

/** Keep a pager in step with a store that pages on the server */
function pageWith(store: Store<any>, pager: El | null): void {
  if (!pager) return;
  const sync = () => {
    pager.setAttribute('total', String(store.getTotalCount()));
    pager.setAttribute('page', String(store.getCurrentPage()));
  };
  store.on('load', sync);
  pager.addEventListener('page-change', e => { void store.loadPage((e as CustomEvent).detail.page).catch(() => {}); });
}

// ────────── OpenAPI ──────────

function openApiDemo(): void {
  requestLog($('oa-log'), url => url.startsWith('/openapi.json') || url.startsWith('/v1/'));
  const read = $('oa-read'), status = $('oa-status'), ops = $('oa-ops'), grid = $('oa-grid'), pager = $('oa-pager');
  const form = $('oa-form') as unknown as HTMLFormElement | null;
  const name = $('oa-name'), species = $('oa-species'), age = $('oa-age'), add = $('oa-add'), result = $('oa-result');
  if (!read || !status || !ops || !grid || !form || !name || !species || !age || !add) return;

  let api: any;
  let Pet: any;
  let store: Store<any> | null = null;
  const touched = new Set<string>();

  const values = () => ({ name: name.value ?? '', species: species.value || undefined, age: age.value });

  /** Check the form against the rules the document declared. Messages show for fields you have touched. */
  const check = () => {
    if (!Pet) return;
    const { errors, valid } = Pet.validate(values(), 'en');
    for (const [field, el] of [['name', name], ['age', age], ['species', species]] as const) {
      const message = touched.has(field) ? errors[field]?.[0] ?? '' : '';
      if (message) el.setAttribute('error-text', message); else el.removeAttribute('error-text');
    }
    if (valid) add.removeAttribute('disabled'); else add.setAttribute('disabled', '');
  };
  for (const [field, el] of [['name', name], ['age', age], ['species', species]] as const) {
    el.addEventListener('input', () => { touched.add(field); check(); });
    el.addEventListener('change', () => { touched.add(field); check(); });
  }

  const params: Record<string, Record<string, unknown>> = { listPets: { limit: 3, sort: '-age' }, getPet: { petId: 1 } };
  const renderOps = () => {
    ops.replaceChildren(...api.operationInfo.map((op: any) => chip(
      op.method,
      op.name,
      params[op.name]
        ? async () => {
            setCode(result, '// …');
            try { setCode(result, `// api.operations.${op.name}(${JSON.stringify(params[op.name])})\n${pretty(await api.operations[op.name](params[op.name]))}`); }
            catch (e) { setCode(result, `// ${(e as Error).message}`); }
          }
        : undefined,
      params[op.name] ? `Call ${op.name}` : 'A write: use the form'
    )));
  };

  read.addEventListener('click', async () => {
    busy(read, true);
    status.textContent = 'Reading the document…';
    try {
      api = await NX.openapi(`${ROOT}openapi.json`);
      Pet = api.model('pets');
      store = api.store('pets', { pageSize: 8 });
      (grid as any).setStore(store);
      pageWith(store!, pager);
      renderOps();
      await store!.load();
      const fields = Pet.fields.filter((f: any) => f.name !== 'id').length;
      status.textContent = `Read ${api.operationInfo.length} operations and 1 resource. The model has ${fields} typed fields with the document's rules, and the grid sorts, searches and pages on the server: try it.`;
      check();
    } catch (e) {
      status.textContent = `Could not read it: ${(e as Error).message}`;
    } finally {
      busy(read, false);
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!Pet) return;
    ['name', 'age', 'species'].forEach(f => touched.add(f));
    check();
    const pet = new Pet(values());
    if (!pet.isValid('en')) return;
    busy(add, true);
    try {
      await pet.save();
      NX.toast.success(`Saved as pet #${pet.id}`, { description: pet.get('name') });
      name.value = '';
      touched.clear();
      check();
      await store?.loadPage(1);
    } catch (err) {
      NX.toast.error('The server said no', { description: (err as Error).message });
    } finally {
      busy(add, false);
    }
  });
}

// ────────── HAL ──────────

function halDemo(): void {
  requestLog($('hal-log'), url => url.startsWith('/hal/'));
  const start = $('hal-start'), status = $('hal-status'), rels = $('hal-rels'), grid = $('hal-grid'), pager = $('hal-pager');
  const trail = $('hal-trail'), detail = $('hal-detail'), links = $('hal-links');
  if (!start || !status || !rels || !grid || !trail || !detail || !links) return;

  let hal: any;
  const path: string[] = [];

  const show = (resource: any, label: string, replace = false) => {
    if (replace) path.length = 0;
    path.push(label);
    trail.replaceChildren(...path.flatMap((p, i) => (i ? [textEl('span', 'sep', '›'), textEl('span', '', p)] : [textEl('span', '', p)])));
    const hrefs = Object.fromEntries(Object.entries<any[]>(resource.links).map(([rel, list]) => [rel, list[0].href.replace(/^.*\/__mock__/, '')]));
    setCode(detail, pretty({ ...resource.data, _links: hrefs }, 24));
    links.replaceChildren(...Object.keys(resource.links).filter(r => r !== 'self').map(rel => chip('', rel, async () => {
      try { show(await resource.follow(rel), rel); } catch (e) { NX.toast.error('Could not follow it', { description: (e as Error).message }); }
    }, `Follow the "${rel}" link`)));
  };

  start.addEventListener('click', async () => {
    busy(start, true);
    status.textContent = 'Fetching the entry document…';
    try {
      hal = NX.hal(ROOT + 'hal/');
      const root = await hal.root();
      const names: string[] = await hal.resources();
      rels.replaceChildren(...names.map(rel => chip('', rel, async () => {
        const target = await hal.follow(rel);
        show(target, `/${rel}`, true);
      }, `Follow "${rel}" from the entry`)));
      show(root, '/', true);
      const books = await hal.store('books', { pageSize: 6 });
      (grid as any).setStore(books);
      pageWith(books, pager);
      await books.load();
      status.textContent = `Found ${names.length} relations: ${names.join(', ')}. The books store fills in page, size and sort from the link's template. Click a row to follow its links.`;
    } catch (e) {
      status.textContent = `Could not read it: ${(e as Error).message}`;
    } finally {
      busy(start, false);
    }
  });

  grid.addEventListener('row-click', async e => {
    if (!hal) return;
    const row = (e as CustomEvent).detail.row;
    try { show(await hal.fetch(`${ROOT}hal/books/${row.id}`), `book ${row.id}`, true); } catch (err) { NX.toast.error((err as Error).message); }
  });
}

// ────────── One view model ──────────

interface Order { id: number; date: string; product: string; category: string; region: string; amount: number }

const CATALOGUE: Record<string, string[]> = {
  hardware: ['Edge router', 'Sensor kit', 'Dev board', 'Rack server'],
  software: ['Cloud suite', 'Analytics seat', 'Security pack'],
  services: ['Onboarding', 'Support plan', 'Training day']
};
const REGIONS = ['eu', 'us', 'apac'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function makeOrders(): Order[] {
  const categories = Object.keys(CATALOGUE);
  return Array.from({ length: 72 }, (_, i) => {
    const category = categories[(i * 5) % 3];
    const products = CATALOGUE[category];
    const month = (i * 7) % 12;
    return {
      id: i + 1,
      date: `2026-${String(month + 1).padStart(2, '0')}-${String(1 + ((i * 13) % 27)).padStart(2, '0')}`,
      product: products[(i * 3) % products.length],
      category,
      region: REGIONS[(i + Math.floor(i / 3)) % 3],
      amount: 180 + ((i * 937) % 4200) + (category === 'hardware' ? 900 : category === 'services' ? 300 : 0)
    };
  });
}

function dashboardDemo(): void {
  const region = $('dash-region'), category = $('dash-category'), query = $('dash-query');
  const trend = $('dash-trend'), split = $('dash-split'), grid = $('dash-grid'), state = $('dash-state');
  if (!region || !category || !query || !trend || !split || !grid || !state) return;

  const vm = NX.viewModel({
    data: { region: 'all', category: 'all', query: '', orders: makeOrders() },
    formulas: {
      rows: get => {
        const q = String(get('query') ?? '').trim().toLowerCase();
        return (get('orders') as Order[]).filter(o =>
          (get('region') === 'all' || o.region === get('region')) &&
          (get('category') === 'all' || o.category === get('category')) &&
          (!q || o.product.toLowerCase().includes(q)));
      },
      revenue: get => (get('rows') as Order[]).reduce((s, o) => s + o.amount, 0),
      count: get => (get('rows') as Order[]).length,
      revenueText: get => NX.format.currency(get('revenue'), 'USD', 'en').replace(/\.00$/, ''),
      countText: get => String(get('count')),
      averageText: get => (get('count') ? NX.format.currency(get('revenue') / get('count'), 'USD', 'en').replace(/\.\d\d$/, '') : '—'),
      topText: get => {
        const totals = new Map<string, number>();
        for (const o of get('rows') as Order[]) totals.set(o.product, (totals.get(o.product) ?? 0) + o.amount);
        return [...totals].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      },
      trend: get => {
        const sums = Array(12).fill(0);
        for (const o of get('rows') as Order[]) sums[Number(o.date.slice(5, 7)) - 1] += o.amount;
        return sums;
      },
      split: get => {
        const sums = new Map<string, number>();
        for (const o of get('rows') as Order[]) sums.set(o.region, (sums.get(o.region) ?? 0) + o.amount);
        return REGIONS.filter(r => sums.has(r)).map(r => ({ label: r.toUpperCase(), value: sums.get(r)! }));
      }
    }
  });

  // The controls write into the data; everything else only reads from it
  vm.bindElement(region, { value: 'region' });
  vm.bindElement(category, { value: 'category' });
  vm.bindElement(query, { value: 'query' });
  vm.bindElement($('dash-revenue')!, { text: '{revenueText}' });
  vm.bindElement($('dash-count')!, { text: '{countText}' });
  vm.bindElement($('dash-average')!, { text: '{averageText}' });
  vm.bindElement($('dash-top')!, { text: '{topText}' });

  vm.bind('trend', (sums: number[]) => {
    trend.setAttribute('labels', JSON.stringify(MONTHS));
    trend.setAttribute('series', JSON.stringify([{ name: 'Revenue', data: sums }]));
  });
  vm.bind('split', (data: unknown[]) => split.setAttribute('data', JSON.stringify(data)));

  const store = NX.store<Order>({ data: [] });
  (grid as any).setStore(store);
  vm.bind('rows', (rows: Order[]) => store.loadData(rows.map(o => ({ ...o }))));

  vm.bind(['region', 'category', 'query', 'countText', 'revenueText'], ([r, c, q, n, rev]: string[]) => {
    setCode(state, pretty({ region: r, category: c, query: q, orders: Number(n), revenue: rev }));
  });
}

// ────────── A tree that loads as you open it ──────────

function treeDemo(): void {
  requestLog($('tree-log'), url => url.startsWith('/tree'));
  const view = $('tree-view'), query = $('tree-query'), expand = $('tree-expand'), collapse = $('tree-collapse'), count = $('tree-count');
  if (!view || !query || !expand || !collapse || !count) return;

  const tree = NX.treeStore({
    root: [
      { id: 'docs', name: 'Documents', expanded: true, children: [
        { id: 'report', name: 'report.pdf' }, { id: 'notes', name: 'notes.txt' }, { id: 'budget', name: 'budget.xlsx' },
        { id: 'archive', name: 'Archive', children: [{ id: 'z24', name: '2024.zip' }, { id: 'z25', name: '2025.zip' }] }
      ] },
      { id: 'pictures', name: 'Pictures', leaf: false },
      { id: 'music', name: 'Music', leaf: false },
      { id: 'readme', name: 'readme.md' }
    ],
    proxy: { type: 'rest', url: `${ROOT}tree`, reader: { rootProperty: 'data' } }
  });

  const render = () => {
    view.setData(tree.toItems({ text: 'name', icon: n => (n.leaf ? 'file' : 'folder') }));
    count.textContent = `${tree.getVisible().length} of ${tree.getCount()} loaded nodes shown. Folders you have not opened are not searched.`;
  };

  view.addEventListener('toggle', async e => {
    const { nodeId, expanded } = (e as CustomEvent).detail;
    try {
      if (expanded) await tree.expand(nodeId); else tree.collapse(nodeId);
    } catch (err) {
      NX.toast.error('Could not open it', { description: (err as Error).message });
    }
    render();
  });

  query.addEventListener('input', NX.utils.debounce(() => {
    const value = String(query.value ?? '').trim();
    tree.filter(value ? { property: 'name', operator: 'like', value } : undefined);
    render();
  }, 150));
  expand.addEventListener('click', async () => {
    busy(expand, true);
    try { await tree.expandAll(); } catch (err) { NX.toast.error('Could not open everything', { description: (err as Error).message }); }
    busy(expand, false);
    render();
  });
  collapse.addEventListener('click', () => { tree.collapseAll(); render(); });
  render();
}

/** Start every demo. Call once, after the page's components have upgraded. */
export function mountDataDemos(): void {
  installMockServer();
  openApiDemo();
  halDemo();
  dashboardDemo();
  treeDemo();
}
