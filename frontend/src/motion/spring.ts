import { ease, springToken } from "./tokens";

/**
 * Pegas tanpa pustaka: simulasi x'' = -k(x - 1) - c x' (massa 1) diubah menjadi easing CSS linear().
 * Hasilnya dipakai Web Animations API. Browser tanpa dukungan linear() memakai --ease-spring.
 */
const memo = new Map<string, { easing: string; duration: number }>();

const supportsLinear = (): boolean =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("transition-timing-function", "linear(0, 1)");

export function springEasing(stiffness: number, damping: number, maxMs = 900): { easing: string; duration: number } {
  const key = `${stiffness}/${damping}/${maxMs}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const dt = 1 / 240;
  let x = 0, v = 0, t = 0;
  const xs: number[] = [0];
  // Simulasi sampai diam (selisih < 0,1%) atau batas waktu.
  while (t < maxMs / 1000) {
    const a = -stiffness * (x - 1) - damping * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    xs.push(x);
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) break;
  }
  const duration = Math.round(t * 1000);
  const n = 32;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const idx = Math.min(xs.length - 1, Math.round((i / n) * (xs.length - 1)));
    pts.push((i === n ? 1 : xs[idx]!).toFixed(4));
  }
  const out = supportsLinear() ? { easing: `linear(${pts.join(", ")})`, duration } : { easing: ease("spring"), duration: Math.min(duration, 360) };
  memo.set(key, out);
  return out;
}

export function spring(name: "spring-press" | "spring-drawer" | "spring-stamp", maxMs?: number) {
  const [k, c] = springToken(name);
  return springEasing(k, c, maxMs);
}
