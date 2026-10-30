// Effects plus recorded launch meows. Samples: src/sfx/meows/CREDITS.txt
import meowUrl01 from './sfx/meows/01.mp3';
import meowUrl02 from './sfx/meows/02.mp3';
import meowUrl03 from './sfx/meows/03.mp3';
import meowUrl04 from './sfx/meows/04.mp3';
import meowUrl05 from './sfx/meows/05.mp3';
import meowUrl06 from './sfx/meows/06.mp3';
import meowUrl07 from './sfx/meows/07.mp3';
import meowUrl08 from './sfx/meows/08.mp3';
import meowUrl09 from './sfx/meows/09.mp3';
import meowUrl10 from './sfx/meows/10.mp3';

export function createAudio() {
  let ctx = null;
  let muted = false;
  let wind = null;

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    // Kick resume; whenReady waits when the first gesture still needs it.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Browsers keep AudioContext suspended until a gesture finishes resuming it.
  // Schedule work after resume so the first key press is not silent.
  function whenReady(fn) {
    const c = context();
    if (c.state === 'suspended') {
      c.resume().then(() => {
        try { fn(); } catch { /* ignore */ }
      }).catch(() => {});
      return;
    }
    fn();
  }

  function envGain(at, duration, peak, attack = 0.012) {
    const g = context().createGain();
    const top = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(top, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + 0.02, duration));
    g.connect(context().destination);
    return g;
  }

  function tone(freq, duration, type, peak, slideTo, delay = 0) {
    const c = context();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
    const g = envGain(t, duration, peak);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  function noise(duration, peak, band, filterFrom, filterTo) {
    const c = context();
    const t = c.currentTime;
    const n = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, n, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = last * (1 - band) + white * band;
      data[i] = last * (1 - i / n);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = envGain(t, duration, peak, Math.min(0.03, duration * 0.25));
    if (filterFrom) {
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFrom, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo || filterFrom), t + duration);
      src.connect(filter);
      filter.connect(g);
    } else {
      src.connect(g);
    }
    src.start(t);
  }

  // Recorded cat meows (see src/sfx/meows/CREDITS.txt). Keys 1–0 preview these.
  const MEOW_URLS = [
    meowUrl01, meowUrl02, meowUrl03, meowUrl04, meowUrl05,
    meowUrl06, meowUrl07, meowUrl08, meowUrl09, meowUrl10,
  ];
  const MEOWS = [
    { id: 1, name: 'Yard yelp A' },
    { id: 2, name: 'Yard yelp B' },
    { id: 3, name: 'Yard yelp C' },
    { id: 4, name: 'Yard yelp D' },
    { id: 5, name: 'Yard yelp E' },
    { id: 6, name: 'Yard yelp F' },
    { id: 7, name: 'Yard yelp G' },
    { id: 8, name: 'House short' },
    { id: 9, name: 'Quick call' },
    { id: 10, name: 'Mixkit meow' },
  ];

  let meowPick = 1;
  const meowBuffers = new Array(MEOW_URLS.length);
  let meowLoad = null;

  function loadMeows() {
    if (meowLoad) return meowLoad;
    const c = context();
    meowLoad = Promise.all(
      MEOW_URLS.map(async (url, i) => {
        const res = await fetch(url);
        const raw = await res.arrayBuffer();
        meowBuffers[i] = await c.decodeAudioData(raw.slice(0));
      }),
    ).catch((err) => {
      meowLoad = null;
      throw err;
    });
    return meowLoad;
  }

  function playMeowSample(index) {
    const buf = meowBuffers[index];
    if (!buf) return;
    const c = context();
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    // Loudnorm samples peak near full scale; match old synth meow (~0.3) under the boom.
    g.gain.value = 0.32;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }

  function ensureWind() {
    if (wind || !ctx) return;
    const c = context();
    const n = c.sampleRate * 8;
    const buffer = c.createBuffer(1, n, c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Soft air. A highpass on bright noise is just hiss.
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.3;
    const amp = c.createGain();
    amp.gain.value = 0;
    src.connect(filter);
    filter.connect(amp);
    amp.connect(c.destination);
    src.start();
    wind = { amp, filter };
  }

  return {
    unlock() {
      const c = context();
      ensureWind();
      const ready = c.state === 'suspended' ? c.resume() : Promise.resolve();
      return ready.then(() => loadMeows()).catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (wind) wind.amp.gain.value = 0;
      return muted;
    },
    get muted() {
      return muted;
    },
    wind(amount) {
      if (!wind || muted) return;
      whenReady(() => {
        const t = Math.max(0, Math.min(1, amount));
        const now = context().currentTime;
        // A slow hop is almost silent. Even a fast shot stays a quiet rush.
        wind.amp.gain.setTargetAtTime(Math.pow(t, 1.7) * 0.055, now, 0.4);
        wind.filter.frequency.setTargetAtTime(380 + t * 420, now, 0.45);
      });
    },
    launch() {
      if (muted) return;
      whenReady(() => {
        noise(0.06, 0.46, 0.9);
        noise(0.22, 0.32, 0.5);
        tone(150, 0.18, 'sine', 0.3, 70);
        tone(520, 0.06, 'triangle', 0.08, 220);
      });
    },
    // Launch meow. Pass 1–10 to preview that pick; omit to use the selected one.
    meow(which) {
      if (muted) return;
      const id = which == null ? meowPick : Math.max(1, Math.min(10, Math.round(Number(which) || 1)));
      whenReady(() => {
        loadMeows()
          .then(() => playMeowSample(id - 1))
          .catch(() => {});
      });
    },
    meowList() {
      return MEOWS.map((m) => ({ id: m.id, name: m.name }));
    },
    get meowPick() {
      return meowPick;
    },
    useMeow(which) {
      meowPick = Math.max(1, Math.min(10, Math.round(Number(which) || 1)));
      return meowPick;
    },
    bounce(speed) {
      if (muted) return;
      const loud = Math.max(0.06, Math.min(0.22, speed / 90));
      noise(0.09, loud, 0.55, 900, 120);
      tone(90 + Math.min(80, speed * 0.4), 0.08, 'sine', loud * 0.7, 48);
    },
    boom() {
      if (muted) return;
      noise(0.045, 0.4, 0.9);
      noise(0.48, 0.36, 0.18, 1100, 70);
      tone(95, 0.42, 'sine', 0.4, 30);
      tone(48, 0.5, 'sine', 0.22, 24);
    },
    pop() {
      if (muted) return;
      noise(0.12, 0.2, 0.9, 4000, 600);
      tone(880, 0.1, 'sine', 0.07, 240);
      tone(1320, 0.05, 'triangle', 0.03, 400);
    },
    boing() {
      if (muted) return;
      const c = context();
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(920, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(280, t + 0.16);
      o.frequency.exponentialRampToValueAtTime(680, t + 0.24);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.24, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.1, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      g.connect(c.destination);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.44);
    },
    chomp() {
      if (muted) return;
      noise(0.16, 0.2, 0.45, 1200, 180);
      tone(240, 0.22, 'sawtooth', 0.05, 55);
      tone(140, 0.18, 'square', 0.03, 40);
    },
    yow() {
      if (muted) return;
      const c = context();
      const t = c.currentTime;
      const n = Math.max(1, Math.floor(c.sampleRate * 0.24));
      const buffer = c.createBuffer(1, n, c.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.35 + white * 0.65;
        data[i] = last * (1 - i / n);
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 7;
      filter.frequency.setValueAtTime(1600, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      g.connect(c.destination);
      src.connect(filter);
      filter.connect(g);
      src.start(t);
      tone(140, 0.14, 'sine', 0.14, 45);
    },
  };
}
