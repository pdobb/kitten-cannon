import { Application, Container, Graphics } from 'pixi.js';
import { createAudio } from './audio.js';
import {
  createCannon,
  createKitten as makeKittenMesh,
  createParticles,
  createProp,
  createStake,
  refreshLettering,
} from './actors.js';
import { buildCourse, resetCourse } from './course.js';
import { createKitten as makeState, step } from './physics.js';
import { createFlybys } from './flyby.js';
import { createScenery } from './scenery.js';
import { reachedMars } from './sky.js';
import { applyWorld, viewHalfWidth } from './view.js';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DEFAULT_ANGLE,
  CANNON_X,
  GROUND_Y,
  PIVOT_X,
  PIVOT_Y,
  PIXELS_PER_FOOT,
  POWER_MAX,
  POWER_MIN,
  STEP,
  aimVector,
  barrelMuzzle,
  feetFromAltitude,
  feetFromTravel,
  atTerminalSpeed,
  flightSeconds,
  formatFlight,
  formatFt,
  formatMph,
  formatSpeed,
  launchPoint,
  mphFromSpeed,
  reachedFullPower,
  reachedTerminal,
  rightwardSpeed,
  powerFromClock,
  powerPercent,
  SPEED_MAX,
} from './tune.js';

document.getElementById('need-js')?.remove();

const buildEl = document.getElementById('build');
if (buildEl) {
  buildEl.textContent = `v${__KC_VERSION__}`;
  buildEl.hidden = false;
}

// The published page is one file. Register only that build, so the dev server
// does not keep a worker around. updateViaCache skips a stale sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}

// iPhone grays the screen out on its idle timer. A home-screen app can hold
// the screen on since iOS 18.4. The browser drops the lock when the app is
// hidden, so coming back asks again. A low battery can refuse.
function keepScreenAwake() {
  if (!navigator.wakeLock) return;
  let sentinel = null;
  let pending = null;

  async function request() {
    if (sentinel || pending || document.visibilityState !== 'visible') return;
    const job = navigator.wakeLock.request('screen');
    pending = job;
    try {
      const lock = await job;
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
      });
    } catch {
      // Hidden page, low battery, or a home-screen app older than iOS 18.4.
    } finally {
      if (pending === job) pending = null;
    }
  }

  window.addEventListener('pointerdown', request);
  window.addEventListener('keydown', request);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
  request();
}

keepScreenAwake();

const FAR_KEY = 'kitten-cannon-best-ft';
const HIGH_KEY = 'kitten-cannon-highest-ft';
const LONG_KEY = 'kitten-cannon-longest-frames';
const SHORT_KEY = 'kitten-cannon-shortest-frames';
// Fastest used to be a personal-best row. The terminal badge covers speed now.
const MARS_KEY = 'kitten-cannon-mars-visits';
const TERM_KEY = 'kitten-cannon-terminal-visits';
const POWER_KEY = 'kitten-cannon-fullpower-visits';
const END_KEY = 'kitten-cannon-endings';
const RESET_KEY = 'kitten-cannon-resets';
// Session flag: an aim/flight is open and has not landed yet. A refresh mid-ride
// becomes a reset on the next boot; finish() clears it without counting one.
const ATTEMPT_KEY = 'kitten-cannon-open-attempt';
const ENDINGS = [
  ['landed', 'Soft landing'],
  ['spikes', 'Tar pit'],
  ['venus', 'Flytrap'],
];
const NOTES = {
  landed: 'Soft landing',
  spikes: 'Stuck in the tar',
  venus: 'The flytrap was hungry',
};
const SHOUT = {
  tnt: 'BOOM',
  balloon: 'POP',
  trampoline: 'BOING',
  spikes: 'GLUG',
  venus: 'GULP',
};
const NEAR_PROP = 8000;
const FAR_PROP = 14000;
// The view is about 600px tall. A balloon picture is only needed near the camera.
const NEAR_BALLOON_Y = 1100;
const FAR_BALLOON_Y = 1600;

const app = document.querySelector('#app');
const canvas = document.querySelector('#view');
const distanceEl = document.querySelector('#distance');
const altitudeEl = document.querySelector('#altitude');
const speedEl = document.querySelector('#speed');
const timeEl = document.querySelector('#time');
const recordsEl = document.querySelector('#records');
const titleBestEl = document.querySelector('#title-best');
const angleEl = document.querySelector('#angle');
const powerEl = document.querySelector('#power');
const powerLabelEl = document.querySelector('#power-label');
const bannerEl = document.querySelector('#banner');
const powerCheerEl = document.querySelector('#power-cheer');
const muteEl = document.querySelector('#mute');
const pauseBtn = document.querySelector('#pause-btn');
const pauseEl = document.querySelector('#pause');
const pauseFeetEl = document.querySelector('#pause-feet');
const pauseNoteEl = document.querySelector('#pause-note');
const pauseSheetEl = document.querySelector('#pause-sheet');
const resumeEl = document.querySelector('#resume');
const cardEl = document.querySelector('#card');
const cardKickerEl = document.querySelector('#card-kicker');
const cardFeetEl = document.querySelector('#card-feet');
const cardNoteEl = document.querySelector('#card-note');
const cardBestEl = document.querySelector('#card-best');
const padFireEl = document.querySelector('#pad-fire');
const wipeEl = document.querySelector('#wipe');
const wipeCancelEl = document.querySelector('#wipe-cancel');
const wipeConfirmEl = document.querySelector('#wipe-confirm');

const audio = createAudio();
// A page load rolls a field. Space keeps it. R rolls another. The canonical
// seed stays inside buildCourse() for the learned course the tests fly.
function freshSeed() {
  let seed = 0x20070321;
  while (seed === 0x20070321) seed = (Math.random() * 0x100000000) >>> 0;
  return seed;
}

let course = buildCourse(freshSeed());

const pixi = new Application();
const world = new Container();
const propLayer = new Container();
const actorLayer = new Container();
let scenery;
let flybys;
let kitten;
let cannon;
let stake;
let particles;
let shadow;
const poles = [];
let view = { scale: 1, halfW: 1, halfH: 1, screenW: 1, screenH: 1, camX: 0, camY: 0 };

// How far past the kitten the field is filled. Wide enough for the view and
// for several fast frames, and the same on every screen so the lane does
// not depend on the window.
const FIELD_AHEAD = 16000;

function fieldProps(k) {
  course.grow(k.x + FIELD_AHEAD);
  return course.near(k.x, k.x + k.vx);
}

function releaseProp(prop) {
  if (!prop.mesh) return;
  prop.mesh.destroy({ children: true });
  prop.mesh = null;
  prop.parts = null;
}

function ensureProp(prop) {
  if (prop.mesh) return;
  const built = createProp(prop.type, prop.x);
  prop.mesh = built.mesh;
  prop.parts = built.parts;
  prop.squash = prop.squash || 0;
  prop.chomp = prop.chomp || 0;
  prop.mesh.position.set(prop.x, prop.type === 'balloon' ? prop.y : 0);
  propLayer.addChild(prop.mesh);
}

const params = new URLSearchParams(location.search);

const game = {
  phase: 'title',
  angle: DEFAULT_ANGLE,
  power: POWER_MIN,
  kitten: null,
  feet: 0,
  furthest: loadNumber(FAR_KEY),
  furthestX: 0,
  highest: loadNumber(HIGH_KEY),
  longest: loadNumber(LONG_KEY),
  shortest: loadNumber(SHORT_KEY),
  marsVisits: loadNumber(MARS_KEY),
  terminalVisits: loadNumber(TERM_KEY),
  fullPowerVisits: loadNumber(POWER_KEY),
  peakY: 0,
  peakSpeed: 0,
  was: { furthest: 0, highest: 0, longest: 0, shortest: 0 },
  // One award per badge kind per ride. Reset in beginShot.
  badgeArmed: { mars: false, terminal: false, power: false },
  hold: 0,
  squash: 0,
  sink: 0,
  recoil: 0,
  checked: false,
  paused: false,
  endings: loadEndings(),
  resets: loadNumber(RESET_KEY),
  attemptOpen: false,
};
const cam = { x: 500, y: 120, z: 980, shake: 0 };
const hold = { ArrowUp: 0, ArrowDown: 0 };
// Physical keys currently held per aim direction (arrows and W/S share a slot).
const aimHeld = { ArrowUp: new Set(), ArrowDown: new Set() };

function aimDir(code) {
  if (code === 'ArrowUp' || code === 'KeyW') return 'ArrowUp';
  if (code === 'ArrowDown' || code === 'KeyS') return 'ArrowDown';
  return null;
}

