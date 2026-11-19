import type { ReactNode } from "react";
import { Glyph } from "./glyphs";

/** Isian berlabel dengan validasi di tempat: pesan galat menjelaskan apa yang terjadi dan apa yang bisa dilakukan. */
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
