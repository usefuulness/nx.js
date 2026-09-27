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
