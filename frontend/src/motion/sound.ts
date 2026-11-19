import { FEATURES } from "../config/features";
import { getPrefs, motionLevel } from "../lib/preferences";

/**
 * O3 Suara dan getar (bawaan mati, Akun saya → Preferensi tampilan). Bunyi disintesis Web Audio, tanpa berkas audio,
 * volume rendah. Hanya dipanggil sesudah aksi pengguna (posting, tutup buku), tidak pernah saat halaman dimuat.
 */
type Cue = "cap" | "struk" | "tutup-buku";
let ctx: AudioContext | null = null;

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "triangle") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, at: number, dur: number, gain: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  f.type = "lowpass";
  f.frequency.value = 900;
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

export function chime(cue: Cue): void {
  if (!FEATURES.sound || !getPrefs().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + 0.01;
    if (cue === "cap") {
      noise(ctx, t, 0.06, 0.18);
      tone(ctx, t, 110, 0.12, 0.08, "sine");
      if (motionLevel() !== "minimal") navigator.vibrate?.(10);
    } else if (cue === "struk") {
      for (let i = 0; i < 4; i++) noise(ctx, t + i * 0.035, 0.025, 0.05);
    } else {
      tone(ctx, t, 196, 0.25, 0.05, "sine");
      noise(ctx, t + 0.18, 0.08, 0.14);
    }
  } catch {
    /* audio tidak tersedia */
  }
}
