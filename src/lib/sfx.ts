"use client";

/**
 * Game sounds, synthesised with Web Audio (no audio files to load).
 * Everything here is best-effort: if audio is blocked or unsupported, calls simply do nothing.
 */

export type Sfx =
  | "msg"
  | "send"
  | "join"
  | "answer"
  | "drop"
  | "vote"
  | "tick"
  | "tickLast"
  | "scan"
  | "stampAI"
  | "stampHuman"
  | "tie"
  | "win"
  | "lose";

const KEY = "botched-sound";
const EVENT = "botched-sound-change";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastMsg = 0;

function readMuted() {
  try {
    return localStorage.getItem(KEY) === "off";
  } catch {
    return false;
  }
}

export function isMuted() {
  return typeof window === "undefined" ? true : readMuted();
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(KEY, muted ? "off" : "on");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  if (!muted) play("send");
}

export function onMutedChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function audio() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx.state === "running" ? ctx : null;
  } catch {
    return null;
  }
}

/** Browsers only allow audio after a tap or key press, so wake the context on the first one. */
if (typeof window !== "undefined") {
  const wake = () => {
    audio();
    if (ctx?.state === "running") {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    }
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
}

function tone(a: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine", toFreq?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(a: AudioContext, at: number, dur: number, gain: number, cutoff: number) {
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master!);
  src.start(at);
}

const notes = (a: AudioContext, t: number, freqs: number[], step: number, dur: number, gain: number, type: OscillatorType) =>
  freqs.forEach((f, i) => tone(a, t + i * step, f, i === freqs.length - 1 ? dur * 2.2 : dur, gain, type));

/** Play a sound now, or `delay` seconds from now (to land on an animation). */
export function play(name: Sfx, delay = 0) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime + 0.01 + delay;
    switch (name) {
      case "msg": {
        const now = performance.now();
        if (now - lastMsg < 140) return; // a burst of messages is one blip, not a machine gun
        lastMsg = now;
        tone(a, t, 1320, 0.07, 0.07, "sine", 990);
        break;
      }
      case "send":
        tone(a, t, 1800, 0.025, 0.035, "square");
        tone(a, t, 880, 0.06, 0.05, "sine", 1100);
        break;
      case "join":
        tone(a, t, 660, 0.09, 0.07, "triangle", 990);
        break;
      case "answer":
        notes(a, t, [523, 784], 0.09, 0.14, 0.09, "triangle");
        break;
      case "drop":
        notes(a, t, [659, 880, 1175], 0.07, 0.12, 0.08, "triangle");
        break;
      case "vote":
        tone(a, t, 440, 0.1, 0.05, "square");
        tone(a, t + 0.16, 440, 0.1, 0.05, "square");
        tone(a, t + 0.32, 587, 0.18, 0.05, "square");
        break;
      case "tick":
        tone(a, t, 1000, 0.03, 0.05, "sine");
        break;
      case "tickLast":
        tone(a, t, 1500, 0.06, 0.07, "sine");
        break;
      case "scan":
        tone(a, t, 180, 0.95, 0.035, "sawtooth", 1400);
        break;
      case "stampAI":
      case "stampHuman":
        noise(a, t, 0.22, 0.35, 900);
        tone(a, t, 90, 0.45, 0.35, "sine", 45);
        if (name === "stampAI") notes(a, t + 0.05, [880, 1320], 0.06, 0.18, 0.06, "triangle");
        else tone(a, t + 0.05, 155, 0.5, 0.06, "sawtooth", 130);
        break;
      case "tie":
        tone(a, t, 330, 0.16, 0.05, "square");
        tone(a, t + 0.18, 247, 0.3, 0.05, "square");
        break;
      case "win":
        notes(a, t, [523, 659, 784, 1047], 0.09, 0.14, 0.09, "triangle");
        break;
      case "lose":
        notes(a, t, [392, 330, 262, 196], 0.16, 0.2, 0.09, "triangle");
        break;
    }
  } catch {}
}

/** A short vibration on phones; follows the same mute switch as sound. */
export function buzz(pattern: number | number[]) {
  if (isMuted()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