function loadNumber(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function emptyEndings() {
  return { landed: 0, spikes: 0, venus: 0 };
}

function loadEndings() {
  const counts = emptyEndings();
  try {
    const raw = JSON.parse(localStorage.getItem(END_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return counts;
    for (const key of Object.keys(counts)) {
      counts[key] = Math.max(0, Math.round(Number(raw[key]) || 0));
    }
  } catch {
    // Private mode, or a bad value. Start from zero.
  }
  return counts;
}

function saveEndings() {
  try {
    localStorage.setItem(END_KEY, JSON.stringify(game.endings));
  } catch {
    // The count still shows for this visit.
  }
}

function tallyEnding(cause) {
  if (!Object.prototype.hasOwnProperty.call(game.endings, cause)) return;
  game.endings[cause] += 1;
  saveEndings();
}

function noteReset() {
  game.resets += 1;
  try {
    localStorage.setItem(RESET_KEY, String(game.resets));
  } catch {
    // Private mode can refuse storage. The count still shows for this visit.
  }
}

function markAttempt() {
  game.attemptOpen = true;
  try {
    sessionStorage.setItem(ATTEMPT_KEY, '1');
  } catch {
    // Private mode can refuse session storage.
  }
}

function clearAttempt() {
  game.attemptOpen = false;
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // Private mode can refuse session storage.
  }
}

function hasOpenAttempt() {
  if (game.attemptOpen) return true;
  try {
    return sessionStorage.getItem(ATTEMPT_KEY) === '1';
  } catch {
    return false;
  }
}

// Mid-game abandon only (aim / flight). End-card Again and a finished landing
// do not count — those already have a landing type, or are starting fresh.
function abandonOpenAttempt(phase = game.phase) {
  if (phase !== 'aim' && phase !== 'flight') return;
  if (!hasOpenAttempt()) return;
  noteReset();
  clearAttempt();
}

function saveVisitCount(key, n) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // Private mode can refuse storage. The count still shows for this visit.
  }
}

// Ride badges award as soon as each goal is hit (launch / mid-flight).
// One tally per kind per ride.
function tallyMars() {
  if (game.badgeArmed.mars) return false;
  if (!reachedMars(feetFromAltitude(game.peakY))) return false;
  game.badgeArmed.mars = true;
  game.marsVisits += 1;
  saveVisitCount(MARS_KEY, game.marsVisits);
  return true;
}

function tallyTerminal() {
  if (game.badgeArmed.terminal) return false;
  if (!reachedTerminal(game.peakSpeed)) return false;
  game.badgeArmed.terminal = true;
  game.terminalVisits += 1;
  saveVisitCount(TERM_KEY, game.terminalVisits);
  return true;
}

function tallyFullPower() {
  if (game.badgeArmed.power) return false;
  if (!reachedFullPower(game.power)) return false;
  game.badgeArmed.power = true;
  game.fullPowerVisits += 1;
  saveVisitCount(POWER_KEY, game.fullPowerVisits);
  return true;
}

// Check thresholds and refresh the HUD rail when something new lands.
function noteRideBadges() {
  const marsPop = tallyMars();
  const termPop = tallyTerminal();
  const powerPop = tallyFullPower();
  if (marsPop || termPop || powerPop) {
    paintHudRideBadges({ marsPop, termPop, powerPop });
  }
}

function marsDiscSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = [
    '<circle cx="12" cy="12" r="11" fill="#c24a28"/>',
    '<ellipse cx="9" cy="13" rx="5" ry="3.2" fill="#8c2e14"/>',
    '<ellipse cx="15.5" cy="8.5" rx="2.6" ry="1.8" fill="#9a3418"/>',
    '<ellipse cx="17.2" cy="12" rx="2.4" ry="6.2" fill="#4a160c" fill-opacity="0.55"/>',
    '<ellipse cx="12" cy="20.2" rx="3.4" ry="1.5" fill="#fff7f1"/>',
    '<ellipse cx="11.7" cy="20.5" rx="1.9" ry="0.85" fill="#ffffff"/>',
  ].join('');
  return svg;
}

function terminalDiscSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  // Gold speed disc — matches the live → mph MAX chip.
  svg.innerHTML = [
    '<circle cx="12" cy="12" r="11" fill="#ffb703"/>',
    '<circle cx="12" cy="12" r="8.2" fill="none" stroke="#2b2118" stroke-width="1.4"/>',
    '<path d="M6.5 12h7.2" fill="none" stroke="#2b2118" stroke-width="2.2" stroke-linecap="round"/>',
    '<path d="M11.2 7.8L17.4 12l-6.2 4.2z" fill="#2b2118"/>',
  ].join('');
  return svg;
}

function fullPowerDiscSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  // Red star disc — matches the Full power! cheer.
  svg.innerHTML = [
    '<circle cx="12" cy="12" r="11" fill="#d23b2e"/>',
    '<path d="M12 4.2l2.1 5.1 5.5.4-4.2 3.6 1.4 5.3L12 15.8 7.2 18.6l1.4-5.3-4.2-3.6 5.5-.4z" fill="#fff6e4"/>',
  ].join('');
  return svg;
}

const BADGE_LABEL = {
  terminal: 'Terminal Velocity',
  power: 'Full power',
  mars: 'Mars',
};

const BADGE_TIP = {
  terminal: 'Hit the 256 mph speed cap on a ride.',
  power: 'Launched at 100% power.',
  mars: 'Made it to space and saw Mars.',
};

const BADGE_KINDS = ['terminal', 'power', 'mars'];

let badgeTipEl = null;
let badgeTipFor = null;

function rideBadgeIcon(kind) {
  if (kind === 'mars') return marsDiscSvg();
  if (kind === 'power') return fullPowerDiscSvg();
  return terminalDiscSvg();
}

function badgeKindOf(badge) {
  return BADGE_KINDS.find((kind) => badge.classList.contains(kind));
}

function ensureBadgeTip() {
  if (badgeTipEl) return badgeTipEl;
  badgeTipEl = document.createElement('div');
  badgeTipEl.className = 'ride-badge-tip';
  badgeTipEl.hidden = true;
  badgeTipEl.setAttribute('role', 'tooltip');
  badgeTipEl.id = 'ride-badge-tip';
  app.appendChild(badgeTipEl);
  return badgeTipEl;
}

function badgeTipOpen() {
  return !!(badgeTipFor || document.querySelector('.ride-badge.is-open') || (badgeTipEl && !badgeTipEl.hidden));
}

function closeBadgeTips() {
  const wasOpen = badgeTipOpen();
  document.querySelectorAll('.ride-badge.is-open').forEach((badge) => {
    badge.classList.remove('is-open');
    badge.setAttribute('aria-expanded', 'false');
    badge.removeAttribute('aria-describedby');
  });
  if (badgeTipEl) {
    badgeTipEl.hidden = true;
    badgeTipEl.replaceChildren();
  }
  badgeTipFor = null;
  return wasOpen;
}

function placeBadgeTip(badge) {
  const tip = ensureBadgeTip();
  const kind = badgeKindOf(badge);
  if (!kind) return;
  tip.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = BADGE_LABEL[kind];
  const body = document.createElement('span');
  body.textContent = BADGE_TIP[kind];
  tip.append(title, body);
  tip.hidden = false;
  tip.style.left = '0px';
  tip.style.top = '0px';
  // Lay out at 0,0 first so width/height are real, then pick a side that fits.
  // Badges live top-left, so prefer opening to the right.
  const br = badge.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  const pad = 8;
  const gap = 10;
  const preferRight = br.left < window.innerWidth * 0.45;
  let left = preferRight ? br.right + gap : br.left - tr.width - gap;
  let top = br.top + (br.height - tr.height) / 2;
  let placed = preferRight ? 'right' : 'left';
  const overflowsX = left < pad || left + tr.width > window.innerWidth - pad;
  if (overflowsX) {
    left = preferRight ? br.left - tr.width - gap : br.right + gap;
    placed = preferRight ? 'left' : 'right';
  }
  if (left < pad || left + tr.width > window.innerWidth - pad) {
    left = Math.min(br.right, window.innerWidth - pad) - tr.width;
    left = Math.max(pad, left);
    top = br.bottom + gap;
    placed = 'below';
    if (top + tr.height > window.innerHeight - pad) {
      top = br.top - tr.height - gap;
      placed = 'above';
    }
  }
  top = Math.max(pad, Math.min(top, window.innerHeight - tr.height - pad));
  left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.dataset.place = placed;
}

function toggleBadgeTip(badge) {
  const open = badge.classList.contains('is-open');
  closeBadgeTips();
  if (open) return;
  badge.classList.add('is-open');
  badge.setAttribute('aria-expanded', 'true');
  badge.setAttribute('aria-describedby', 'ride-badge-tip');
  badgeTipFor = badge;
  placeBadgeTip(badge);
}

function rideBadgeEl(kind, count, { pop = false } = {}) {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = pop ? `ride-badge ${kind} pop` : `ride-badge ${kind}`;
  badge.setAttribute('aria-expanded', 'false');
  badge.setAttribute('aria-label', `${BADGE_LABEL[kind]} ×${count}. Show what this badge means.`);
  badge.append(rideBadgeIcon(kind));
  const mark = document.createElement('b');
  mark.textContent = `×${count}`;
  badge.append(mark);
  if (pop) {
    const glyph = kind === 'power' ? '★' : kind === 'terminal' ? '✦' : '✧';
    for (const spot of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const spark = document.createElement('span');
      spark.className = `badge-spark ${spot}`;
      spark.setAttribute('aria-hidden', 'true');
      spark.textContent = glyph;
      badge.append(spark);
    }
  }
  badge.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleBadgeTip(badge);
  });
  return badge;
}

