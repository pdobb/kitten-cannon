import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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

// Turn the inlined module bundle into a classic script. iOS Messages / Brave
// open the Pages link in a WebView that is picky about type=module + import.meta.
// vite-plugin-singlefile inlines with generateBundle order:"post", so this hook
// must also be order:"post" and registered after singlefile, or the rewrite
// runs on empty HTML and the module tag ships again.
function toClassicInline(html) {
  return html.replace(
    /<script type="module"(?: crossorigin)?>([\s\S]*?)<\/script>/,
    (_, code) => {
      const classic = code
        // Pixi resolves assets from import.meta.url / import.meta.resolve.
        .replace(/import\.meta\.url/g, 'location.href')
        .replace(/import\.meta\.resolve/g, '(null)')
        .replace(/<\/script/gi, '<\\/script');
      return `<script>document.addEventListener('DOMContentLoaded',function(){${classic}});</script>`;
    },
  );
}

function classicInlineScript() {
  return {
    name: 'classic-inline-script',
    enforce: 'post',
    generateBundle: {
      // After vite-plugin-singlefile's post generateBundle (registration order).
      order: 'post',
      handler(_options, bundle) {
        for (const item of Object.values(bundle)) {
          if (item.type !== 'asset' || typeof item.source !== 'string') continue;
          if (!item.fileName.endsWith('.html')) continue;
          item.source = toClassicInline(item.source);
        }
      },
    },
    // Belt: rewrite the file on disk if generateBundle somehow missed it.
    writeBundle(options) {
      const outDir = options.dir || (options.file ? dirname(options.file) : null);
      if (!outDir) return;
      const htmlPath = resolve(outDir, 'index.html');
      try {
        const before = readFileSync(htmlPath, 'utf8');
        if (!before.includes('type="module"')) return;
        writeFileSync(htmlPath, toClassicInline(before));
      } catch {
        // Build output not ready; generateBundle path already handled it.
      }
    },
    // Fail the build if a classic rewrite missed module/import.meta — those
    // break iOS Messages → Brave and other picky WebViews.
    closeBundle() {
      const htmlPath = resolve(root, 'dist/index.html');
      let html;
      try {
        html = readFileSync(htmlPath, 'utf8');
      } catch {
        return;
      }
      if (html.includes('type="module"') || html.includes('import.meta')) {
        throw new Error(
          'classic-inline-script: dist/index.html still has type="module" or import.meta',
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
    // Pixi 8 needs WebGL2 (Safari/iOS 15+). Explicit targets keep the classic
    // inline bundle inside that floor and document the support promise.
    target: ['es2020', 'chrome90', 'edge90', 'firefox90', 'safari15', 'ios15'],
    // The four latin faces are small. Inlining them keeps the published page
    // one file, which is what the service worker caches for offline play.
    assetsInlineLimit: 100000,
    rollupOptions: {
      input: resolve(root, 'index.html'),
    },
  },
  server: { port: 5173, strictPort: false },
});
