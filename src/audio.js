// Small synthesized effects. Nothing here is from the original game's soundtrack.

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

  // Classic Flash-era cat meow: rise, crest, fall. Wide lowpass keeps it loud;
  // a harsh bandpass was swallowing these on preview.
  function playMeowSpec(spec) {
    const c = context();
    const t = c.currentTime;
    const dur = spec.dur;
    const peak = Math.max(0.2, spec.peak);
    const type = spec.type || 'triangle';
    const rise = spec.rise != null ? spec.rise : 0.28;
    const hold = spec.hold != null ? spec.hold : 0.45;

    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(spec.start, t);
    o.frequency.linearRampToValueAtTime(spec.crest, t + dur * rise);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, spec.end), t + dur);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    const bright = spec.formant || spec.crest * 1.4;
    lp.frequency.setValueAtTime(Math.max(600, bright * 0.85), t);
    lp.frequency.linearRampToValueAtTime(Math.max(800, bright * 1.2), t + dur * rise);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, bright * 0.55), t + dur);
    o.connect(lp);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.03, dur * 0.1));
    g.gain.exponentialRampToValueAtTime(peak * 0.75, t + dur * hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);

    if (spec.harm) {
      const h = c.createOscillator();
      h.type = 'sine';
      h.frequency.setValueAtTime(spec.start * 2, t);
      h.frequency.linearRampToValueAtTime(spec.crest * 2, t + dur * rise);
      h.frequency.exponentialRampToValueAtTime(Math.max(1, spec.end * 2), t + dur);
      const hg = c.createGain();
      hg.gain.setValueAtTime(0.0001, t);
      hg.gain.exponentialRampToValueAtTime(peak * spec.harm, t + 0.03);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      h.connect(hg);
      hg.connect(c.destination);
      h.start(t);
      h.stop(t + dur + 0.03);
    }

    if (spec.rasp) {
      const n = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, n, c.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.55 + white * 0.45;
        data[i] = last;
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = 1.4;
      filt.frequency.setValueAtTime(spec.crest, t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(180, spec.end * 1.2), t + dur);
      const rg = c.createGain();
      rg.gain.setValueAtTime(0.0001, t);
      rg.gain.exponentialRampToValueAtTime(peak * spec.rasp, t + 0.025);
      rg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt);
      filt.connect(rg);
      rg.connect(c.destination);
      src.start(t);
    }

    if (spec.tail) {
      const gap = spec.tailGap != null ? spec.tailGap : 0.04;
      const td = spec.tail.dur;
      const to = c.createOscillator();
      to.type = spec.tail.type || type;
      const tt = t + dur * 0.55 + gap;
      to.frequency.setValueAtTime(spec.tail.start, tt);
      to.frequency.linearRampToValueAtTime(spec.tail.crest, tt + td * 0.3);
      to.frequency.exponentialRampToValueAtTime(Math.max(1, spec.tail.end), tt + td);
      const tg = c.createGain();
      tg.gain.setValueAtTime(0.0001, tt);
      tg.gain.exponentialRampToValueAtTime(peak * (spec.tail.peak || 0.85), tt + 0.02);
      tg.gain.exponentialRampToValueAtTime(0.0001, tt + td);
      to.connect(tg);
      tg.connect(c.destination);
      to.start(tt);
      to.stop(tt + td + 0.03);
    }
  }

  // Ten launch meows in the 2005 Kitten Cannon spirit: short cartoon cat yelps.
  // Press 1–9 and 0 during aim to preview. meow() uses the selected pick.
  const MEOWS = [
    {
      id: 1,
      name: 'Classic yelp',
      start: 420, crest: 980, end: 240, dur: 0.3, peak: 0.38,
      type: 'triangle', formant: 1600, harm: 0.22, rasp: 0.1,
    },
    {
      id: 2,
      name: 'Soft mew',
      start: 520, crest: 1100, end: 380, dur: 0.34, peak: 0.3,
      type: 'sine', formant: 1800, harm: 0.16, rise: 0.34,
    },
    {
      id: 3,
      name: 'Nasal meow',
      start: 360, crest: 860, end: 220, dur: 0.36, peak: 0.36,
      type: 'triangle', formant: 1200, harm: 0.14, rasp: 0.08,
    },
    {
      id: 4,
      name: 'Drawn meeeow',
      start: 300, crest: 780, end: 200, dur: 0.5, peak: 0.34,
      type: 'triangle', formant: 1400, harm: 0.18, rise: 0.4, hold: 0.55,
    },
    {
      id: 5,
      name: 'Me-ow double',
      start: 480, crest: 920, end: 400, dur: 0.22, peak: 0.34,
      type: 'triangle', formant: 1500, harm: 0.18,
      tail: { start: 520, crest: 760, end: 210, dur: 0.24, peak: 0.95 },
    },
    {
      id: 6,
      name: 'Raspy Flash',
      start: 380, crest: 900, end: 200, dur: 0.32, peak: 0.36,
      type: 'sawtooth', formant: 1400, harm: 0.1, rasp: 0.28,
    },
    {
      id: 7,
      name: 'Low tomcat',
      start: 220, crest: 560, end: 140, dur: 0.38, peak: 0.42,
      type: 'triangle', formant: 900, harm: 0.24, rasp: 0.12,
    },
    {
      id: 8,
      name: 'Kitten peep',
      start: 700, crest: 1480, end: 520, dur: 0.22, peak: 0.28,
      type: 'sine', formant: 2200, harm: 0.14, rise: 0.22,
    },
    {
      id: 9,
      name: 'Cartoon wah',
      start: 280, crest: 1200, end: 180, dur: 0.4, peak: 0.36,
      type: 'triangle', formant: 1800, harm: 0.2, rise: 0.22, rasp: 0.08,
    },
    {
      id: 10,
      name: 'Squawk meow',
      start: 440, crest: 1050, end: 260, dur: 0.28, peak: 0.38,
      type: 'square', formant: 1400, harm: 0.08, rasp: 0.16, rise: 0.2,
    },
  ];

  let meowPick = 1;

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
      if (c.state === 'suspended') return c.resume();
      return Promise.resolve();
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
      const spec = MEOWS[id - 1];
      if (!spec) return;
      whenReady(() => playMeowSpec(spec));
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