const badgesEl = document.querySelector('#badges');

function paintHudRideBadges({ marsPop = false, termPop = false, powerPop = false } = {}) {
  if (!badgesEl) return;
  closeBadgeTips();
  badgesEl.replaceChildren();
  const hasMars = game.marsVisits > 0;
  const hasTerm = game.terminalVisits > 0;
  const hasPower = game.fullPowerVisits > 0;
  if (!hasMars && !hasTerm && !hasPower) return;
  const rail = document.createElement('div');
  rail.className = 'ride-badges';
  if (hasTerm) rail.append(rideBadgeEl('terminal', game.terminalVisits, { pop: termPop }));
  if (hasPower) rail.append(rideBadgeEl('power', game.fullPowerVisits, { pop: powerPop }));
  if (hasMars) rail.append(rideBadgeEl('mars', game.marsVisits, { pop: marsPop }));
  badgesEl.append(rail);
}

function endingTotal() {
  return game.endings.landed + game.endings.spikes + game.endings.venus;
}

function appendEndingRows(el, cause, kicker = true, includeResets = false) {
  const landings = endingTotal();
  const total = includeResets ? landings + game.resets : landings;
  if (kicker) {
    const label = document.createElement('p');
    label.className = 'endings-kicker';
    label.textContent = 'Landings';
    el.append(label);
  }
  for (const [key, label] of ENDINGS) {
    const n = game.endings[key];
    const row = document.createElement('p');
    if (cause === key) row.className = 'fresh';
    const name = document.createElement('span');
    name.textContent = label;
    const num = document.createElement('b');
    num.className = 'count';
    num.textContent = n.toLocaleString('en-US');
    const pct = document.createElement('b');
    pct.className = 'pct';
    // Percents stay against landings only so resets do not dilute them.
    if (landings > 0) pct.textContent = `· ${Math.round((n / landings) * 100)}%`;
    row.classList.add('landing');
    row.append(name, num, pct);
    el.append(row);
  }
  if (includeResets) {
    const row = document.createElement('p');
    row.className = 'landing';
    const name = document.createElement('span');
    name.textContent = 'Resets';
    const num = document.createElement('b');
    num.className = 'count';
    num.textContent = game.resets.toLocaleString('en-US');
    const pct = document.createElement('b');
    pct.className = 'pct';
    row.append(name, num, pct);
    el.append(row);
  }
  const sum = document.createElement('p');
  sum.className = 'total';
  const sumName = document.createElement('span');
  sumName.textContent = 'Total';
  const sumNum = document.createElement('b');
  sumNum.className = 'count';
  sumNum.textContent = total.toLocaleString('en-US');
  const sumPct = document.createElement('b');
  sumPct.className = 'pct';
  sum.append(sumName, sumNum, sumPct);
  el.append(sum);
}

try {
  // Drop retired keys so old installs do not keep stale data.
  localStorage.removeItem('kitten-cannon-fastest');
  localStorage.removeItem('kitten-cannon-fastest-x');
  localStorage.removeItem('kitten-cannon-balloons');
} catch {
  // Private mode can refuse storage.
}

function saveRecords() {
  try {
    localStorage.setItem(FAR_KEY, String(game.furthest));
    localStorage.setItem(HIGH_KEY, String(game.highest));
    localStorage.setItem(LONG_KEY, String(game.longest));
    localStorage.setItem(SHORT_KEY, String(game.shortest));
  } catch {
    // Private mode can refuse storage. The score still shows for this run.
  }
}

const BEST_KEYS = [FAR_KEY, HIGH_KEY, LONG_KEY, SHORT_KEY, MARS_KEY, TERM_KEY, POWER_KEY, END_KEY, RESET_KEY];

function clearBests() {
  game.furthest = 0;
  game.furthestX = 0;
  game.highest = 0;
  game.longest = 0;
  game.shortest = 0;
  game.marsVisits = 0;
  game.terminalVisits = 0;
  game.fullPowerVisits = 0;
  game.endings = emptyEndings();
  game.resets = 0;
  game.was = { furthest: 0, highest: 0, longest: 0, shortest: 0 };
  durationBestKind = 'long';
  lastBestMarks = null;
  try {
    for (const key of BEST_KEYS) localStorage.removeItem(key);
  } catch {
    // Private mode can refuse storage. Memory still clears for this visit.
  }
  for (let i = poles.length - 1; i >= 0; i--) {
    poles[i].mesh.destroy({ children: true });
    poles.pop();
  }
  paintRecords();
  paintHudRideBadges();
  if (game.phase === 'result' && game.kitten) {
    cardBestEl.replaceChildren();
    appendPersonalStats(cardBestEl, null, game.kitten.cause, { resets: true });
  }
  if (game.paused) fillPauseCard();
}

function wipeOpen() {
  return !wipeEl.classList.contains('hidden');
}

// True when wipe froze play itself. Closing wipe resumes only in that case.
let wipeHeldPause = false;

function setWipeOpen(on) {
  const open = !!on;
  if (open === wipeOpen()) return;
  wipeEl.classList.toggle('hidden', !open);
  app.classList.toggle('is-wiping', open);
  if (open) {
    touchAim = null;
    // Freeze an active aim or flight under the modal. Title/result stay put.
    if (!game.paused && (game.phase === 'flight' || game.phase === 'aim')) {
      wipeHeldPause = true;
      setPaused(true);
    }
    // Pause card stays hidden while wiping; wipe is the only modal.
    pauseEl.classList.add('hidden');
    wipeCancelEl.focus();
    return;
  }
  if (wipeHeldPause) {
    wipeHeldPause = false;
    setPaused(false);
  } else if (game.paused) {
    pauseEl.classList.remove('hidden');
    fillPauseCard();
    resumeEl.focus();
  }
}

function confirmClearBests() {
  setWipeOpen(true);
}

function acceptWipe() {
  if (!wipeOpen()) return;
  setWipeOpen(false);
  clearBests();
}

function cancelWipe() {
  if (!wipeOpen()) return;
  setWipeOpen(false);
}

function xForFeet(feet) {
  return launchPoint(DEFAULT_ANGLE).x + feet * PIXELS_PER_FOOT;
}

function rankPoles() {
  const ordered = poles.slice().sort((a, b) => (b.feet - a.feet) || (b.x - a.x));
  for (let i = 0; i < ordered.length; i++) {
    const rank = i + 1;
    if (ordered[i].rank === rank) continue;
    ordered[i].rank = rank;
    ordered[i].mesh.paintRank(rank);
  }
}

function repaintRanks() {
  for (const pole of poles) {
    if (pole.rank) pole.mesh.paintRank(pole.rank);
  }
}

function plantPole(x, feet) {
  if (!(feet > 0) || !Number.isFinite(x)) return;
  for (const pole of poles) {
    if (Math.abs(pole.x - x) < 48) {
      if (x > pole.x) {
        pole.x = x;
        pole.feet = feet;
        pole.mesh.position.x = x;
        rankPoles();
      }
      return;
    }
  }
  const mesh = createStake();
  mesh.visible = true;
  mesh.position.set(x, 0);
  actorLayer.addChild(mesh);
  poles.push({ x, feet, mesh, rank: 0 });
  rankPoles();
}

function setPhase(phase) {
  game.phase = phase;
  app.dataset.phase = phase;
  cardEl.classList.toggle('hidden', phase !== 'result');
  padFireEl.textContent = phase === 'result' ? 'Again' : 'Fire';
  paintRecords();
}

function resultCardOpen() {
  return game.phase === 'result' && !cardEl.classList.contains('hidden');
}

// Peek the landed field. Phase stays result so the next field tap / Space retries.
function dismissResultCard() {
  if (!resultCardOpen()) return false;
  cardEl.classList.add('hidden');
  return true;
}

// Title / score / pause share one duration row that toggles Longest ↔ Shortest.
// The live HUD chip stays on Longest only.
let durationBestKind = 'long';
let lastBestMarks = null;

function durationBestRow() {
  if (durationBestKind === 'short') {
    return ['Shortest', game.shortest > 0 ? formatFlight(flightSeconds(game.shortest)) : '—', 'short'];
  }
  return ['Longest', game.longest > 0 ? formatFlight(flightSeconds(game.longest)) : '—', 'long'];
}

function recordRows({ hud = false } = {}) {
  return [
    ['Furthest', game.furthest > 0 ? formatFt(game.furthest) : '—', 'far'],
    ['Highest', game.highest > 0 ? formatFt(game.highest) : '—', 'high'],
    hud
      ? ['Longest', game.longest > 0 ? formatFlight(flightSeconds(game.longest)) : '—', 'long']
      : durationBestRow(),
  ];
}

function toggleDurationBest() {
  durationBestKind = durationBestKind === 'long' ? 'short' : 'long';
  paintDurationBestLists();
}

function paintDurationBestLists() {
  paintRecords();
  if (game.phase === 'result') {
    cardBestEl.replaceChildren();
    appendPersonalStats(cardBestEl, lastBestMarks, game.kitten ? game.kitten.cause : null, { resets: true });
  }
  if (game.paused) fillPauseCard();
}

