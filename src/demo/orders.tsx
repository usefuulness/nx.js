/**
 * The Orders page: what an admin portal screen is made of. A page header with its actions, a row of key figures,
 * a filter bar, a grid with bulk actions, and a detail panel beside it that stacks underneath on a narrow screen
 * (the `sidebar` layout). Everything is the public API.
 */
import {
  NX, Badge, Box, Button, Card, Cluster, DataGrid, Descriptions, Empty, Grid, HStack, Input, Select, Sidebar, Stat, VStack, type Child, type NXGrid
} from '@/index';

type Order = { id: string; customer: string; total: number; status: 'paid' | 'pending' | 'shipped' | 'refunded'; placed: string; country: string };

const customers = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Ltd', 'Wayne Co', 'Soylent'];
const countries = ['US', 'DE', 'FR', 'ES', 'GB'];
const statuses: Order['status'][] = ['paid', 'pending', 'shipped', 'refunded'];
const seed = (): Order[] => Array.from({ length: 36 }, (_, i) => ({
  id: `#${3000 + i}`,
  customer: customers[(i * 5) % customers.length],
  total: 40 + ((i * 137) % 900),
  status: statuses[(i * 7 + (i % 3)) % statuses.length],
  placed: `2026-06-${String(1 + (i % 28)).padStart(2, '0')}`,
  country: countries[(i * 3) % countries.length]
}));

const money = (n: number) => NX.format.currency(n, 'USD');

export const OrdersPage = ({ Page }: { Page: (props: any) => any }) => {
  let orders = seed();
  let query = '';
  let status = '';
  const grid = { current: null as NXGrid<Order> | null };
  const bulk = { current: null as HTMLDivElement | null };
  const bulkCount = { current: null as HTMLSpanElement | null };
  const detail = { current: null as HTMLDivElement | null };
  const figures = { current: null as HTMLDivElement | null };
  let selected: Order[] = [];

  const shown = () => orders.filter(o => (!status || o.status === status) && (!query || `${o.id} ${o.customer}`.toLowerCase().includes(query)));

  const paintFigures = () => {
    const open = orders.filter(o => o.status === 'pending');
    const paid = orders.filter(o => o.status === 'paid' || o.status === 'shipped');
    const set = (id: string, attrs: Record<string, string>) => Object.entries(attrs).forEach(([k, v]) => figures.current?.querySelector(`#${id}`)?.setAttribute(k, v));
    set('or-revenue', { value: money(paid.reduce((s, o) => s + o.total, 0)) });
    set('or-open', { value: String(open.length) });
    set('or-refunds', { value: String(orders.filter(o => o.status === 'refunded').length) });
  };

  const paintDetail = () => {
    const host = detail.current!;
    const one = selected.length === 1 ? selected[0] : null;
    host.replaceChildren(
      one
        ? (
          <VStack gap={16}>
            <HStack gap={8} align="center">
              <strong id="or-detail-title">Order {one.id}</strong>
              <Badge variant={({ paid: 'success', pending: 'warning', shipped: 'info', refunded: 'destructive' } as const)[one.status]}>{one.status}</Badge>
            </HStack>
            <Descriptions columns={1} layout="horizontal" data={[
              { label: 'Customer', value: one.customer }, { label: 'Total', value: money(one.total) },
              { label: 'Placed', value: NX.format.date(one.placed) }, { label: 'Country', value: one.country }
            ]} />
          </VStack>
        ) as Node
        : (
          <Empty id="or-empty" icon="inbox" title={selected.length > 1 ? `${selected.length} orders selected` : 'No order selected'}
                 description={selected.length > 1 ? 'Use the actions above the table to change them together.' : 'Pick an order in the table to see its details here.'} />
        ) as Node
    );
  };

  const refresh = () => {
    grid.current?.setData(shown());
    paintFigures();
    selected = [];
    bulk.current?.toggleAttribute('hidden', true);
    paintDetail();
  };

  const change = (to: Order['status']) => {
    const ids = new Set(selected.map(o => o.id));
    orders = orders.map(o => (ids.has(o.id) ? { ...o, status: to } : o));
    NX.toast.success(`${ids.size} order${ids.size === 1 ? '' : 's'} marked ${to}`);
    refresh();
  };

  const page = (
    <Page
      title="Orders"
      description="A screen built from the admin pieces: figures, filters, a table with bulk actions, and a detail panel."
      actions={<Button icon="download" variant="outline" onClick={() => NX.toast.success('Orders exported', { description: 'orders-2026-06.csv' })}>Export</Button>}
    >
      <div ref={figures} style="display: contents">
        <Grid minColumnWidth={200} gap={16}>
          <Card><Stat id="or-revenue" label="Paid revenue" value="" delta={8.2} deltaLabel="vs last month" icon="dollar" trend={[4, 6, 5, 8, 7, 9, 12]} /></Card>
          <Card><Stat id="or-open" label="Awaiting payment" value="" delta={3} invert deltaLabel="vs last month" icon="clock" /></Card>
          <Card><Stat id="or-refunds" label="Refunds" value="" delta={-12} invert deltaLabel="vs last month" icon="activity" /></Card>
        </Grid>
      </div>

      <Sidebar side="end" sideWidth="20rem" contentMin="55%" gap={16}>
        <VStack gap={12}>
          <Cluster gap={8}>
            <Input id="or-search" type="search" icon="search" clearable placeholder="Search orders…" label="Search orders" style="width: 16rem"
                   onInput={(e: Event) => { query = ((e.target as any).value ?? '').toLowerCase().trim(); refresh(); }} />
            <Select id="or-status" label="Status" options={[{ value: '', text: 'All statuses' }, ...statuses.map(s => ({ value: s, text: s }))]}
                    onChange={(e: CustomEvent) => { status = e.detail?.value ?? (e.target as any).value ?? ''; refresh(); }} />
          </Cluster>
          <div ref={bulk} id="or-bulk" hidden style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem">
            <span ref={bulkCount} id="or-bulk-count" role="status" />
            <Button size="sm" variant="outline" onClick={() => change('shipped')}>Mark shipped</Button>
            <Button size="sm" variant="outline" onClick={() => change('refunded')}>Refund</Button>
          </div>
          <DataGrid
            ref={grid}
            id="or-grid"
            data={shown()}
            checkboxSelection
            striped
            columns={[
              { field: 'id', header: 'Order', width: 90, sortable: true },
              { field: 'customer', header: 'Customer', sortable: true },
              { field: 'total', header: 'Total', type: 'number', width: 100, sortable: true, align: 'right' },
              { field: 'status', header: 'Status', type: 'badge', width: 110, sortable: true, badges: { paid: 'success', pending: 'warning', shipped: 'info', refunded: 'error' } },
              { field: 'placed', header: 'Placed', type: 'date', width: 120, sortable: true }
            ]}
            emptyText="No orders match"
            onSelectionChange={(e: CustomEvent) => {
              selected = e.detail.selected;
              bulk.current!.toggleAttribute('hidden', selected.length === 0);
              bulkCount.current!.textContent = `${selected.length} selected`;
              paintDetail();
            }}
          />
        </VStack>
        <Card title="Details"><div ref={detail} id="or-detail" /></Card>
      </Sidebar>
    </Page>
  );

  queueMicrotask(() => { paintFigures(); paintDetail(); });
  return page;
};
void Box; void (null as unknown as Child);
