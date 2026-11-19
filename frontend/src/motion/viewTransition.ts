import { flushSync } from "react-dom";
import { FEATURES } from "../config/features";
import { motionLevel } from "./tokens";

/**
 * M4 Transisi Ruang dengan View Transition API bawaan browser (tanpa fitur React eksperimental).
 * `view-transition-name` hanya dipasang pada elemen sumber (sebelum snapshot lama) dan elemen tujuan
 * (saat halaman baru dirender), lalu dilepas setelah transisi selesai. Tanpa dukungan: crossfade --dur-fade
 * pada wadah rute (kelas .room-fallback).
 */
type Doc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void>; ready: Promise<void>; skipTransition: () => void } };

let pending: { name: string; dir: "forward" | "back" } | null = null;
let running: { skipTransition: () => void } | null = null;

export function supportsRoomTransition(): boolean {
  return FEATURES.roomTransition && typeof document !== "undefined" && typeof (document as Doc).startViewTransition === "function";
}

/** Nama unik per dokumen, aman untuk CSS. */
export const roomName = (kind: string, id: string | number): string => `room-${kind}-${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}`;

/** Dipanggil komponen tujuan saat render: nama yang menunggu untuk elemen ini, atau undefined. */
export function takeRoom(name: string): string | undefined {
  return pending?.name === name ? name : undefined;
}

export const roomDirection = (): "forward" | "back" => pending?.dir ?? "forward";

/** Wadah rute memutar crossfade bila transisi ruang tidak tersedia. */
let fallbackNext = false;
export const consumeFallback = (): boolean => {
  const v = fallbackNext;
  fallbackNext = false;
  return v;
};

/**
 * Navigasi dengan transisi ruang. `source` adalah elemen yang berubah bentuk (nomor dokumen di baris, kartu, lembar mini).
 * `go` melakukan navigasi secara sinkron (navigate(to)). Untuk kembali, `go` boleh asinkron: berikan `wait`.
 */
export function transitionTo(go: () => void, opts: { source?: Element | null; name?: string; dir?: "forward" | "back"; wait?: () => Promise<void> } = {}): void {
  running?.skipTransition();
  const level = motionLevel();
  if (!supportsRoomTransition() || level !== "full" || !opts.name) {
    fallbackNext = level !== "minimal";
    go();
    return;
  }
  const src = opts.source as HTMLElement | null | undefined;
  if (src) src.style.viewTransitionName = opts.name;
  pending = { name: opts.name, dir: opts.dir ?? "forward" };
  document.documentElement.dataset.room = pending.dir;
  const vt = (document as Doc).startViewTransition!(() => {
    if (src) src.style.viewTransitionName = "";
    if (opts.wait) {
      go();
      return opts.wait();
    }
    flushSync(go);
  });
  running = vt;
  const clear = () => {
    pending = null;
    running = null;
    delete document.documentElement.dataset.room;
    document.querySelectorAll<HTMLElement>("[data-room-target]").forEach((el) => { el.style.viewTransitionName = ""; });
  };
  vt.finished.then(clear, clear);
}

/** Menunggu rute baru selesai dirender (Shell mengirim aether:route-rendered), maksimal `limit` ms. */
export function routeRendered(limit = 400): Promise<void> {
  return new Promise((resolve) => {
    const t = window.setTimeout(done, limit);
    function done() {
      window.clearTimeout(t);
      window.removeEventListener("aether:route-rendered", done);
      resolve();
    }
    window.addEventListener("aether:route-rendered", done);
  });
}