// Height bands. Each step up is a little louder. Distance stays the big number.
function heightTier(ft) {
  if (ft >= 2000) return 4;
  if (ft >= 800) return 3;
  if (ft >= 300) return 2;
  if (ft >= 100) return 1;
  return 0;
}

function fillLiveLine(el, k) {
  const ending = document.createElement('span');
  ending.className = 'cause';
  ending.textContent = 'So far';
  const stats = document.createElement('span');
  stats.className = 'stats';
  stats.textContent = `↑ ${formatFt(feetFromAltitude(k.y))} · ${formatSpeed(k.vx)} · ${Math.round(game.angle)}° · ${formatFlight(flightSeconds(k.frame))}`;
  el.replaceChildren(ending, stats);
}

function fillShotLine(el, cause) {
  const pct = powerPercent(game.power);
  const parts = [];
  const peakFt = feetFromAltitude(game.peakY);
  parts.push(`↑ ${formatFt(peakFt)}`);
  parts.push(formatSpeed(game.peakSpeed));
  parts.push(`${Math.round(game.angle)}°`);
  const ending = document.createElement('span');
  ending.className = 'cause';
  ending.textContent = NOTES[cause] || 'That is the end of the line';
  const stats = document.createElement('span');
  stats.className = 'stats';
  stats.append(document.createTextNode(`${parts.join(' · ')} · `));
  const mark = document.createElement('b');
  if (pct >= 100) mark.className = 'perfect';
  mark.textContent = `${pct}% power`;
  stats.append(mark);
  const flown = formatFlight(flightSeconds(game.kitten ? game.kitten.frame : 0));
  stats.append(document.createTextNode(` · ${flown}`));
  el.replaceChildren(ending, stats);
}

function appendBestsKicker(el, { clear = false } = {}) {
  const best = document.createElement('p');
  best.className = clear ? 'kicker has-clear' : 'kicker';
  const name = document.createElement('span');
  name.textContent = 'Personal bests';
  best.append(name);
  if (clear) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bests-clear';
    btn.textContent = 'Clear';
    btn.setAttribute('aria-label', 'Clear personal bests');
    best.append(btn);
    bindTap(btn, confirmClearBests);
  }
  el.append(best);
}

function appendPersonalStats(el, marks, cause, { resets = false } = {}) {
  appendBestsKicker(el);
  appendRecordRows(el, marks);
  appendEndingRows(el, cause, true, resets);
}

function appendRecordRows(el, marks, { hud = false } = {}) {
  for (const [label, value, key] of recordRows({ hud })) {
    const row = document.createElement('p');
    if (marks && marks[key]) row.className = 'fresh';
    const name = document.createElement('span');
    name.textContent = label;
    const num = document.createElement('b');
    num.textContent = marks && marks[key] ? `${value}  new` : value;
    row.append(name, num);
    if (!hud && (key === 'long' || key === 'short')) {
      const other = key === 'long' ? 'Shortest' : 'Longest';
      row.classList.add('duration-best');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `${label} ${value}. Show ${other}.`);
      bindTap(row, toggleDurationBest);
      row.addEventListener('keydown', (e) => {
        if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') return;
        e.preventDefault();
        e.stopPropagation();
        toggleDurationBest();
      });
    }
    el.append(row);
  }
}

function paintRecords() {
  recordsEl.replaceChildren();
  appendRecordRows(recordsEl, null, { hud: true });
  titleBestEl.replaceChildren();
  const hasRows = game.furthest > 0 || game.highest > 0 || game.longest > 0 || game.shortest > 0;
  if (hasRows) {
    appendBestsKicker(titleBestEl, { clear: true });
    appendRecordRows(titleBestEl, null);
  }
  paintHudRideBadges();
}

function clampAngle() {
  game.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, game.angle));
}

function nudge(dir) {
  if (game.phase !== 'aim') return;
  game.angle += dir;
  clampAngle();
}

function shout(text) {
  bannerEl.textContent = text;
  bannerEl.classList.remove('show');
  // Restart the CSS animation.
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}

// Hit shouts reuse #banner, and the first balloon is close enough to pop
// inside this same second. The percent gets its own line so that shout
// cannot wipe it.
function celebratePower(power) {
  const pct = powerPercent(power);
  const perfect = pct >= 100;
  powerCheerEl.className = perfect ? 'perfect' : '';
  powerCheerEl.replaceChildren();
  if (perfect) {
    for (const spot of ['a', 'b', 'c', 'd']) {
      const star = document.createElement('span');
      star.className = `spark ${spot}`;
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      powerCheerEl.append(star);
    }
    const kicker = document.createElement('span');
    kicker.className = 'kicker';
    kicker.textContent = 'Full power!';
    powerCheerEl.append(kicker);
  }
  const num = document.createElement('b');
  num.textContent = `${pct}%`;
  powerCheerEl.append(num);
  if (!perfect) {
    const caption = document.createElement('span');
    caption.className = 'caption';
    caption.textContent = 'Power';
    powerCheerEl.append(caption);
  }
  void powerCheerEl.offsetWidth;
  powerCheerEl.classList.add('show');
}

function burst(x, y, colors, count, speed, life, size) {
  if (!particles) return;
  for (let i = 0; i < colors.length; i++) {
    particles.spawn(x, y, colors[i], count, speed, life, size);
  }
}

function safeAudio(fn) {
  try {
    fn();
  } catch {
    // A phone can refuse the audio context. The shot still happens.
  }
}

function startAim() {
  if (!kitten || !flybys) return;
  flybys.clear();
  setPhase('aim');
  stake.visible = false;
  kitten.mesh.visible = true;
  game.kitten = null;
  game.sink = 0;
  game.squash = 0;
  markAttempt();
  safeAudio(() => audio.unlock());
}

function beginShot(forcedPower) {
  safeAudio(() => audio.unlock());
  const power = forcedPower == null ? powerFromClock(playSeconds()) : forcedPower;
  game.power = power;
  game.was = {
    furthest: game.furthest,
    highest: game.highest,
    longest: game.longest,
    shortest: game.shortest,
  };
  game.badgeArmed = { mars: false, terminal: false, power: false };
  game.kitten = makeState(game.angle, power);
  game.feet = 0;
  game.peakY = game.kitten.y;
  game.peakSpeed = rightwardSpeed(game.kitten.vx);
  commitRecords();
  game.hold = 0;
  game.squash = 0;
  game.sink = 0;
  game.recoil = 26;
  altitudeEl.dataset.tier = '0';
  altitudeEl.classList.remove('pop');
  speedEl.classList.remove('terminal');
  timeEl.textContent = formatFlight(0);
  stake.visible = false;
  kitten.mesh.visible = true;
  cam.shake = Math.min(1.4, cam.shake + 0.7);
  const muzzle = barrelMuzzle(game.angle);
  burst(muzzle.x, muzzle.y, [0xfff6e0, 0xc9c3ba, 0xffb703], 8, 70, 0.5, 18);
  audio.launch();
  audio.meow();
  setPhase('flight');
  celebratePower(power);
  // Full-power badge lands at launch; Mars/terminal wait for afterStep.
  noteRideBadges();
}

function afterStep() {
  const k = game.kitten;
  if (!k) return;
  if (k.y > game.peakY) game.peakY = k.y;
  const speed = rightwardSpeed(k.vx);
  if (speed > game.peakSpeed) game.peakSpeed = speed;
  noteRideBadges();
}

function commitRecords() {
  const k = game.kitten;
  if (!k) return;
  const far = feetFromTravel(k.startX, k.x);
  const high = feetFromAltitude(game.peakY);
  const long = k.frame;
  let dirty = false;
  if (far > game.furthest) {
    game.furthest = far;
    game.furthestX = k.x;
    dirty = true;
  }
  if (high > game.highest) {
    game.highest = high;
    dirty = true;
  }
  if (long > game.longest) {
    game.longest = long;
    dirty = true;
  }
  // Shortest only counts a finished ride. Live frames would stamp every launch
  // as a fraction of a second. 0 means no shortest yet.
  if (k.dead && long > 0 && (game.shortest === 0 || long < game.shortest)) {
    game.shortest = long;
    dirty = true;
  }
  if (dirty) {
    saveRecords();
    paintRecords();
  }
}

function finish() {
  const k = game.kitten;
  afterStep();
  commitRecords();
  game.feet = feetFromTravel(k.startX, k.x);
  const marks = {
    far: game.feet > game.was.furthest,
    high: feetFromAltitude(game.peakY) > game.was.highest,
    long: k.frame > game.was.longest,
    short: k.frame > 0 && (game.was.shortest === 0 || k.frame < game.was.shortest),
  };
  const fresh = [];
  if (marks.far) fresh.push('furthest');
  if (marks.high) fresh.push('highest');
  if (marks.long) fresh.push('longest');
  if (marks.short) fresh.push('shortest');
  cardKickerEl.textContent = fresh.length === 0 ? 'Score' : fresh.length === 1 ? `New ${fresh[0]}` : 'New records';
  cardFeetEl.textContent = formatFt(game.feet);
  fillShotLine(cardNoteEl, k.cause);
  tallyEnding(k.cause);
  // Ride completed — not a mid-game reset.
  clearAttempt();
  durationBestKind = 'long';
  lastBestMarks = marks;
  cardBestEl.replaceChildren();
  appendPersonalStats(cardBestEl, marks, k.cause, { resets: true });
  // Badges already awarded mid-flight / at launch on the HUD rail.
  paintHudRideBadges();
  if (game.furthest > game.was.furthest) plantPole(game.furthestX, game.furthest);
  // The landing stake hides on the next shot. This pole stays for the visit,
  // including a landing that did not set a new furthest.
  plantPole(k.x, game.feet);
  const marked = poles.some((pole) => Math.abs(pole.x - k.x) < 48);
  if (marked) {
    stake.visible = false;
  } else {
    stake.position.set(k.x, 0);
    stake.visible = true;
  }
  setPhase('result');
}

