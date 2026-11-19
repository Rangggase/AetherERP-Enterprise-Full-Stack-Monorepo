import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ms } from "../motion/tokens";

/**
 * Tooltip (8): slip kertas kecil --elev-2. Muncul setelah --delay-tooltip saat hover dan langsung saat fokus,
 * ditutup dengan Escape. Isinya juga dibacakan lewat aria-describedby. Tidak dipakai untuk informasi yang hanya ada di sini:
 * di ponsel tidak ada hover, jadi teks penting harus juga tampil di halaman.
 */
export function Tip({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const below = r.top < 64;
      setPos({ x: Math.min(Math.max(8, r.left + r.width / 2), window.innerWidth - 8), y: below ? r.bottom + 8 : r.top - 8, below });
    }, delay);
  };
  const hide = () => { window.clearTimeout(timer.current); setPos(null); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", hide, { capture: true }); };
  }, [pos]);

  return (
    <span ref={wrap} className={className ?? "inline-flex"} aria-describedby={id}
      onMouseEnter={() => show(ms("delay-tooltip"))} onMouseLeave={hide} onFocus={() => show(0)} onBlur={hide}>
      {children}
      <span id={id} hidden>{label}</span>
      {pos && createPortal(
        <span role="tooltip" className="tip fade-in" style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.below ? "0" : "-100%"})` }}>{label}</span>,
        document.body,
      )}
    </span>
  );
}
