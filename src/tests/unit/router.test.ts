import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router, routeDataScript, type Route } from '@/index';

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
};
const started: Router[] = [];
const make = (routes: any[]) => {
  const router = new Router({ mode: 'history', routes });
  router.start();
  started.push(router);
  return router;
};
// Routers listen on window/document; stop them so tests don't hear each other
afterEach(() => started.splice(0).forEach(router => router.stop()));

describe('Router loaders', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('matches paths and decodes params, tolerating malformed escapes', () => {
    const router = new Router({ routes: [{ path: '/users/:id' }] });
    expect(router.match('/users/a%20b?tab=1').params).toEqual({ id: 'a b' });
    expect(router.match('/users/a%20b?tab=1').query).toEqual({ tab: '1' });
    expect(router.match('/users/100%').params.id).toBe('100%');
  });

  it('resolve() runs the loader without a browser and captures errors', async () => {
    const loader = vi.fn(async ({ params, query }) => ({ id: params.id, tab: query.tab }));
    const router = new Router({ routes: [{ path: '/users/:id', loader }, { path: '/boom', loader: () => { throw new Error('nope'); } }] });
    const route = await router.resolve('/users/7?tab=x');
    expect(route.data).toEqual({ id: '7', tab: 'x' });
    expect((await router.resolve('/boom')).error).toEqual(new Error('nope'));
    expect((await router.resolve('/missing')).data).toBeUndefined();
  });

  it('keeps the old route until the loader finishes, and reports loading', async () => {
    const gate = deferred<string>();
    const router = make([{ path: '/' }, { path: '/slow', loader: () => gate.promise }]);
    await tick();
    const events: string[] = [];
    router.on('loading', () => events.push('loading'));
    router.on('loaded', () => events.push('loaded'));
    router.navigate('/slow');
    await tick();
    expect(router.isLoading()).toBe(true);
    expect(router.getCurrentRoute()!.path).toBe('/');
    gate.resolve('ready');
    await tick();
    expect(router.isLoading()).toBe(false);
    expect(router.getCurrentRoute()).toMatchObject({ path: '/slow', data: 'ready' });
    expect(events).toEqual(['loading', 'loaded']);
  });

  it('a newer navigation aborts the older loader and wins even if it finishes first', async () => {
    const slow = deferred<string>();
    let slowSignal!: AbortSignal;
    const router = make([
      { path: '/' },
      { path: '/a', loader: ({ signal }: any) => { slowSignal = signal; return slow.promise; } },
      { path: '/b', loader: async () => 'b' }
    ]);
    await tick();
    const committed: string[] = [];
    router.on('navigate', (r: Route) => committed.push(r.path));
    router.navigate('/a');
    await tick();
    router.navigate('/b');
    await tick();
    expect(slowSignal.aborted).toBe(true);
    slow.resolve('a'); // too late: must not commit
    await tick();
    expect(committed).toEqual(['/b']);
    expect(router.getCurrentRoute()!.data).toBe('b');
    expect(router.isLoading()).toBe(false);
  });

  it('a loader error still navigates, with route.error set', async () => {
    const router = make([{ path: '/' }, { path: '/bad', loader: () => Promise.reject(new Error('down')) }]);
    await tick();
    router.navigate('/bad');
    await tick();
    expect(router.getCurrentRoute()!.path).toBe('/bad');
    expect((router.getCurrentRoute()!.error as Error).message).toBe('down');
  });

  it('reuses results for staleTime, and invalidate/reload fetch again', async () => {
    const loader = vi.fn(async () => Math.random());
    const router = make([{ path: '/' }, { path: '/c', staleTime: 60_000, loader }]);
    await tick();
    router.navigate('/c');
    await tick();
    const first = router.getCurrentRoute()!.data;
    router.navigate('/');
    await tick();
    router.navigate('/c');
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(router.getCurrentRoute()!.data).toBe(first);
    await router.reload();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(router.getCurrentRoute()!.data).not.toBe(first);
  });

  it('does not cache without staleTime', async () => {
    const loader = vi.fn(async () => 1);
    const router = make([{ path: '/' }, { path: '/d', loader }]);
    await tick();
    router.navigate('/d');
    await tick();
    router.navigate('/');
    await tick();
    router.navigate('/d');
    await tick();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('prefetch() loads ahead so the next visit does not wait', async () => {
    const loader = vi.fn(async () => 'warm');
    const router = make([{ path: '/' }, { path: '/e', loader }]);
    await tick();
    await router.prefetch('/e');
    router.navigate('/e');
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(router.getCurrentRoute()!.data).toBe('warm');
  });

  it('uses server-rendered data for the first visit instead of fetching', async () => {
    history.replaceState(null, '', '/users/9');
    document.body.insertAdjacentHTML('beforeend', routeDataScript({ fullPath: '/users/9', data: { name: 'Ada' } }));
    const loader = vi.fn(async () => ({ name: 'fetched' }));
    const router = make([{ path: '/users/:id', loader }]);
    await tick();
    expect(loader).not.toHaveBeenCalled();
    expect(router.getCurrentRoute()!.data).toEqual({ name: 'Ada' });
  });

  it('routeDataScript keeps data from breaking out of the script element', () => {
    const html = routeDataScript({ fullPath: '/x', data: { s: '</script><img src=x onerror=alert(1)> ' } });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    document.body.innerHTML = html;
    const parsed = JSON.parse(document.getElementById('nx-route-data')!.textContent!);
    expect(parsed.data.s).toBe('</script><img src=x onerror=alert(1)> ');
    expect(document.body.querySelector('img')).toBeNull();
  });
});

describe('Router navigation', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  const click = (el: Element, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0, ...init });
    el.dispatchEvent(event);
    return event;
  };
  const link = (href: string, attrs: Record<string, string> = {}) => {
    const a = document.createElement('a');
    a.href = href;
    Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v));
    document.body.append(a);
    return a;
  };

  it('marks back/forward visits as history and link/navigate() visits as not', async () => {
    const router = make([{ path: '/' }, { path: '/a' }, { path: '/b' }]);
    await tick();
    router.navigate('/a');
    await tick();
    expect(router.getCurrentRoute()!.history).toBe(false);
    router.navigate('/b');
    await tick();
    history.back();
    await tick(30);
    expect(router.getCurrentRoute()).toMatchObject({ path: '/a', history: true });
  });

  it('turns same-origin link clicks into navigations, and leaves the rest to the browser', async () => {
    const router = make([{ path: '/' }, { path: '/docs/:page' }]);
    await tick();
    const a = link('/docs/intro?x=1#top');
    expect(click(a).defaultPrevented).toBe(true);
    await tick();
    expect(location.pathname + location.search + location.hash).toBe('/docs/intro?x=1#top');
    expect(router.getCurrentRoute()).toMatchObject({ path: '/docs/intro', query: { x: '1' }, hash: 'top' });

    const skipped = [
      click(link('/docs/a'), { ctrlKey: true }),
      click(link('/docs/a'), { button: 1 }),
      click(link('/docs/a', { target: '_blank' })),
      click(link('/docs/a', { download: '' })),
      click(link('/docs/a', { rel: 'external' })),
      click(link('/docs/a', { 'data-nx-external': '' })),
      click(link('https://example.org/docs/a')),
      click(link('#fragment'))
    ];
    expect(skipped.map(e => e.defaultPrevented)).toEqual(skipped.map(() => false));
    expect(location.pathname).toBe('/docs/intro');
  });

  it('prefetches a link route when the pointer reaches it', async () => {
    const loader = vi.fn(async () => 'warm');
    const router = make([{ path: '/' }, { path: '/p', loader }]);
    await tick();
    const a = link('/p');
    a.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    click(a);
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(router.getCurrentRoute()!.data).toBe('warm');
  });
});
