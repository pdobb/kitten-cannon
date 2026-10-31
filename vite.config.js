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

// ES5 loader: probe for modern syntax, then Function(CODE) so old WebViews
// never parse the Pixi bundle as source (that was the cream "const"/"strict
// mode" SyntaxError). The bundle lives only inside a JSON string until then.
const KC_UNSUPPORTED =
  'This browser cannot run Kitten Cannon. Open in Safari on iOS 15 or newer '
  + '(or current Chrome, Firefox, Edge, or Brave). '
  + 'From Messages, use Open in Safari — or open '
  + 'https://pdobb.github.io/kitten-cannon/game.html';

function toClassicInline(html) {
  return html.replace(
    /<script type="module"(?: crossorigin)?>([\s\S]*?)<\/script>/,
    (_, code) => {
      const classic = code
        // Pixi resolves assets from import.meta.url / import.meta.resolve.
        .replace(/import\.meta\.url/g, 'location.href')
        .replace(/import\.meta\.resolve/g, '(null)');
      const payload = JSON.stringify(classic);
      return `<script>(function(){
var CODE=${payload};
function kcUnsupported(){
  var need=document.getElementById('need-js');
  if(need){
    need.textContent=${JSON.stringify(KC_UNSUPPORTED)};
    need.hidden=false;
  }
  var pre=document.getElementById('boot-error');
  if(pre&&pre.parentNode)pre.parentNode.removeChild(pre);
  var start=document.getElementById('start');
  if(start)start.disabled=true;
}
function kcModern(){
  try{
    Function('const a=1;let b=2;class C{};return (\`\${a}\`,a??b,typeof C);')();
    return true;
  }catch(e){
    return false;
  }
}
function kcBoot(){
  if(!kcModern()){kcUnsupported();return;}
  try{
    Function(CODE)();
  }catch(e){
    kcUnsupported();
    var pre=document.getElementById('boot-error');
    if(!pre){
      pre=document.createElement('pre');
      pre.id='boot-error';
      document.body.appendChild(pre);
    }
    pre.textContent=(e&&e.message)?String(e.message):String(e);
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',kcBoot);
}else{
  kcBoot();
}
})();</script>`;
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
      if (html.includes('type="module"')) {
        throw new Error(
          'classic-inline-script: dist/index.html still has type="module"',
        );
      }
      // import.meta must not appear as live source. It may exist inside the
      // JSON-string payload only if a replace was missed — reject any form.
      if (html.includes('import.meta')) {
        throw new Error(
          'classic-inline-script: dist/index.html still has import.meta',
        );
      }
      if (!html.includes('var CODE=') || !html.includes('Function(CODE)')) {
        throw new Error(
          'classic-inline-script: dist/index.html missing ES5 Function(CODE) loader',
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
