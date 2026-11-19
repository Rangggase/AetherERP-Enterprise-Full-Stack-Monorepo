import { useEffect, useRef, useState } from "react";
import { Glyph } from "./glyphs";

interface T { id: number; text: string; kind: "ok" | "error" }
let seq = 0;

export const toast = (text: string, kind: T["kind"] = "ok"): void => {
  window.dispatchEvent(new CustomEvent<T>("aether:toast", { detail: { id: ++seq, text, kind } }));
};

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** One receipt slip (C8): out from the top right, torn bottom edge, gone after 4 s (paused while hovered or focused), closable. */
function Slip({ t, onDone }: { t: T; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const close = () => {
    window.clearTimeout(timer.current);
    const a = ref.current?.animate(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(8px)" }], { duration: 140, easing: "cubic-bezier(0.4, 0, 1, 1)" });
    if (a) a.onfinish = () => onDone(t.id); else onDone(t.id);
  };
  const arm = (ms: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(close, ms); };
  useEffect(() => { arm(4000); return () => window.clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bad = t.kind === "error";
  return (
    <div ref={ref} className="slip slip-in pointer-events-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 pb-5 pl-3.5 pr-2 pt-3 text-sm"
      onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={() => arm(2000)} onFocus={() => window.clearTimeout(timer.current)} onBlur={() => arm(2000)}>
      <span className={bad ? "text-bad" : "text-good"}><Glyph name={bad ? "gagal" : "berhasil"} size={20} /></span>
      <p className="pt-px">{bad && <span className="font-medium text-bad">Gagal. </span>}{t.text}</p>
      <button type="button" className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-highlight hover:text-ink" onClick={close} aria-label="Tutup pemberitahuan"><Glyph name="tutup" size={16} /></button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => setItems((x) => [(e as CustomEvent<T>).detail, ...x].slice(0, 4));
    window.addEventListener("aether:toast", on);
    return () => window.removeEventListener("aether:toast", on);
  }, []);
  const done = (id: number) => setItems((x) => x.filter((i) => i.id !== id));
  return (
    <div className="pointer-events-none fixed right-3 top-[60px] z-[60] flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-2.5" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => <Slip key={t.id} t={t} onDone={done} />)}
    </div>
  );
}
