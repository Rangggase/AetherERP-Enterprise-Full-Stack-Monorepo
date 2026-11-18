import type { ReactNode } from "react";

/** A form section: small title and hint at the left, fields at the right; one column on mobile. */
export function FormGroup({ title, hint, children, first }: { title: string; hint?: string; children: ReactNode; first?: boolean }) {
  return (
    <section className={`grid gap-x-8 gap-y-3 py-6 md:grid-cols-[200px_minmax(0,1fr)] ${first ? "" : "border-t border-line"}`}>
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
      {error && <span role="alert" className="mt-1 block text-xs font-normal text-bad">{error}</span>}
    </label>
  );
}

/** Sticky action bar: computed impact on the left, actions on the right. */
export function ActionBar({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-ink bg-surface px-4 py-3 md:-mx-10 md:px-10 max-md:fixed max-md:inset-x-0 max-md:mx-0 max-md:mt-0 max-md:bg-surface">
      {summary && <div className="flex min-w-0 flex-1 flex-wrap gap-x-8 gap-y-2 text-table text-muted">{summary}</div>}
      <div className="flex items-center gap-2 max-md:w-full max-md:[&>*]:flex-1">{children}</div>
    </div>
  );
}

export function Impact({ label, value, small }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div>
      {label}
      <div className={small ? "text-sm font-normal text-ink" : "font-serif text-[20px] font-medium leading-6 text-ink font-num"}>{value}</div>
    </div>
  );
}
