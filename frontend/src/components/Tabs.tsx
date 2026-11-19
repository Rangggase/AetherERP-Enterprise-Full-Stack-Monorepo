import { useEffect, useId, useRef, type ReactNode } from "react";
import { Glyph, type GlyphName } from "./glyphs";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Folder tabs (C4): the active tab joins its panel, the others sit lower on a darker paper.
 * Changing tab shifts the panel 8 px toward the new tab with a 220 ms crossfade. Arrow keys, Home and End move.
 */
export function FolderTabs<K extends string>({ tabs, active, onChange, label, children, className = "mt-8" }: {
  tabs: { key: K; label: string; glyph?: GlyphName }[]; active: K; onChange: (k: K) => void; label: string; children: ReactNode; className?: string;
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
    // Keyboard changes get a short crossfade only: someone moving with arrows should never wait on motion.
    const quiet = reduced() || byKey.current;
    byKey.current = false;
    panel.current?.animate(quiet ? [{ opacity: 0.4 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateX(${8 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: quiet ? 120 : 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
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
          </button>
        ))}
      </div>
      <div ref={panel} role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t-${active}`} tabIndex={0} className="tab-panel">{children}</div>
    </div>
  );
}
