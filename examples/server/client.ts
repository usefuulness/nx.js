/** Upgrades the server-rendered elements; behaviour is plain event listeners. */
import { NX } from 'nx.js';

document.getElementById('theme')?.addEventListener('click', () => {
  NX.theme.set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

document.getElementById('users')?.addEventListener('row-click', (e) => {
  NX.toast.info((e as CustomEvent).detail.row.name);
});
