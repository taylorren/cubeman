/**
 * Tiny synthesized sound via Web Audio API — no audio files, just like the
 * visuals are synthesized pixels. Lazy-creates the AudioContext on first use
 * (must be after a user gesture to satisfy browser autoplay policy).
 * Sparse by design: only the Musician profession produces sound.
 */

type SoundId = 'airGuitar' | 'symphony5' | 'symphony9';

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Schedule a node for disconnection after a delay (relative to now).
 *  Uses setTimeout because osc.onended may not fire if the context is suspended. */
function dispose(node: AudioNode, delaySec: number): void {
  setTimeout(() => {
    try { node.disconnect(); } catch { /* already disconnected */ }
  }, delaySec * 1000);
}

/** Air Guitar — a longer, classic rock-style solo with multiple phrases.
 *  Mimics the arc of a famous solo: power chord → bluesy bend → descending
 *  run → sustained finish. */
function playAirGuitar(): void {
  const c = audio();
  const t = c.currentTime;

  // shared fuzzy tone: sawtooth + lowpass
  function fuzz(freq: number, start: number, dur: number, peak: number): void {
    const g = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 2;
    filter.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    for (const detune of [-5, 0, 5]) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
    // disconnect all nodes after the note finishes (relative delay)
    const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
    dispose(g, remaining);
    dispose(filter, remaining);
  }

  // phrase 1: opening power chord (E)
  fuzz(164.81, t, 0.4, 0.15); // E3
  fuzz(246.94, t, 0.4, 0.12); // B3
  fuzz(329.63, t, 0.4, 0.12); // E4

  // phrase 2: bluesy bend (G → A → G bend)
  const t2 = t + 0.45;
  fuzz(392.0, t2, 0.2, 0.14); // G4
  fuzz(440.0, t2 + 0.22, 0.15, 0.13); // A4
  fuzz(392.0, t2 + 0.4, 0.25, 0.14); // G4 (bend back)

  // phrase 3: descending run (E-D-C-B)
  const t3 = t + 1.1;
  const run = [
    { f: 329.63, d: 0.12 }, // E4
    { f: 293.66, d: 0.12 }, // D4
    { f: 261.63, d: 0.12 }, // C4
    { f: 246.94, d: 0.12 }, // B3
  ];
  let when = t3;
  for (const n of run) {
    fuzz(n.f, when, n.d, 0.13);
    when += n.d;
  }

  // phrase 4: sustained finish (low E, long decay)
  fuzz(164.81, t + 1.7, 0.6, 0.16);
  fuzz(82.41, t + 1.7, 0.6, 0.12);
}

/** Symphony No. 9 — Beethoven's "Ode to Joy" first phrase.
 *  A warm, choir-like statement of the famous melody. */
function playSymphony9(): void {
  const c = audio();
  const t = c.currentTime;
  // Ode to Joy first phrase in C major: E E F G G F E D C C D E E D D
  const melody = [
    { f: 329.63, d: 0.18 }, // E4
    { f: 329.63, d: 0.18 }, // E4
    { f: 349.23, d: 0.18 }, // F4
    { f: 392.0, d: 0.36 },  // G4 (long)
    { f: 392.0, d: 0.18 },  // G4
    { f: 349.23, d: 0.18 }, // F4
    { f: 329.63, d: 0.18 }, // E4
    { f: 293.66, d: 0.18 }, // D4
    { f: 261.63, d: 0.36 }, // C4 (long)
    { f: 261.63, d: 0.18 }, // C4
    { f: 293.66, d: 0.18 }, // D4
    { f: 329.63, d: 0.18 }, // E4
    { f: 329.63, d: 0.27 }, // E4 (long)
    { f: 293.66, d: 0.54 }, // D4 (long, final)
  ];
  let when = t;
  for (const n of melody) {
    // warm choir tone: triangle + sine, slight detune
    const g = c.createGain();
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 2500;
    filt.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.12, when + 0.02);
    g.gain.setValueAtTime(0.12, when + n.d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, when + n.d);
    for (const type of ['triangle', 'sine'] as const) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = n.f;
      osc.connect(filt);
      osc.start(when);
      osc.stop(when + n.d + 0.05);
    }
    // disconnect shared nodes after the note finishes (relative delay)
    const remaining = Math.max(0, when + n.d + 0.1 - c.currentTime);
    dispose(g, remaining);
    dispose(filt, remaining);
    when += n.d;
  }
}

/** Symphony No. 5 — Beethoven's famous opening motif: G-G-G-Eb (fate knocking).
 *  A brassy, ominous statement — layered sawtooths with a slight crescendo. */
function playSymphony5(): void {
  const c = audio();
  const t = c.currentTime;
  // G4 = 392Hz, Eb4 = 311Hz. Rhythm: three short, one long.
  const g = 392.0;
  const eb = 311.13;
  const noteLen = 0.16; // short eighth notes
  const gap = 0.04;
  const longLen = 0.9; // long final note

  // play a chord tone with a brassy timbre (sawtooth + triangle, slight detune)
  function brass(freq: number, start: number, dur: number, peak: number): void {
    const gNode = c.createGain();
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1200; // brassy brightness
    filt.connect(gNode);
    gNode.connect(c.destination);
    // envelope: quick attack, sustain, quick drop at end
    gNode.gain.setValueAtTime(0, start);
    gNode.gain.linearRampToValueAtTime(peak, start + 0.03);
    gNode.gain.setValueAtTime(peak, start + dur * 0.7);
    gNode.gain.exponentialRampToValueAtTime(0.001, start + dur);
    for (const detune of [-6, 0, 6]) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filt);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
    // a touch of triangle in the body for warmth
    const tri = c.createOscillator();
    tri.type = 'triangle';
    tri.frequency.value = freq;
    const triG = c.createGain();
    triG.gain.value = 0.3;
    tri.connect(triG);
    triG.connect(gNode);
    tri.start(start);
    tri.stop(start + dur + 0.05);
    // disconnect all nodes after the note finishes (relative delay)
    const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
    dispose(gNode, remaining);
    dispose(filt, remaining);
    dispose(triG, remaining);
  }

  // three short Gs
  let when = t;
  for (let i = 0; i < 3; i++) {
    brass(g, when, noteLen, 0.18);
    when += noteLen + gap;
  }
  // one long Eb (the "fate" note)
  brass(eb, when, longLen, 0.22);
}

/** Play a synthesized sound by id. Safe to call before audio is ready — lazily
 *  initializes on first user gesture. */
export function playSound(id: SoundId): void {
  try {
    switch (id) {
      case 'airGuitar':
        playAirGuitar();
        break;
      case 'symphony9':
        playSymphony9();
        break;
      case 'symphony5':
        playSymphony5();
        break;
    }
  } catch {
    // audio unavailable (no gesture yet, or no device) — silently ignore
  }
}

export type { SoundId };
