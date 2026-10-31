#!/usr/bin/env node
// Boot-check Kitten Cannon under mobile WebKit (closest local stand-in for
// Brave iOS). Fails if #boot-error appears, #need-js stays, or __kitten never
// becomes ready.
//
// Usage:
//   node scripts/mobile-boot-check.mjs [url]
//   npm run test:mobile
//   npm run test:mobile -- https://pdobb.github.io/kitten-cannon/game.html

import { webkit, devices } from 'playwright-core';

const url = process.argv[2] || 'https://pdobb.github.io/kitten-cannon/game.html';
const phone = devices['iPhone 14'];

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...phone,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Brave/1.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

console.log('open', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => !!(window.__kitten && window.__kitten.ready));
  if (ready) break;
  await page.waitForTimeout(250);
}

const report = await page.evaluate(() => {
  const boot = document.getElementById('boot-error');
  const need = document.getElementById('need-js');
  const build = document.getElementById('build');
  const html = document.documentElement.outerHTML;
  return {
    href: location.href,
    ready: !!(window.__kitten && window.__kitten.ready),
    phase: window.__kitten ? window.__kitten.phase : null,
    boot: boot ? boot.textContent : null,
    need: need ? need.textContent : null,
    build: build && !build.hidden ? build.textContent : null,
    hasCodeLoader: html.includes('Function(CODE)'),
    shell: /kc-shell:v\d+/.test(html),
  };
});

console.log(JSON.stringify({ url, report, pageErrors: errors.slice(0, 8) }, null, 2));

await browser.close();

const badBoot = !!(report.boot && /const|legacy|strict|Script error/i.test(report.boot));
const stuckNeed = !!(report.need && !report.ready);
if (!report.ready || stuckNeed || badBoot || !report.hasCodeLoader) {
  console.error('FAIL mobile boot check');
  process.exit(1);
}
console.log('PASS mobile boot check');
