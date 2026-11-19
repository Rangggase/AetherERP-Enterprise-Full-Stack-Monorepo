import clsx from "clsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Glyph, type GlyphName } from "./glyphs";

export interface MenuItem { label: string; glyph?: GlyphName; checked?: boolean; onSelect: () => void }

/** A button that opens a level 3 menu (C8). Arrow keys move, Escape returns focus, a click outside closes. */
export function Menu({ button, label, items, className, align = "right" }: { button: ReactNode; label: string; items: MenuItem[]; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const radio = items.some((i) => i.checked !== undefined);

  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]') ?? wrap.current?.querySelector<HTMLElement>('[role^="menuitem"]');
    first?.focus();
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    const its = [...(wrap.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const i = its.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); its[(i + 1) % its.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); its[(i - 1 + its.length) % its.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); its[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); its[its.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  }

  return (
    <span ref={wrap} className="relative inline-flex">
      <button ref={btn} type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      {open && (
        <div id={id} role="menu" aria-label={label} className={clsx("menu pop-in top-[calc(100%+6px)]", align === "right" ? "right-0" : "left-0")} onKeyDown={onKey}>
          {items.map((it) => (
            <button key={it.label} type="button" role={radio ? "menuitemradio" : "menuitem"} aria-checked={radio ? !!it.checked : undefined} tabIndex={-1}
              onClick={() => { it.onSelect(); close(); }}>
              {it.glyph && <Glyph name={it.glyph} size={18} />}
              <span className="flex-1">{it.label}</span>
              {radio && it.checked && <Glyph name="simpan" size={16} />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
