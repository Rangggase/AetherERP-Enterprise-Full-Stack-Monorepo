import "../styles/forms.css";

/** Number input with physical − and + keys (C2). Arrow keys step; the keys disable at the limits. The value stays a string so typing is free. */
export function Stepper({ value, onChange, min = 0, max = Infinity, step = 1, name, label, disabled, invalid }: {
  value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number; name?: string; label: string; disabled?: boolean; invalid?: boolean;
}) {
  const n = Number(value) || 0;
  const set = (v: number) => onChange(String(Math.max(min, Math.min(max, Math.round(v * 1000) / 1000))));
  return (
    <span className="stepper">
      <button type="button" className="mini-key" aria-label={`Kurangi ${label}`} disabled={disabled || n <= min} onClick={() => set(n - step)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <input
        className={`field ${invalid ? "field-error" : ""}`}
        name={name}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); set(n + step); }
          if (e.key === "ArrowDown") { e.preventDefault(); set(n - step); }
        }}
      />
      <button type="button" className="mini-key" aria-label={`Tambah ${label}`} disabled={disabled || n >= max} onClick={() => set(n + step)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </span>
  );
}