// A new page: a new roll of the field, record stakes only, nothing spent.
// Full screen stays, and the start card stays hidden if the visit already began.
function reloadField() {
  if (!kitten || !flybys) return;
  const from = game.phase;
  const onTitle = from === 'title';
  abandonOpenAttempt(from);
  if (game.paused) setPaused(false);
  for (let i = 0; i < course.length; i++) releaseProp(course[i]);
  course = buildCourse(freshSeed());
  for (let i = poles.length - 1; i >= 0; i--) {
    poles[i].mesh.destroy({ children: true });
    poles.pop();
  }
  if (game.furthest > 0) {
    game.furthestX = xForFeet(game.furthest);
    plantPole(game.furthestX, game.furthest);
  }
  if (particles) particles.clear();
  bannerEl.classList.remove('show');
  bannerEl.textContent = '';
  powerCheerEl.className = '';
  powerCheerEl.replaceChildren();
  distanceEl.textContent = formatFt(0);
  altitudeEl.textContent = `↑ ${formatFt(0)}`;
  altitudeEl.dataset.tier = '0';
  altitudeEl.classList.remove('pop');
  speedEl.textContent = formatSpeed(0);
  speedEl.classList.remove('terminal');
  timeEl.textContent = formatFlight(0);
  game.kitten = null;
  game.feet = 0;
  game.peakY = 0;
  game.peakSpeed = 0;
  game.hold = 0;
  game.squash = 0;
  game.sink = 0;
  game.recoil = 0;
  game.snap = true;
  cam.shake = 0;
  hold.ArrowUp = 0;
  hold.ArrowDown = 0;
  aimHeld.ArrowUp.clear();
  aimHeld.ArrowDown.clear();
  kitten.mesh.visible = true;
  stake.visible = false;
  const home = aimFocus();
  cam.x = home.x;
  cam.y = home.y;
  if (onTitle) {
    flybys.clear();
    setPhase('title');
    return;
  }
  startAim();
}

function retry() {
  if (!kitten) return;
  // Space/Again mid-flight abandons the open ride; from the score card it does not.
  abandonOpenAttempt();
  resetCourse(course);
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    prop.squash = 0;
    prop.chomp = 0;
    if (!prop.mesh || !prop.parts) continue;
    prop.mesh.visible = true;
    prop.mesh.scale.set(1, 1);
    if (prop.parts.bed) prop.parts.bed.scale.y = 1;
    if (prop.parts.upper) {
      const open = prop.parts.open;
      prop.parts.upper.rotation = -open;
      prop.parts.lower.rotation = open;
    }
    if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2;
  }
  game.snap = true;
  kitten.recolor();
  startAim();
}

// Leave the score card for the start screen and roll a fresh field (same as New field).
function goTitle() {
  if (wipeOpen()) return;
  closeBadgeTips();
  // Count a mid-game back-out before we flip to title (reloadField then no-ops).
  abandonOpenAttempt();
  // reloadField keeps the title card when phase is already title.
  game.phase = 'title';
  reloadField();
}

function onEvent(event) {
  const k = game.kitten;
  if (!event) return;
  if (event === 'bounce') {
    game.squash = 1;
    cam.shake = Math.min(1.2, cam.shake + 0.22);
    audio.bounce(Math.abs(k.vx));
    burst(k.x, GROUND_Y + 4, [0xe7d3a4, 0xc4a574], 4, 50, 0.35, 10);
    return;
  }
  if (event === 'settle') {
    game.hold = 0.45;
    audio.bounce(8);
    return;
  }
  const prop = course.find((p) => p.spent && p.type === event) || null;
  if (event === 'tnt' || event === 'balloon') {
    cam.shake = Math.min(1.6, cam.shake + 0.85);
    audio[event === 'tnt' ? 'boom' : 'pop']();
    burst(k.x, k.y, [0xfff1c2, 0xffb703, 0xff5a1f], 6, 120, 0.55, 22);
    shout(SHOUT[event]);
  } else if (event === 'trampoline') {
    cam.shake = Math.min(1, cam.shake + 0.35);
    audio.boing();
    shout(SHOUT.trampoline);
    const bed = course.find((p) => p.type === 'trampoline' && p.ready === k.frame + 10);
    if (bed) bed.squash = 1;
  } else if (event === 'spikes') {
    game.hold = 0.7;
    cam.shake = Math.min(1.4, cam.shake + 0.7);
    audio.yow();
    burst(k.x, k.y, [0x1a1612, 0x3a3228], 5, 70, 0.4, 12);
    shout(SHOUT.spikes);
  } else if (event === 'venus') {
    game.hold = 0.8;
    cam.shake = Math.min(1.2, cam.shake + 0.55);
    audio.chomp();
    kitten.mesh.visible = false;
    shout(SHOUT.venus);
    if (prop) prop.chomp = 1;
    else {
      const plant = course.find((p) => p.type === 'venus' && p.spent);
      if (plant) plant.chomp = 1;
    }
  }
}

function applyHold(dt) {
  if (game.phase !== 'aim') return;
  const now = performance.now();
  if (hold.ArrowUp && now - hold.ArrowUp > 150) game.angle += 70 * dt;
  if (hold.ArrowDown && now - hold.ArrowDown > 150) game.angle -= 70 * dt;
  clampAngle();
}

function press(code) {
  if (hold[code]) return;
  hold[code] = performance.now();
  nudge(code === 'ArrowUp' ? 1 : -1);
}

function release(code) {
  hold[code] = 0;
}

function pressAimKey(code) {
  const dir = aimDir(code);
  if (!dir) return false;
  const keys = aimHeld[dir];
  const fresh = keys.size === 0;
  keys.add(code);
  if (fresh) press(dir);
  return true;
}

function releaseAimKey(code) {
  const dir = aimDir(code);
  if (!dir) return;
  const keys = aimHeld[dir];
  keys.delete(code);
  if (keys.size === 0) release(dir);
}

function onAction() {
  if (wipeOpen() || !kitten) return;
  if (game.phase === 'title') startAim();
  else if (game.phase === 'aim') beginShot(null);
  else if (game.phase === 'flight' || game.phase === 'result') retry();
}

window.addEventListener('keydown', (e) => {
  if (wipeOpen()) {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      cancelWipe();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      // Keep focus on Cancel by default; Enter activates the focused button.
      e.preventDefault();
      if (document.activeElement === wipeConfirmEl) acceptWipe();
      else cancelWipe();
    } else if (e.code === 'KeyR' || e.code === 'KeyP' || aimDir(e.code)) {
      e.preventDefault();
    }
    return;
  }
  if (e.code === 'Escape' && document.querySelector('.ride-badge.is-open')) {
    e.preventDefault();
    closeBadgeTips();
    return;
  }
  // Space and Enter start the same visit over. R rebuilds the field in place.
  // Shift+R opens an in-game wipe confirm. It is not listed in the hint.
  if (e.code === 'KeyR') {
    if (e.repeat) return;
    e.preventDefault();
    if (e.shiftKey) confirmClearBests();
    else reloadField();
    return;
  }
  const accept = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
  const aiming = !!aimDir(e.code);
  if (accept || aiming || e.code === 'KeyP') e.preventDefault();
  if (game.paused) {
    if (!e.repeat && (accept || e.code === 'Escape' || e.code === 'KeyP')) setPaused(false);
    return;
  }
  if (resultCardOpen() && !e.repeat && e.code === 'Escape') {
    dismissResultCard();
    return;
  }
  if (aiming) {
    if (!e.repeat) pressAimKey(e.code);
    return;
  }
  if (e.repeat) return;
  if (accept) onAction();
  else if (e.code === 'KeyP') setPaused(true);
  else if (e.code === 'KeyM') {
    safeAudio(() => audio.unlock());
    paintMute(audio.toggleMute());
  }
});
window.addEventListener('keyup', (e) => {
  if (aimDir(e.code)) releaseAimKey(e.code);
});

// iOS drops click on a local file, and it also drops the first tap when a
// full-screen parent has pointer-events: none. touchend is the gesture that fires.
function bindTap(el, fn) {
  // 0 would ignore a tap in the first 400ms, because performance.now() starts at 0.
  let last = -Infinity;
  const run = (event) => {
    const now = performance.now();
    if (now - last < 400) return;
    last = now;
    if (event.cancelable) event.preventDefault();
    fn();
  };
  el.addEventListener('click', run);
  el.addEventListener('touchend', run, { passive: false });
}

