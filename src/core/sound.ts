/**
 * Tiny synthesized sound via Web Audio API — no audio files, just like the
 * visuals are synthesized pixels. Lazy-creates the AudioContext on first use
 * (must be after a user gesture to satisfy browser autoplay policy).
 * Sparse by design: only the Musician profession produces sound.
 *
 * Real-time note synthesis: each note creates its own oscillator(s) that play
 * and auto-stop. A dispose helper schedules cleanup via setTimeout to prevent
 * audio-node leaks.
 */

type SoundId = 'airGuitar' | 'symphony5' | 'symphony9' | 'rocket';

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {
    // gesture-less resume refused (autoplay policy) — the unlock listeners
    // below will retry on the next pointerdown/keydown
  });
  return ctx;
}

/**
 * Autoplay-policy unlock: browsers start an AudioContext in the 'suspended'
 * state when it is created before any user gesture — which happens here when
 * a Musician action fires AUTONOMOUSLY from idle (no click involved). Browsers
 * refuse to start audio until the user interacts with the page, so listen for
 * the first gesture and resume the context then.
 */
function unlockAudio(): void {
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });
}

/** Debug: current AudioContext state ('running' | 'suspended' | 'closed' |
 *  'none' when no context has been created yet). */
export function audioState(): string {
  return ctx?.state ?? 'none';
}

/** Schedule a node for disconnection after a delay (relative to now). */
function dispose(node: AudioNode, delaySec: number): void {
  setTimeout(() => {
    try { node.disconnect(); } catch { /* already disconnected */ }
  }, delaySec * 1000);
}

/** A single oscillator note with a quick pluck envelope. */
function note(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.05);
  const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
  dispose(osc, remaining);
  dispose(g, remaining);
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
      const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
      dispose(osc, remaining);
      dispose(filter, remaining);
    }
    const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
    dispose(g, remaining);
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
    when += n.d + 0.02;
  }

  // phrase 4: sustained low-E finish
  fuzz(164.81, t + 1.7, 0.5, 0.12); // E3
}

/** Symphony No. 9 — Beethoven's "Ode to Joy" first phrase.
 *  E-E-F-G-G-F-E-D-C-C-D-E-E-D-D — warm, choir-like tones. */
function playSymphony9(): void {
  const c = audio();
  const t = c.currentTime;

  // melody: E4-E4-F4-G4-G4-F4-E4-D4-C4-C4-D4-E4-E4-D4-D4
  const melody: Array<{ f: number; d: number }> = [
    { f: 329.63, d: 0.22 }, // E4
    { f: 329.63, d: 0.22 }, // E4
    { f: 349.23, d: 0.22 }, // F4
    { f: 392.0, d: 0.44 }, // G4 (long)
    { f: 392.0, d: 0.22 }, // G4
    { f: 349.23, d: 0.22 }, // F4
    { f: 329.63, d: 0.22 }, // E4
    { f: 293.66, d: 0.22 }, // D4
    { f: 261.63, d: 0.44 }, // C4 (long)
    { f: 261.63, d: 0.22 }, // C4
    { f: 293.66, d: 0.22 }, // D4
    { f: 329.63, d: 0.44 }, // E4 (long)
    { f: 329.63, d: 0.22 }, // E4
    { f: 293.66, d: 0.44 }, // D4 (long)
    { f: 293.66, d: 0.44 }, // D4 (long)
  ];
  let when = t;
  for (const n of melody) {
    note(c, n.f, when, n.d, 'triangle', 0.12);
    note(c, n.f, when, n.d, 'sine', 0.06);
    when += n.d;
  }
}

/** Symphony No. 5 — Beethoven's famous opening motif: G-G-G-Eb (fate knocking).
 *  A brassy, ominous statement — layered sawtooths with a slight crescendo. */
function playSymphony5(): void {
  const c = audio();
  const t = c.currentTime;

  // G4 = 392Hz, Eb4 = 311Hz. Rhythm: three short, one long.
  const gFreq = 392.0;
  const ebFreq = 311.13;
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
      const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
      dispose(osc, remaining);
      dispose(filt, remaining);
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
    const remaining = Math.max(0, start + dur + 0.1 - c.currentTime);
    dispose(tri, remaining);
    dispose(triG, remaining);
    dispose(gNode, remaining);
  }

  // three short Gs
  let when = t;
  for (let i = 0; i < 3; i++) {
    brass(gFreq, when, noteLen, 0.18);
    when += noteLen + gap;
  }
  // one long Eb (the "fate" note)
  brass(ebFreq, when, longLen, 0.22);
}

/** Rocket launch — a low rumble that rises in pitch as the rocket lifts off
 *  and fades into the distance. */
function playRocket(): void {
  const c = audio();
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 1.7); // rising roar
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(2200, t + 1.7); // brightens too
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.1);
  osc.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + 2.15);
  dispose(osc, 2.2);
  dispose(filter, 2.2);
  dispose(g, 2.2);
}

/** Play a sound by id. Safe to call before audio is ready — lazily
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
      case 'rocket':
        playRocket();
        break;
    }
  } catch {
    // audio unavailable (no gesture yet, or no device) — silently ignore
  }
}

export type { SoundId };
