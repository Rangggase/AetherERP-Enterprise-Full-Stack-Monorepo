/**
 * Kontras WCAG 2.2 dari token warna. Nilai dibaca dari design/tokens.css saat dipakai, jadi tidak ada warna literal di sini.
 * pickInk(bg) memilih --paper atau --ink, mana yang kontrasnya lebih tinggi di atas latar (brief 5.1, skala umur).
 */
export type Rgb = [number, number, number];

export function tokenRgb(name: string, el: Element = document.documentElement): Rgb {
  const v = getComputedStyle(el).getPropertyValue(`--${name}`).trim();
  const parts = v.split(/[\s,/]+/).map(Number).filter((n) => !Number.isNaN(n));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: Rgb): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Token teks ("paper" atau "ink") untuk label di atas token latar. Minimal 4,5:1 pada skala umur (diuji contrast-check). */
export function pickInk(bgToken: string): "paper" | "ink" {
  const bg = tokenRgb(bgToken);
  return contrast(tokenRgb("paper"), bg) >= contrast(tokenRgb("ink"), bg) ? "paper" : "ink";
}