const fullscreenEl = document.querySelector('#fullscreen');

function fullscreenOn() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function paintFullscreen() {
  const on = fullscreenOn();
  fullscreenEl.classList.toggle('is-full', on);
  fullscreenEl.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
}

function toggleFullscreen() {
  try {
    if (fullscreenOn()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) return;
      const pending = exit.call(document);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return;
    }
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) return;
    let pending;
    try {
      pending = req.call(root, { navigationUI: 'hide' });
    } catch {
      pending = req.call(root);
    }
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {
    // The button is desktop-only. A refusal leaves it in place.
  }
}

const fullscreenQuery = window.matchMedia('(pointer: coarse), (hover: none)');
function syncFullscreenButton() {
  const root = document.documentElement;
  const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  fullscreenEl.hidden = !(supported && !fullscreenQuery.matches);
}
syncFullscreenButton();
fullscreenQuery.addEventListener('change', syncFullscreenButton);
bindTap(fullscreenEl, toggleFullscreen);
document.addEventListener('fullscreenchange', paintFullscreen);
document.addEventListener('webkitfullscreenchange', paintFullscreen);

bindTap(document.querySelector('#start'), startAim);
bindTap(document.querySelector('#again'), retry);
bindTap(document.querySelector('#card-back'), goTitle);
bindTap(document.querySelector('#pause-back'), goTitle);
bindTap(document.querySelector('#reload'), reloadField);

function paintMute(muted) {
  muteEl.classList.toggle('is-muted', muted);
  muteEl.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
}

bindTap(muteEl, () => {
  safeAudio(() => audio.unlock());
  paintMute(audio.toggleMute());
});

let clockOffset = 0;
let pausedAt = 0;

// The aim bar and the shot both read this. A pause adds to clockOffset, so a
// raw performance.now() would fire a different percent than the bar shows.
function playSeconds(now = performance.now()) {
  return (now - clockOffset) / 1000;
}

function setPaused(on) {
  if (on === game.paused) return;
  game.paused = on;
  app.classList.toggle('is-paused', on);
  pauseEl.classList.toggle('hidden', !on);
  pauseBtn.setAttribute('aria-label', on ? 'Resume' : 'Pause');
  if (on) {
    pausedAt = performance.now();
    touchAim = null;
    audio.wind(0);
    fillPauseCard();
    resumeEl.focus();
    return;
  }
  clockOffset += performance.now() - pausedAt;
  last = performance.now();
}

function fillPauseCard() {
  const k = game.kitten;
  const inShot = !!(k && (game.phase === 'flight' || game.phase === 'result'));
  const stillFlying = inShot && game.phase === 'flight' && !k.dead;
  pauseFeetEl.hidden = !inShot;
  pauseFeetEl.textContent = inShot ? formatFt(feetFromTravel(k.startX, k.x)) : '';
  if (!inShot) pauseNoteEl.replaceChildren();
  else if (stillFlying) fillLiveLine(pauseNoteEl, k);
  else fillShotLine(pauseNoteEl, k.cause);
  pauseSheetEl.replaceChildren();
  appendPersonalStats(pauseSheetEl, null, stillFlying || !inShot ? null : k.cause);
}

bindTap(pauseBtn, () => setPaused(!game.paused));
bindTap(resumeEl, () => setPaused(false));
pauseEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === pauseEl) setPaused(false);
});

bindTap(wipeCancelEl, cancelWipe);
bindTap(wipeConfirmEl, acceptWipe);
wipeEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (e.target === wipeEl) cancelWipe();
});

// A tap or a mouse click on the field is Enter. A touch drag aims.
// Up and left raise the barrel. Down and right lower it. The barrel pivots,
// so a diagonal or an arc has to count on both axes. A mouse drag does not aim.
// Buttons keep their own taps.
let touchAim = null;
function fieldTarget(target) {
  // Cream dialog panels absorb taps so they do not Start / Fire again.
  return !(target && target.closest && target.closest(
    'button, a, #wipe, #title .panel, #card .panel, #pause .panel',
  ));
}
// A long press on the field must not start a selection. The stats cards
// and the pause card are the only text a player can select.
app.addEventListener('selectstart', (event) => {
  const panel = event.target.closest && event.target.closest('#title .panel, #card .panel, #pause .panel, #wipe .panel');
  if (panel && !(event.target.closest && event.target.closest('button'))) return;
  event.preventDefault();
});

app.addEventListener('pointerdown', (e) => {
  const onBadge = !!(e.target && e.target.closest && e.target.closest('.ride-badge'));
  // Dismissing a tip by tapping elsewhere must not also Start / Fire.
  const closedTip = onBadge ? false : closeBadgeTips();
  if (wipeOpen() || !fieldTarget(e.target)) return;
  // Pause scrim is pointer-events:none so HUD buttons work; a field tap resumes.
  if (game.paused) {
    setPaused(false);
    return;
  }
  // First press outside the score panel peeks the landed field. Stay in result
  // so a later tap / Space / Again still retries. Mouse and touch both count.
  if (dismissResultCard()) return;
  if (e.pointerType !== 'mouse') safeAudio(() => audio.unlock());
  touchAim = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    moved: false,
    mouse: e.pointerType === 'mouse',
    suppressAction: closedTip,
  };
});
app.addEventListener('pointermove', (e) => {
  if (wipeOpen() || !touchAim || e.pointerId !== touchAim.id) return;
  const dx = e.clientX - touchAim.lastX;
  const dy = e.clientY - touchAim.lastY;
  const adx = Math.abs(e.clientX - touchAim.x);
  const ady = Math.abs(e.clientY - touchAim.y);
  if (!touchAim.moved) {
    if (Math.hypot(adx, ady) < 16) return;
    touchAim.moved = true;
  }
  if (touchAim.mouse) return;
  touchAim.lastX = e.clientX;
  touchAim.lastY = e.clientY;
  if (game.phase === 'aim' || game.phase === 'title') {
    // Screen y grows downward, so a negative dy is up.
    game.angle -= (dx + dy) * 0.32;
    clampAngle();
  }
});
function endTouchAim(e) {
  if (!touchAim || e.pointerId !== touchAim.id) return;
  // Mouse field clicks never Start / Fire / Again — use keyboard or the buttons.
  // A tap that only closed a badge tip also stays quiet (desktop and mobile).
  const tap = !wipeOpen() && !touchAim.moved && !touchAim.mouse && !touchAim.suppressAction
    && fieldTarget(e.target);
  touchAim = null;
  if (tap) onAction();
}
app.addEventListener('pointerup', endTouchAim);
app.addEventListener('pointercancel', endTouchAim);

for (const button of document.querySelectorAll('#pad button')) {
  const act = button.dataset.act;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    safeAudio(() => audio.unlock());
    if (act === 'fire') onAction();
    else press(act === 'up' ? 'ArrowUp' : 'ArrowDown');
  });
  button.addEventListener('pointerup', () => {
    if (act === 'up') release('ArrowUp');
    if (act === 'down') release('ArrowDown');
  });
  button.addEventListener('pointerleave', () => {
    if (act === 'up') release('ArrowUp');
    if (act === 'down') release('ArrowDown');
  });
}

function installedApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

// The home-screen window reports a height short of the screen. A fixed box
// clipped to that window buried the aim card in the dirt strip. The shell
// stays in normal flow at the full screen height, and the HUD lifts by
// however much of that shell still sits below the visible window.
function placeShell() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (installedApp()) {
    root.classList.add('installed');
    root.style.position = 'static';
    root.style.width = '100%';
    root.style.height = '100vh';
    document.body.style.position = 'static';
    document.body.style.width = '100%';
    document.body.style.height = '100vh';
    app.style.position = 'relative';
    app.style.left = '0px';
    app.style.top = '0px';
    app.style.right = 'auto';
    app.style.bottom = 'auto';
    app.style.width = '100vw';
    app.style.height = '100vh';
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const hang = Math.round(app.getBoundingClientRect().bottom - visibleBottom);
    const gap = Math.min(96, Math.max(0, hang));
    root.style.setProperty('--clip-gap', `${gap}px`);
    return;
  }
  root.classList.remove('installed');
  root.style.position = '';
  root.style.width = '';
  root.style.height = '';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.height = '';
  app.style.position = '';
  root.style.setProperty('--clip-gap', '0px');
  if (!vv) return;
  app.style.left = `${vv.offsetLeft}px`;
  app.style.top = `${vv.offsetTop}px`;
  app.style.width = `${vv.width}px`;
  app.style.height = `${vv.height}px`;
  app.style.right = 'auto';
  app.style.bottom = 'auto';
}

