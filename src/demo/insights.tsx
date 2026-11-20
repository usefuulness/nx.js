/**
 * The dashboard's insight panels: revenue over a chosen range (one view model drives the figures and the
 * chart), where sales come from, what is coming up, and recent activity.
 */
import { NX, Card, CardActions, Calendar, Chart, Grid, List, RadioGroup, Timeline, TimelineItem, VStack } from '@/index';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REVENUE = [31200, 28400, 35100, 33800, 39600, 42100, 40800, 44900, 47300, 45200, 49800, 53600];
const LAST_YEAR = [24100, 23800, 27500, 28900, 30100, 33200, 31700, 35400, 36800, 38100, 40200, 43900];

/** Revenue, with a range you can change. The range lives in a view model: the figures and the chart read from it. */
export function RevenuePanel(): HTMLElement {
  const vm = NX.viewModel({
    data: { range: '12' },
    formulas: {
      months: get => Number(get('range')),
      labels: get => MONTHS.slice(-get('months')),
      current: get => REVENUE.slice(-get('months')),
      previous: get => LAST_YEAR.slice(-get('months')),
      total: get => (get('current') as number[]).reduce((a, b) => a + b, 0),
      change: get => {
        const prev = (get('previous') as number[]).reduce((a, b) => a + b, 0);
        return prev ? ((get('total') - prev) / prev) * 100 : 0;
      },
      totalText: get => NX.format.currency(get('total'), 'USD', 'en').replace(/\.00$/, ''),
      changeText: get => `${get('change') >= 0 ? '+' : ''}${(get('change') as number).toFixed(1)}% against the same months last year`
    }
  });

  const card = (
    <Card id="revenue-card" title="Revenue" subtitle="Monthly, against the same months last year" style="grid-column: span 2">
      <CardActions>
        <RadioGroup id="revenue-range" name="range" label="Range" variant="segmented" value="12" options={{ 3: '3 months', 6: '6 months', 12: '12 months' }} />
      </CardActions>
      <VStack gap={12}>
        <div>
          <div id="revenue-total" class="stat-value" />
          <div id="revenue-change" class="muted" role="status" />
        </div>
        <Chart id="revenue-chart" type="line" label="Revenue by month" labels={MONTHS} series={[{ name: 'This year', data: REVENUE }, { name: 'Last year', data: LAST_YEAR }]} />
      </VStack>
    </Card>
  ) as HTMLElement;

  const q = (id: string) => card.querySelector(`#${id}`) as HTMLElement;
  vm.bindElement(q('revenue-range'), { value: 'range' });
  vm.bindElement(q('revenue-total'), { text: '{totalText}' });
  vm.bindElement(q('revenue-change'), { text: '{changeText}' });
  const chart = q('revenue-chart');
  vm.bind(['labels', 'current', 'previous'], ([labels, current, previous]: [string[], number[], number[]]) => {
    chart.setAttribute('labels', JSON.stringify(labels));
    chart.setAttribute('series', JSON.stringify([{ name: 'This year', data: current }, { name: 'Last year', data: previous }]));
  });
  return card;
}

/** The rest of the insights: sales by channel, what is coming up, and what just happened */
export function ActivityPanels(): HTMLElement {
  return (
    <Grid minColumnWidth={300} gap={16}>
      <Card title="Sales by channel" subtitle="Share of this year's revenue">
        <Chart type="donut" label="Sales by channel" data={[{ label: 'Direct', value: 46 }, { label: 'Partners', value: 27 }, { label: 'Marketplace', value: 18 }, { label: 'Other', value: 9 }]} />
      </Card>
      <Card title="Coming up" subtitle="Pick a day to see what is on it">
        <Calendar id="dash-calendar" value="2026-06-12" firstDay={1} events={[
          { date: '2026-06-03', title: 'Quarterly review', time: '10:00' },
          { date: '2026-06-12', title: 'Pricing meeting', time: '09:30' },
          { date: '2026-06-12', title: 'Invoice run', status: 'warning' },
          { date: '2026-06-17', title: 'Release 2.4', time: '16:00', status: 'success' },
          { date: '2026-06-24', title: 'Contract renewal: Acme', status: 'error' }
        ]} />
      </Card>
      <Card title="This week" subtitle="Drag the grip, or use Alt+↑ and Alt+↓, to set the order">
        <List id="dash-priorities" label="Priorities" reorderable multiSelect field="title" descriptionField="due" data={[
          { id: 'a', title: 'Send the Q2 invoices', due: 'Mon' },
          { id: 'b', title: 'Review the pricing proposal', due: 'Tue' },
          { id: 'c', title: 'Fix the failing ledger webhook', due: 'Wed' },
          { id: 'd', title: 'Renew the Acme contract', due: 'Fri' }
        ]} />
      </Card>
      <Card title="Recent activity" subtitle="Across the team">
        <Timeline label="Recent activity">
          <TimelineItem title="Invoice #3052 paid" time="2026-06-11T16:40" status="success">Acme Corp paid $2,400 by card.</TimelineItem>
          <TimelineItem title="Payment retried" time="2026-06-11T09:12" status="warning">Globex's card was declined once.</TimelineItem>
          <TimelineItem title="Refund issued" time="2026-06-10T14:05" status="info">$129 back to Initech.</TimelineItem>
          <TimelineItem title="Webhook failing" time="2026-06-09T22:31" status="error">billing → ledger returned 502 four times.</TimelineItem>
          <TimelineItem title="Workspace created" time="2026-06-08T08:00" />
        </Timeline>
      </Card>
    </Grid>
  ) as HTMLElement;
}
