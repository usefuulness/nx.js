/**
 * The browser side: importing the library upgrades the pre-rendered elements
 * in place. Attach behaviour with ordinary event listeners.
 */
import { NX } from 'nx.js';

document.getElementById('hello')?.addEventListener('click', () => NX.toast.success('Hello from the client'));

document.getElementById('theme')?.addEventListener('click', () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  NX.theme.set(dark ? 'light' : 'dark');
});

const dialog = document.getElementById('dialog') as (HTMLElement & { open(): void; close(): void }) | null;
document.getElementById('open-dialog')?.addEventListener('click', () => dialog?.open());
document.getElementById('close-dialog')?.addEventListener('click', () => dialog?.close());
document.getElementById('open-drawer')?.addEventListener('click', () => (document.getElementById('drawer') as any)?.open());
document.getElementById('profile')?.addEventListener('submit', (e: Event) => {
  NX.toast.success('Saved', { description: JSON.stringify((e as CustomEvent).detail.values) });
});
