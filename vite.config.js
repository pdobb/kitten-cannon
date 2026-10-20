import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const root = dirname(fileURLToPath(import.meta.url));

// 0.<n> tracks publish history. Build runs before the signed commit, so n is
// commit count + 1 and matches HEAD after that publish lands.
function buildVersion() {
  try {
    const raw = execSync('git rev-list --count HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^\d+$/.test(raw)) return `0.${Number(raw) + 1}`;
  } catch {
    // Outside a git checkout (rare). Keep a stable fallback.
  }
  return '0.0';
}

const KC_VERSION = buildVersion();

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
  define: {
    __KC_VERSION__: JSON.stringify(KC_VERSION),
  },
  plugins: [viteSingleFile(), classicInlineScript()],
  build: {
    // The four latin faces are small. Inlining them keeps the published page
    // one file, which is what the service worker caches for offline play.
    assetsInlineLimit: 100000,
    rollupOptions: {
      input: resolve(root, 'index.html'),
    },
  },
  server: { port: 5173, strictPort: false },
});
