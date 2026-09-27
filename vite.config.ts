import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import path from 'path';

// `vite` / `vite build --mode demo` → the demo app (index.html + src/main.ts)
// `vite build`                      → the library (dist/nx.js, dist/nx.umd.cjs, dist/index.d.ts)
export default defineConfig(({ command, mode }) => {
  const lib = command === 'build' && mode !== 'demo';

  return {
    plugins: lib
      ? [dts({ include: ['src'], exclude: ['src/tests', 'src/main.ts'], rollupTypes: false, entryRoot: 'src' })]
      : [tailwindcss()],
    publicDir: lib ? false : 'public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    build: lib
      ? {
          lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'Nexaro',
            formats: ['es', 'umd'],
            fileName: format => (format === 'es' ? 'nx.js' : 'nx.umd.cjs')
          },
          sourcemap: true,
          emptyOutDir: true
        }
      : {
          outDir: 'dist-demo'
        }
  };
});
