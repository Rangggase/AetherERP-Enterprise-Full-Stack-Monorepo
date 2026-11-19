import { useEffect, useRef, type ReactNode } from "react";
import { Glyph } from "./glyphs";

/** A form section (E): a sheet on a small stack of paper, title and hint at the left, fields at the right; one column on mobile. */
export function FormGroup({ title, hint, children }: { title: string; hint?: string; children: ReactNode; first?: boolean }) {
  return (
    <section className="sheet lift mb-6 grid gap-x-8 gap-y-3 px-5 py-5 md:grid-cols-[200px_minmax(0,1fr)] md:px-6">
      <span className="stack-back b1" aria-hidden="true" />
      <div>
        <h2 className="text-table font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-table text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-table font-medium ${className}`}>
      {label}
      <div className="mt-1 font-normal">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 flex items-start gap-1.5 text-xs font-normal text-bad"><Glyph name="peringatan" size={16} />{error}</span>}
    </label>
  );
}

/** Sticky summary bar (E): a receipt with a torn top edge; computed impact on the left, actions on the right. */
export function ActionBar({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="receipt sticky bottom-0 z-20 -mx-4 mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 px-4 pb-3 pt-5 md:-mx-10 md:px-10 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(60px+env(safe-area-inset-bottom))] max-md:mx-0 max-md:mt-0">
      {summary && <div className="flex min-w-0 flex-1 flex-wrap gap-x-8 gap-y-2 text-table text-muted">{summary}</div>}
      <div className="flex items-center gap-2 max-md:w-full max-md:[&>*]:flex-1">{children}</div>
    </div>
  );
}

/** A figure on the receipt. When it changes it crossfades with a 4 px shift; there is no count-up. */
export function Impact({ label, value, small }: { label: string; value: ReactNode; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = typeof value === "string" || typeof value === "number" ? String(value) : null;
  const prev = useRef(key);
  useEffect(() => {
    if (key === null || prev.current === key) return;
    prev.current = key;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.animate(still ? [{ opacity: 0.3 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 140, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, [key]);
  return (
    <div>
      {label}
      <div ref={ref} className={small ? "text-sm font-normal text-ink" : "font-serif text-[20px] font-medium leading-6 text-ink font-num"}>{value}</div>
    </div>
  );
}