function resize() {
  placeShell();
  if (badgeTipFor) {
    if (badgeTipFor.isConnected) placeBadgeTip(badgeTipFor);
    else closeBadgeTips();
  }
  if (!pixi.renderer) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  pixi.renderer.resize(Math.max(1, w), Math.max(1, h));
  layoutView(0, 0);
  // A resize clears the canvas. The paused loop does not draw, so a turn of
  // the phone would leave the dirt color until Resume.
  if (game.paused && game.checked) {
    updateCamera(0);
    layoutView(0, 0);
    pixi.render();
  }
}
let viewportFrame = 0;
function queueResize() {
  if (viewportFrame) return;
  viewportFrame = requestAnimationFrame(() => {
    viewportFrame = 0;
    resize();
  });
}
window.addEventListener('resize', queueResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueResize);
  window.visualViewport.addEventListener('scroll', queueResize);
}
// Overlay cards scroll inside themselves; a fixed tip would drift, so tuck it away.
for (const scroller of [document.querySelector('#title'), cardEl, pauseEl]) {
  if (scroller) scroller.addEventListener('scroll', closeBadgeTips, { passive: true });
}
placeShell();
function seatKitten() {
  if (kitten.mesh.parent === cannon.pivot) return;
  // Bore is child 0. The tube is drawn after the cat, so the body stays inside.
  cannon.pivot.addChildAt(kitten.mesh, 1);
}

function releaseKitten() {
  if (kitten.mesh.parent === actorLayer) return;
  const at = actorLayer.getChildIndex(shadow);
  actorLayer.addChildAt(kitten.mesh, at + 1);
}

function kittenAnchor() {
  if (kitten.mesh.parent !== cannon.pivot) {
    return { x: kitten.mesh.position.x, y: kitten.mesh.position.y };
  }
  const a = cannon.pivot.rotation;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const lx = kitten.mesh.position.x;
  const ly = kitten.mesh.position.y;
  const pivot = cannon.pivot.position;
  const root = cannon.root.position;
  return {
    x: root.x + pivot.x + lx * cos - ly * sin,
    y: root.y + pivot.y + lx * sin + ly * cos,
  };
}

function placeKitten(time) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  if (!flying) {
    seatKitten();
    const bob = Math.sin(time * 2.5) * 0.45;
    kitten.mesh.position.set(kitten.seat.x, kitten.seat.y + bob);
    kitten.mesh.rotation = Math.sin(time * 1.7) * 0.025;
    const breathe = 1 + Math.sin(time * 3.1) * 0.028;
    kitten.mesh.scale.set(1, breathe);
    kitten.tail.rotation = Math.sin(time * 2.2) * 0.22;
    kitten.eye.scale.y = Math.sin(time * 0.7) > 0.975 ? 0.12 : 1;
    return;
  }
  releaseKitten();
  const k = game.kitten;
  const y = k.cause === 'spikes' ? Math.max(8, k.y - game.sink) : k.y;
  kitten.mesh.position.set(k.x, y);
  if (k.cause === 'landed') {
    const current = kitten.mesh.rotation;
    const rest = Math.round(current / (Math.PI * 2)) * Math.PI * 2;
    kitten.mesh.rotation = current + (rest - current) * 0.18;
    kitten.tail.rotation = Math.sin(time * 2.4) * 0.2;
  } else {
    kitten.mesh.rotation = (k.spin * Math.PI) / 180;
    kitten.tail.rotation = k.dead ? 0.35 : Math.sin(time * 6.5) * 0.12 - 0.22;
  }
  const s = game.squash;
  kitten.mesh.scale.set(1 + s * 0.28, 1 - s * 0.32);
  kitten.eye.scale.y = 1;
}

function updateProps(time, dt) {
  for (let i = 0; i < course.length; i++) {
    const prop = course[i];
    const dist = Math.abs(prop.x - cam.x);
    const yDist = prop.type === 'balloon' ? Math.abs(prop.baseY - cam.y) : 0;
    // Build the picture only near the lens, and drop it again on a long flight.
    // The hit data stays on the course either way. Balloons also have to be
    // near the camera in height, or a tall column would all draw at once.
    const xLimit = prop.mesh ? FAR_PROP : NEAR_PROP;
    const yLimit = prop.mesh ? FAR_BALLOON_Y : NEAR_BALLOON_Y;
    if (dist > xLimit || yDist > yLimit) {
      releaseProp(prop);
      continue;
    }
    const gone = (prop.type === 'tnt' || prop.type === 'balloon') && prop.spent;
    if (gone && !prop.mesh) continue;
    ensureProp(prop);
    if (prop.type !== 'balloon' && !(prop.type === 'tnt' && prop.spent)) prop.mesh.visible = true;
    if (prop.type === 'balloon') {
      if (!prop.spent) prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
      prop.mesh.position.y = prop.y;
      prop.mesh.visible = !prop.spent;
      if (prop.parts.spark && !prop.spent) {
        const spark = 0.85 + Math.sin(time * 14 + prop.bob) * 0.35;
        prop.parts.spark.scale.set(spark, spark);
      }
    }
    if (prop.squash > 0) {
      prop.squash *= Math.exp(-dt * 7);
      if (prop.parts.bed) {
        prop.parts.bed.scale.y = 1 - prop.squash * 0.65;
        if (prop.parts.stripe) prop.parts.stripe.position.y = 25.2 - prop.squash * 3;
      }
    }
    if (prop.parts.upper && prop.type === 'venus') {
      const shut = prop.chomp || 0;
      const open = prop.parts.open * (1 - shut);
      prop.parts.upper.rotation = -open;
      prop.parts.lower.rotation = open;
    }
    if (prop.parts.bubbles) {
      const bubbles = prop.parts.bubbles;
      for (let b = 0; b < bubbles.length; b++) {
        const bubble = bubbles[b];
        bubble.position.y = bubble.userData.baseY + Math.sin(time * 2.4 + b * 1.7) * 1.1;
        const s = 0.85 + Math.sin(time * 3.1 + b) * 0.15;
        bubble.scale.set(s, s);
      }
    }
    if ((prop.type === 'tnt' || prop.type === 'spikes') && prop.spent) {
      // The tar pit stays. The crate is gone after it blows.
      if (prop.type === 'tnt') prop.mesh.visible = false;
    }
  }
}

function aimFocus() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  const halfW = viewHalfWidth(w, h);
  // x=490 looks down the field. A narrow view then starts past the wheels.
  return { x: Math.min(490, CANNON_X + PIVOT_X - 84 + halfW), y: 120, halfW };
}

function updateCamera(dt) {
  const flying = game.phase === 'flight' || game.phase === 'result';
  const k = game.kitten;
  // One distance for the whole flight. The camera follows; it does not zoom.
  // The lead shrinks on a narrow screen so the kitten stays in frame.
  const home = aimFocus();
  const halfW = home.halfW;
  const lead = Math.min(220, halfW * 0.42);
  // The score card sits on the center of the screen. On the result, look
  // further ahead so the landing flag clears that card. Flight keeps the
  // shorter lead. The clamp keeps the kitten on screen.
  let focusLead = lead;
  if (game.phase === 'result') {
    const viewW = canvas.clientWidth || window.innerWidth;
    const cardPx = Math.min(560, Math.max(0, viewW - 32));
    const cardHalfWorld = (cardPx * 0.5) / Math.max(1, viewW) * (halfW * 2);
    focusLead = Math.min(halfW * 0.78, Math.max(lead, cardHalfWorld + 48));
  }
  const focusX = flying ? k.x + focusLead : home.x;
  const focusY = flying ? Math.max(120, k.y - 36) : 120;
  if (flying) {
    cam.x = focusX;
    cam.y = focusY;
  } else {
    const blend = 1 - Math.exp(-dt * (game.snap ? 40 : 4));
    cam.x += (focusX - cam.x) * blend;
    cam.y += (focusY - cam.y) * blend;
  }
  game.snap = false;
  cam.shake *= Math.exp(-dt * 5.5);
}

function updateHud() {
  const power = powerFromClock(playSeconds());
  const pct = powerPercent(power);
  angleEl.textContent = `${Math.round(game.angle)}°`;
  powerEl.style.setProperty('--power-pct', `${pct}%`);
  powerLabelEl.textContent = `${pct}%`;
  if (game.kitten && (game.phase === 'flight' || game.phase === 'result')) {
    const feet = feetFromTravel(game.kitten.startX, game.kitten.x);
    game.feet = feet;
    distanceEl.textContent = formatFt(feet);
    const alt = feetFromAltitude(game.kitten.y);
    const tier = heightTier(alt);
    const prev = Number(altitudeEl.dataset.tier || 0);
    altitudeEl.dataset.tier = String(tier);
    if (tier > prev) {
      altitudeEl.classList.remove('pop');
      void altitudeEl.offsetWidth;
      altitudeEl.classList.add('pop');
    }
    altitudeEl.textContent = `↑ ${formatFt(alt)}`;
    speedEl.textContent = formatSpeed(game.kitten.vx);
    speedEl.classList.toggle('terminal', atTerminalSpeed(game.kitten.vx));
    timeEl.textContent = formatFlight(flightSeconds(game.kitten.frame));
  }
  cannon.ticks.visible = game.phase === 'aim' || game.phase === 'title';
  cannon.pivot.rotation = (game.angle * Math.PI) / 180;
  // Kick straight back along the barrel. The carriage stays on the ground.
  const aim = aimVector(game.angle);
  cannon.pivot.position.set(
    PIVOT_X - aim.x * game.recoil,
    PIVOT_Y - aim.y * game.recoil,
  );
}

