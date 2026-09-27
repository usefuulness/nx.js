/**
 * @file @/core/require-dom.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Components extend HTMLElement when their module loads. Without a DOM (Node)
 * explain how to get one instead of failing with "HTMLElement is not defined".
 */
if (typeof HTMLElement === 'undefined') {
  throw new Error(
    "nx.js needs a DOM. On the server, import 'nx.js/ssr' before anything that imports 'nx.js' " +
    "(or run node with --import nx.js/ssr/register)."
  );
}

export {};
