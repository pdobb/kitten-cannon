import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = dirname(fileURLToPath(import.meta.url));

// iOS will not run a type="module" script opened from a file. The bundle is
// one inlined script with no imports, so a plain script tag runs it.
function classicInlineScript() {
  return {
    name: 'classic-inline-script',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'asset' || typeof item.source !== 'string') continue;
        if (!item.fileName.endsWith('.html')) continue;
        // defer does nothing on an inline script, so wait for the document.
        // The bundle sits in <head>, ahead of the Start button.
        // Pixi keeps import.meta.url on its renderer loads. A classic script
        // cannot parse that, so the whole page never runs. location.href is
        // the page itself, which is the base those loads would have used.
        item.source = item.source.replace(
          /<script type="module"(?: crossorigin)?>([\s\S]*?)<\/script>/,
          (_, code) => {
            const classic = code
              .replace(/import\.meta\.url/g, 'location.href')
              .replace(/<\/script/gi, '<\\/script');
            return `<script>document.addEventListener('DOMContentLoaded',function(){${classic}});</script>`;
          },
        );
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), classicInlineScript()],
  build: {
    rollupOptions: {
      input: resolve(root, 'index.html'),
    },
  },
  server: { port: 5173, strictPort: false },
});
