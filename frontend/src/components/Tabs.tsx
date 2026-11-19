import { useEffect, useId, useRef, type ReactNode } from "react";
import { play } from "../motion/animate";
import { Glyph, type GlyphName } from "./glyphs";
import "../styles/tabs.css";

/**
 * Tab map berkas (8): tab aktif menyatu dengan panelnya, yang lain sedikit lebih rendah. Jumlah tampil di tab ("Jurnal 4").
 * Berganti tab menggeser panel 8 px ke arah tab baru dengan crossfade --dur-base; dengan papan ketik hanya crossfade singkat.
 */
export function FolderTabs<K extends string>({ tabs, active, onChange, label, children, className = "mt-8" }: {
  tabs: { key: K; label: string; glyph?: GlyphName; count?: number }[]; active: K; onChange: (k: K) => void; label: string; children: ReactNode; className?: string;
}) {
  const id = useId();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const prev = useRef(active);
  const byKey = useRef(false);
  const keys = tabs.map((t) => t.key);

  useEffect(() => {
    if (prev.current === active) return;
    const dir = keys.indexOf(active) > keys.indexOf(prev.current) ? 1 : -1;
    prev.current = active;
    const quick = byKey.current;
    byKey.current = false;
    play(panel.current, quick ? [{ opacity: 0.4 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateX(${8 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: quick ? "dur-fade" : "dur-base" });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => { byKey.current = true; const k = keys[(i + keys.length) % keys.length]!; onChange(k); btns.current[(i + keys.length) % keys.length]?.focus(); };
  function onKey(e: React.KeyboardEvent) {
    const i = keys.indexOf(active);
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(keys.length - 1); }
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="tabs print:hidden" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button key={t.key} ref={(el) => { btns.current[i] = el; }} type="button" role="tab" id={`${id}-t-${t.key}`} aria-controls={`${id}-p`} aria-selected={active === t.key} tabIndex={active === t.key ? 0 : -1} className="tab" onClick={() => onChange(t.key)}>
            {t.glyph && <Glyph name={t.glyph} size={16} />}{t.label}
            {t.count !== undefined && <span className="count" aria-label={`${t.count} item`}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div ref={panel} role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t-${active}`} tabIndex={0} className="tab-panel">{children}</div>
    </div>
  );
}
