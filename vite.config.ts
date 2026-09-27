import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import path from 'path';

// `vite` / `vite build --mode demo` → the demo app (index.html + src/main.tsx)
// `vite build`                      → the library: ESM + CJS entries (index, jsx-runtime, jsx-dev-runtime,
//                                      ssr + its server DOM and the nx-ssr CLI) + .d.ts
// `vite build --mode umd`           → dist/nx.umd.js for <script> tags (global `NX`)
export default defineConfig(({ command, mode }) => {
  const lib = command === 'build' && (mode === 'production' || mode === 'umd');
  const umd = mode === 'umd';

  return {
    publicDir: lib ? false : 'public',
    plugins: lib
      ? umd ? [] : [dts({ include: ['src'], exclude: ['src/tests', 'src/main.tsx'], entryRoot: 'src' })]
      : [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    build: lib
      ? {
          lib: umd
            ? { entry: path.resolve(__dirname, 'src/index.ts'), name: 'Nexaro', formats: ['umd'], fileName: () => 'nx.umd.js' }
            : {
                entry: {
                  index: path.resolve(__dirname, 'src/index.ts'),
                  'jsx-runtime': path.resolve(__dirname, 'src/jsx/jsx-runtime.ts'),
                  'jsx-dev-runtime': path.resolve(__dirname, 'src/jsx/jsx-dev-runtime.ts'),
                  ssr: path.resolve(__dirname, 'src/ssr/index.ts'),
                  // Its own chunk, so it evaluates (installing DOM globals) before the components
                  'ssr-dom': path.resolve(__dirname, 'src/ssr/dom.ts'),
                  'ssr-cli': path.resolve(__dirname, 'src/ssr/cli.ts')
                },
                formats: ['es', 'cjs'],
                fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`
              },
          rollupOptions: umd
            ? undefined
            : {
                external: [/^node:/, 'happy-dom'],
                output: { banner: (chunk: { name: string }) => (chunk.name === 'ssr-cli' ? '#!/usr/bin/env node' : '') }
              },
          sourcemap: true,
          emptyOutDir: !umd
        }
      : {
          outDir: 'dist-demo'
        }
  };
});
