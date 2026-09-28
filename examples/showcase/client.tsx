/**
 * Browser side of the showcase: upgrade the server-rendered components, attach
 * the page's handlers with hydrate(), and follow the host page's theme.
 */
import { NX, ThemeManager, hydrate } from 'nx.js';
import { Showcase, applyBrand, commandItems } from './page';

hydrate(() => <Showcase />, document.getElementById('app')!);
NX.command.bind('mod+k', commandItems);

// Follow the viewer's theme when the host page sets <html data-theme> (and when it changes later)
const root = document.documentElement;
const follow = () => {
  const host = root.getAttribute('data-theme');
  if (host && host !== NX.theme.get() && NX.theme.list().includes(host)) {
    ThemeManager.setTheme(host, { persist: false });
  }
};
follow();
new MutationObserver(follow).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

applyBrand();
