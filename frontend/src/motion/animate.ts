import { ease, motionLevel, ms, type DurToken, type EaseToken } from "./tokens";

/**
 * Pembungkus Web Animations API yang mematuhi tingkat gerak (brief 6.4, 6.5):
 * - Penuh: keyframes apa adanya.
 * - Dikurangi: hanya opasitas (fade --dur-fade), atau tidak ada bila `reduced` = null.
 * - Minimal: tidak ada animasi.
 * Keadaan akhir selalu ditulis ke elemen oleh pemanggil (tanpa fill "forwards"), jadi setelah selesai
 * animasi tidak lagi tercatat di document.getAnimations().
 */
export interface PlayOptions {
  duration: DurToken | number;
  easing?: EaseToken | string;
  delay?: number;
  fill?: FillMode;
  /** Keyframes untuk mode Dikurangi. Bawaan: fade masuk. null: tidak dianimasikan. */
  reduced?: Keyframe[] | null;
  composite?: CompositeOperation;
}

const resolveEase = (e?: EaseToken | string) => (!e ? ease("out") : e === "out" || e === "in" || e === "inout" || e === "spring" ? ease(e) : e);

export function play(el: Element | null | undefined, frames: Keyframe[], o: PlayOptions): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== "function") return null;
  const level = motionLevel();
  if (level === "minimal") return null;
  const d = typeof o.duration === "number" ? o.duration : ms(o.duration);
  if (level === "reduced") {
    if (o.reduced === null) return null;
    return el.animate(o.reduced ?? [{ opacity: 0 }, { opacity: 1 }], { duration: ms("dur-fade"), easing: ease("out"), delay: 0, fill: o.fill === "both" || o.fill === "backwards" ? "backwards" : "none" });
  }
  if (d <= 0) return null;
  return el.animate(frames, { duration: d, easing: resolveEase(o.easing), delay: o.delay ?? 0, fill: o.fill ?? "none", composite: o.composite });
}

/**
 * Menggambar garis SVG dengan stroke-dashoffset. Elemen harus memakai pathLength="1".
 * Keadaan akhir (tergambar penuh) adalah gaya statis elemen; animasi hanya mengisi selama berjalan.
 */
export function drawStroke(path: SVGGeometryElement | null, o: { duration: DurToken | number; delay?: number; easing?: EaseToken | string }): Animation | null {
  if (!path) return null;
  path.style.strokeDasharray = "1 1";
  path.style.strokeDashoffset = "0";
  return play(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: o.duration, delay: o.delay, easing: o.easing ?? "inout", fill: "backwards", reduced: null });
}

/** Menghentikan sekumpulan animasi dan langsung menampilkan keadaan akhir (brief 6.3: interaksi baru membatalkan). */
export function finishAll(list: (Animation | null | undefined)[]): void {
  for (const a of list) {
    try {
      a?.finish();
    } catch {
      a?.cancel();
    }
  }
}

export function cancelAll(list: (Animation | null | undefined)[]): void {
  for (const a of list) a?.cancel();
}

/** Selesai bila semua animasi selesai atau dibatalkan. */
export function settled(list: (Animation | null | undefined)[]): Promise<void> {
  return Promise.all(list.filter(Boolean).map((a) => a!.finished.catch(() => undefined))).then(() => undefined);
}
