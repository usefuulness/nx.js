/**
 * The browser side: import the library (the pre-rendered elements upgrade in
 * place), then hydrate the same page the server rendered — its onClick,
 * onSubmit and refs attach to the existing HTML.
 */
import { hydrate } from 'nx.js';
import { pages } from './pages';

const Page = pages[document.body.dataset.page as keyof typeof pages];
if (Page) hydrate(() => <Page />);