function layoutView(jx, jy) {
  const w = canvas.clientWidth || window.innerWidth || 1;
  const h = canvas.clientHeight || window.innerHeight || 1;
  view = applyWorld(world, Math.max(1, w), Math.max(1, h), cam.x + jx, cam.y + jy);
}

function worldOf(display, localX = 0, localY = 0) {
  const p = display.toGlobal({ x: localX, y: localY });
  return {
    x: view.camX + (p.x - view.screenW / 2) / view.scale,
    y: view.camY - (p.y - view.screenH / 2) / view.scale,
  };
}

function assertFrames() {
  const flat = aimVector(0);
  const up = aimVector(90);
  if (flat.x < 0.999 || Math.abs(flat.y) > 1e-6) throw new Error('aim 0 should point +X');
  if (up.y < 0.999 || Math.abs(up.x) > 1e-6) throw new Error('aim 90 should point +Y');

  cannon.pivot.rotation = Math.PI / 2;
  cannon.pivot.position.x = PIVOT_X;
  layoutView(0, 0);
  const mark = worldOf(cannon.muzzle);
  const expected = barrelMuzzle(90);
  if (Math.abs(mark.x - expected.x) > 0.5 || Math.abs(mark.y - expected.y) > 0.5) {
    throw new Error(`muzzle ${mark.x.toFixed(1)},${mark.y.toFixed(1)} != ${expected.x.toFixed(1)},${expected.y.toFixed(1)}`);
  }

  const screenUp = world.toGlobal({ x: view.camX, y: view.camY + 80 });
  const origin = world.toGlobal({ x: view.camX, y: view.camY });
  const screenRight = world.toGlobal({ x: view.camX + 80, y: view.camY });
  if (!(screenUp.y < origin.y - 1)) throw new Error('world up should be up the screen');
  if (!(screenRight.x > origin.x + 1)) throw new Error('world +X should point right');

  kitten.mesh.rotation = (game.angle * Math.PI) / 180;
  const nose = worldOf(kitten.mesh, 20, 0);
  const at = worldOf(kitten.mesh);
  const dx = nose.x - at.x;
  const dy = nose.y - at.y;
  const len = Math.hypot(dx, dy) || 1;
  const aim = aimVector(game.angle);
  const dot = (dx / len) * aim.x + (dy / len) * aim.y;
  if (dot < 0.98) throw new Error(`kitten nose is ${dot.toFixed(3)} off the barrel`);
}

let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (!kitten) return;
  if (game.paused && game.checked) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = playSeconds(now);
  applyHold(dt);
  game.recoil *= Math.exp(-dt * 6);
  game.squash *= Math.exp(-dt * 9);
  if (game.kitten && game.kitten.cause === 'spikes') game.sink = Math.min(12, game.sink + dt * 22);

  if (game.phase === 'flight' && game.kitten && !game.kitten.dead) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5 && !game.kitten.dead) {
      const props = fieldProps(game.kitten);
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop.type === 'balloon' && !prop.spent) {
          prop.y = prop.baseY + Math.sin(time * 1.5 + prop.bob) * 11;
        }
      }
      onEvent(step(game.kitten, props));
      afterStep();
      acc -= STEP;
      steps += 1;
    }
    // Loudness levels off around the old 240 px/frame. The flight itself does not.
    audio.wind(Math.min(1, Math.abs(game.kitten.vx) / 240));
    commitRecords();
  } else {
    acc = 0;
    audio.wind(0);
  }

  if (game.phase === 'flight' && game.kitten && game.kitten.dead) {
    game.hold -= dt;
    if (game.hold <= 0) finish();
  }

  updateProps(time, dt);
  placeKitten(time);
  updateHud();
  updateCamera(dt);

  const t = performance.now() * 0.05;
  const jx = Math.sin(t) * cam.shake * 10;
  const jy = Math.cos(t * 0.8) * cam.shake * 7;
  layoutView(jx, jy);
  const draw = { x: view.camX, y: view.camY };

  const anchor = kittenAnchor();
  const h = Math.max(0, anchor.y - GROUND_Y);
  const shade = Math.max(0.35, 1.25 - h / 200);
  shadow.position.x = anchor.x;
  shadow.scale.set(shade, shade);
  shadow.alpha = Math.max(0.04, 0.32 - h / 420);
  shadow.visible = kitten.mesh.visible;

  scenery.update(time, draw, view);
  flybys.update(time, dt, draw, game.kitten ? game.kitten.y : 0, game.phase === 'flight' && game.kitten && !game.kitten.dead);
  particles.update(dt);
  pixi.render();

  if (!game.checked) {
    if (game.kitten) {
      const at = worldOf(kitten.mesh);
      if (Math.abs(at.x - view.camX) > view.halfW || Math.abs(at.y - view.camY) > view.halfH) {
        throw new Error(`kitten off screen (${at.x.toFixed(0)}, ${at.y.toFixed(0)})`);
      }
    }
    game.checked = true;
    window.__kitten.ready = true;
  }
}

async function boot() {
  const w0 = canvas.clientWidth || window.innerWidth || 800;
  const h0 = canvas.clientHeight || window.innerHeight || 600;
  await pixi.init({
    canvas,
    width: Math.max(1, w0),
    height: Math.max(1, h0),
    background: 0x9ed4f6,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: false,
    preference: 'webgl',
    autoStart: false,
    accessibilityOptions: { activateOnTab: false },
  });
  pixi.stage.eventMode = 'none';
  if (pixi.renderer.events) pixi.renderer.events.autoPreventDefault = false;

  scenery = createScenery(world);
  flybys = createFlybys(scenery.flyLayer);
  pixi.stage.addChild(scenery.sky, world);
  world.addChild(propLayer, actorLayer);

  kitten = makeKittenMesh();
  cannon = createCannon();
  stake = createStake();
  shadow = new Graphics();
  shadow.ellipse(0, 2, 16, 5.5);
  shadow.fill({ color: 0x1d3a16, alpha: 1 });
  actorLayer.addChild(cannon.root, shadow, kitten.mesh, stake);
  particles = createParticles(actorLayer);

  resize();
  if (game.furthest > 0) {
    game.furthestX = xForFeet(game.furthest);
    plantPole(game.furthestX, game.furthest);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      repaintRanks();
      refreshLettering();
    }).catch(() => {});
  }

  assertFrames();
  setPhase('title');
  paintRecords();
  // A refresh that interrupted aim/flight counts as a mid-game reset once,
  // before applyQuery opens a fresh attempt for demos / ?phase=aim.
  if (hasOpenAttempt()) {
    noteReset();
    clearAttempt();
  }
  applyQuery();
  requestAnimationFrame(frame);
}

// The query runs after the picture exists. A demo steps the flight before
// the first frame, so a screenshot lands on that shot.
function applyQuery() {
  if (params.get('phase') === 'aim') startAim();
  if (!params.has('demo')) return;
  game.angle = Number(params.get('angle') || 30);
  clampAngle();
  startAim();
  beginShot(Number(params.get('power') || POWER_MAX));
  const frames = Number(params.get('frames') || 0);
  for (let i = 0; i < frames && game.kitten && !game.kitten.dead; i++) {
    onEvent(step(game.kitten, fieldProps(game.kitten)));
    afterStep();
  }
  // Optional peak= / terminal= raise recorded crest and speed for demos.
  const peakFt = Number(params.get('peak') || 0);
  if (peakFt > 0) {
    game.peakY = Math.max(game.peakY, GROUND_Y + peakFt * PIXELS_PER_FOOT);
  }
  if (params.has('terminal')) {
    game.peakSpeed = Math.max(game.peakSpeed, SPEED_MAX);
  }
  commitRecords();
  noteRideBadges();
  if (frames > 0 && game.kitten && game.kitten.dead) game.hold = 0;
}

boot().catch((error) => {
  const pre = document.createElement('pre');
  pre.id = 'boot-error';
  pre.textContent = error && error.stack ? error.stack : String(error);
  document.body.appendChild(pre);
});

window.__kitten = {
  ready: false,
  get phase() { return game.phase; },
  get angle() { return game.angle; },
  get feet() { return game.feet; },
  get records() {
    return {
      furthest: game.furthest,
      highest: game.highest,
      longest: game.longest,
      shortest: game.shortest,
      marsVisits: game.marsVisits,
      terminalVisits: game.terminalVisits,
      fullPowerVisits: game.fullPowerVisits,
      resets: game.resets,
      endings: { ...game.endings },
    };
  },
  get poles() {
    return poles.map((pole) => ({ x: pole.x, feet: pole.feet, rank: pole.rank }));
  },
  get coat() { return kitten.coat(); },
  get sky() { return flybys.stats(); },
  get cause() { return game.kitten ? game.kitten.cause : null; },
  get x() { return game.kitten ? game.kitten.x : launchPoint(game.angle).x; },
  get y() { return game.kitten ? game.kitten.y : launchPoint(game.angle).y; },
  start: startAim,
  aim(n) { game.angle = n; clampAngle(); },
  fire(power) { beginShot(power == null ? null : Number(power)); },
  show(kind, at) {
    flybys.launch(cam, game.kitten ? game.kitten.y : cam.y, kind, at || null);
  },
  retry,
  reload: reloadField,
  clearBests,
};
