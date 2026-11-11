#!/usr/bin/env node
// After vite build: ship the playable page as game.html, and make index.html a
// tiny ES5 redirector. Old Brave/SW clients that finally fetch index.html from
// the network then leave the stuck fat shell behind.
import { copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const docs = resolve(root, 'docs');

const assets = [
  'play.html',
  'manifest.webmanifest',
  'sw.js',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico',
  'favicon-32.png',
  'og.png',
];

const game = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (game.includes('type="module"') || !game.includes('Function(CODE)')) {
  throw new Error('publish-docs: dist/index.html is not a classic Function(CODE) build');
}
writeFileSync(resolve(docs, 'game.html'), game);
writeFileSync(resolve(dist, 'game.html'), game);

for (const name of assets) {
  copyFileSync(resolve(dist, name), resolve(docs, name));
}

const redirector = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#8ec8ee" />
  <meta name="description" content="Aim the barrel and see how far the kitty flies." />
  <meta property="og:title" content="Kitten Cannon" />
  <meta property="og:description" content="Aim the barrel, fire when the bar is full, and see how far the kitty flies." />
  <meta property="og:url" content="https://pdobb.github.io/kitten-cannon/game.html" />
  <meta property="og:image" content="https://pdobb.github.io/kitten-cannon/og.png?v=6" />
  <link rel="canonical" href="https://pdobb.github.io/kitten-cannon/game.html" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <title>Kitten Cannon</title>
  <!-- kc-shell:v13-redirect -->
  <script>
    (function () {
      var dest = './game.html?from=index';
      var done = false;
      function go() {
        if (done) return;
        done = true;
        location.replace(dest);
      }
      var chain = Promise.resolve();
      if (navigator.serviceWorker) {
        chain = chain.then(function () {
          return navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all((regs || []).map(function (r) { return r.unregister(); }));
          });
        });
      }
      if (window.caches && caches.keys) {
        chain = chain.then(function () {
          return caches.keys().then(function (keys) {
            return Promise.all((keys || []).map(function (k) { return caches.delete(k); }));
          });
        });
      }
      chain.then(go, go);
      setTimeout(go, 800);
    })();
  </script>
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#8ec8ee;color:#2b2118;padding:24px">
  <p>Loading Kitten Cannon…</p>
  <p><a href="./game.html?from=index">Tap here if nothing happens</a></p>
</body>
</html>
`;

writeFileSync(resolve(docs, 'index.html'), redirector);
console.log('publish-docs: docs/game.html + docs/index.html redirector ready');
