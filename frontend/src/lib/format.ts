const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const idr2 = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

/** API money arrives as exact decimal strings; convert only at the display edge. */
export const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
export const rupiah = (v: string | number | null | undefined, cents = false): string => (cents ? idr2 : idr).format(num(v));
export const compactRupiah = (v: string | number): string => `Rp${compact.format(num(v))}`;
export const qty = (v: string | number): string => plain.format(num(v));
export const pct = (v: number | null | undefined): string => (v === null || v === undefined ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

export const date = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "–";
export const dateTime = (v: string): string =>
  new Date(v + (v.endsWith("Z") ? "" : "Z")).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const monthLabel = (ym: string): string => new Date(`${ym}-01`).toLocaleDateString("id-ID", { month: "short" });
/** Local calendar date (not UTC), so late-evening users do not get yesterday. */
export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
