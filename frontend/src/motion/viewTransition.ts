import { flushSync } from "react-dom";
import { FEATURES } from "../config/features";
import { motionLevel, ms } from "./tokens";

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
  const name = opts.name;
  const vt = (document as Doc).startViewTransition!(async () => {
    if (src) src.style.viewTransitionName = "";
    if (opts.wait) {
      go();
      await opts.wait();
    } else flushSync(go);
    // Halaman tujuan yang dimuat lewat React.lazy baru dirender sesudah microtask: tunggu elemen tujuan bernama
    // (paling lama --dur-room) agar snapshot baru memuatnya. Tanpa itu transisi tetap berjalan sebagai crossfade.
    await waitForRoom(name, ms("dur-room"));
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

function roomPresent(name: string): boolean {
  return [...document.querySelectorAll<HTMLElement>("[data-room-target]")].some((el) => el.style.viewTransitionName === name && el.getClientRects().length > 0);
}
function waitForRoom(name: string, limit: number): Promise<void> {
  if (roomPresent(name)) return Promise.resolve();
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => { if (roomPresent(name)) done(); });
    const t = window.setTimeout(done, limit);
    function done() { window.clearTimeout(t); mo.disconnect(); resolve(); }
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "data-room-target"] });
  });
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
