import clsx from "clsx";
import { useId, useState, type ReactNode } from "react";
import { rupiah } from "../lib/format";
import { MechanicalNumber } from "./signature/MechanicalNumber";
import "../styles/forms.css";

export { Field } from "./Field";

/** Bagian form (10): lembar bertumpuk dengan judul kecil di kiri, isian di kanan; satu kolom di ponsel. */
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

/**
 * Isian uang (8): awalan "Rp" statis, angka rata kanan, diformat saat blur. Nilai disimpan sebagai string desimal biasa
 * ("12500.5") agar API tetap menerima angka persis.
 */
export function MoneyInput({ value, onChange, name, label, required, invalid, min = 0 }: { value: string; onChange: (v: string) => void; name?: string; label?: string; required?: boolean; invalid?: boolean; min?: number }) {
  const [editing, setEditing] = useState(false);
  const n = Number(value);
  const shown = editing || value === "" || Number.isNaN(n) ? value : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
  return (
    <span className="money">
      <span aria-hidden="true">Rp</span>
      <input className={clsx("field", invalid && "field-error")} name={name} aria-label={label} inputMode="decimal" required={required} aria-invalid={invalid || undefined}
        value={shown} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
          if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) onChange(raw === "" ? "" : String(Math.max(min, Number(raw)) === Number(raw) ? raw : min));
        }} />
    </span>
  );
}

/** Bilah ringkasan menempel di bawah berbentuk struk (10): pratinjau angka di kiri, aksi di kanan. */
export function ActionBar({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="receipt sticky bottom-0 z-sticky -mx-4 mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 px-4 pb-3 pt-5 md:-mx-10 md:px-10 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(60px+env(safe-area-inset-bottom))] max-md:mx-0 max-md:mt-0">
      {summary && <div className="flex min-w-0 flex-1 flex-wrap gap-x-8 gap-y-2 text-table text-muted">{summary}</div>}
      <div className="flex items-center gap-2 max-md:w-full max-md:[&>*]:flex-1">{children}</div>
    </div>
  );
}

/** Angka di bilah ringkasan. Angka (number) memakai Angka Mekanis (M3); teks tampil apa adanya. */
export function Impact({ label, value, small, format = (v: number) => rupiah(v, true) }: { label: string; value: ReactNode | number; small?: boolean; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div>
      <span id={id}>{label}</span>
      <div aria-labelledby={id} className={small ? "text-sm font-normal text-ink" : "font-serif text-[20px] font-medium leading-6 text-ink font-num"}>
        {typeof value === "number" ? <MechanicalNumber value={value} format={format} srLabel={label} /> : value}
      </div>
    </div>
  );
}
