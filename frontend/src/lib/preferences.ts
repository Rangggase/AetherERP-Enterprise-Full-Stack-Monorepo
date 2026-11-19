import { useSyncExternalStore } from "react";

/**
 * Preferensi tampilan per perangkat (brief 8, "Preferensi tampilan"): Gerak, Kepadatan, Tekstur kertas,
 * dan dua momen opsional (Cahaya meja, Suara) yang bawaannya mati. Disimpan di localStorage dengan try/catch;
 * nilai yang rusak atau penyimpanan yang tidak tersedia jatuh ke nilai bawaan yang aman.
 */
export type MotionPref = "auto" | "full" | "reduced" | "minimal";
export type MotionLevel = "full" | "reduced" | "minimal";
export type Density = "comfortable" | "compact";

export interface Prefs {
  motion: MotionPref;
  density: Density;
  texture: boolean;
  deskLight: boolean;
  sound: boolean;
}

const KEY = "aether.prefs";
export const DEFAULT_PREFS: Prefs = { motion: "auto", density: "comfortable", texture: true, deskLight: false, sound: false };

const MOTION: MotionPref[] = ["auto", "full", "reduced", "minimal"];

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    // v2 menyimpan kepadatan tabel di kunci terpisah.
    const legacyDense = !raw && localStorage.getItem("aether.density") === "dense";
    return {
      motion: MOTION.includes(p.motion as MotionPref) ? (p.motion as MotionPref) : DEFAULT_PREFS.motion,
      density: p.density === "compact" || legacyDense ? "compact" : "comfortable",
      texture: typeof p.texture === "boolean" ? p.texture : DEFAULT_PREFS.texture,
      deskLight: typeof p.deskLight === "boolean" ? p.deskLight : DEFAULT_PREFS.deskLight,
      sound: typeof p.sound === "boolean" ? p.sound : DEFAULT_PREFS.sound,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let current: Prefs = typeof window === "undefined" ? { ...DEFAULT_PREFS } : read();
const subs = new Set<() => void>();
const osReduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const getPrefs = (): Prefs => current;

/** Tingkat gerak efektif: setelan pengguna, atau sistem operasi bila "Ikuti sistem". */
export function motionLevel(): MotionLevel {
  if (current.motion !== "auto") return current.motion;
  return osReduced() ? "reduced" : "full";
}

/** Bagian hari untuk Cahaya meja (O2). Siang memakai nada bawaan. */
export function deskPhase(d = new Date()): "pagi" | "siang" | "sore" | "malam" {
  const h = d.getHours();
  if (h >= 5 && h < 10) return "pagi";
  if (h >= 10 && h < 15) return "siang";
  if (h >= 15 && h < 19) return "sore";
  return "malam";
}

/** Menulis preferensi ke atribut <html> yang dibaca CSS (lihat juga skrip awal di index.html). */
export function applyPrefs(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.motion = motionLevel();
  el.dataset.density = current.density;
  el.dataset.texture = current.texture ? "on" : "off";
  const phase = current.deskLight ? deskPhase() : "siang";
  if (phase === "siang") delete el.dataset.desk;
  else el.dataset.desk = phase;
}

function notify() {
  applyPrefs();
  subs.forEach((f) => f());
}

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* penyimpanan tidak tersedia: berlaku sampai halaman dimuat ulang */
  }
  notify();
}

export function subscribePrefs(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

if (typeof window !== "undefined") {
  window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", notify);
  // Preferensi diubah di tab lain.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = read();
      notify();
    }
  });
  // Cahaya meja: periksa bagian hari tiap 10 menit (tanpa animasi; transisi warna 60 detik diatur CSS).
  window.setInterval(() => { if (current.deskLight) applyPrefs(); }, 600_000);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}

export function useMotionLevel(): MotionLevel {
  return useSyncExternalStore(subscribePrefs, motionLevel, motionLevel);
}
