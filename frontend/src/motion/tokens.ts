import { motionLevel, subscribePrefs, type MotionLevel } from "../lib/preferences";

/**
 * Token gerak dibaca dari design/tokens.css saat dipakai, jadi komponen tidak menyimpan durasi literal dan
 * mode Dikurangi atau Minimal (yang menimpa token di CSS) langsung berlaku.
 */
export type DurToken =
  | "dur-press" | "dur-fast" | "dur-base" | "dur-slow" | "dur-draw" | "dur-fade" | "dur-roll" | "stagger-digit"
  | "debounce-number" | "dur-thread" | "gap-thread" | "dur-level" | "dur-print" | "receipt-life" | "dur-room"
  | "dur-room-phone" | "dur-open-book" | "dur-t-draw" | "dur-shake" | "dur-pulse" | "stagger" | "delay-tooltip" | "delay-loading"
  | "hold-success" | "hold-error" | "dur-loading" | "budget-ink" | "budget-ceremony";
export type EaseToken = "out" | "in" | "inout" | "spring";

const cache = new Map<string, string>();
subscribePrefs(() => cache.clear());

function raw(name: string): string {
  let v = cache.get(name);
  if (v === undefined) {
    v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    cache.set(name, v);
  }
  return v;
}

/** Durasi dalam milidetik. */
export function ms(name: DurToken): number {
  const v = raw(name);
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
}

export function ease(name: EaseToken): string {
  return raw(`ease-${name}`) || "ease-out";
}

/** Jarak atau sudut gerak, misalnya "lift-box" atau "page-tilt" (sudah 0 pada mode Dikurangi dan Minimal). */
export function cssVar(name: string): string {
  return raw(name);
}

/** Pasangan kekakuan dan redaman pegas, misalnya "spring-stamp" → [600, 26]. */
export function springToken(name: "spring-press" | "spring-drawer" | "spring-stamp"): [number, number] {
  const [k, c] = raw(name).split(/\s+/).map(Number);
  return [k || 400, c || 30];
}

/** Keluar lebih cepat dari masuk: sekitar 70% durasi masuk (brief 6.3). */
export const exitMs = (name: DurToken): number => Math.round(ms(name) * 0.7);

export { motionLevel, type MotionLevel };
