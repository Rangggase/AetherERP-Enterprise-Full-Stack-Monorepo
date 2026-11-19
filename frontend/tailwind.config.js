/** @type {import('tailwindcss').Config} */
// Semua nilai merujuk token di src/design/tokens.css (docs/design-system.md v3). Skala z-index, durasi, dan easing
// diganti seluruhnya (bukan extend) agar komponen tidak bisa memakai nilai literal.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  // Rute Katalog hanya ada saat pengembangan; kelasnya tidak boleh menambah CSS produksi.
  content: ["./index.html", "./src/**/*.{ts,tsx}", ...(process.env.NODE_ENV === "production" ? ["!./src/pages/Katalog.tsx"] : [])],
  theme: {
    borderRadius: { none: "0", DEFAULT: "var(--radius-control)", sm: "var(--radius-control)", md: "var(--radius-control)", lg: "var(--radius-panel)", xl: "var(--radius-panel)", panel: "var(--radius-panel)", full: "9999px" },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],          // 12/16
      table: ["0.8125rem", { lineHeight: "1.25rem" }],  // 13/20
      sm: ["0.875rem", { lineHeight: "1.25rem" }],      // 14/20
      md: ["0.9375rem", { lineHeight: "1.5rem" }],      // 15/24
      base: ["1rem", { lineHeight: "1.5rem" }],         // 16/24 (isian ponsel)
      lg: ["1.125rem", { lineHeight: "1.5rem" }],       // 18/24
      h2: ["1.5rem", { lineHeight: "2rem" }],           // 24/32
      kpi: ["1.625rem", { lineHeight: "2rem" }],        // 26/32
      xl: ["1.875rem", { lineHeight: "2.25rem" }],      // 30/36 (h1)
      "2xl": ["1.875rem", { lineHeight: "2.25rem" }],
      display: ["2.5rem", { lineHeight: "2.75rem" }],   // 40/44 angka utama dasbor
    },
    zIndex: {
      base: "var(--z-base)", sticky: "var(--z-sticky)", rail: "var(--z-rail)", topbar: "var(--z-topbar)",
      drawer: "var(--z-drawer)", dialog: "var(--z-dialog)", palette: "var(--z-palette)", receipt: "var(--z-receipt)",
    },
    transitionDuration: { DEFAULT: "var(--dur-fast)", press: "var(--dur-press)", fast: "var(--dur-fast)", base: "var(--dur-base)", mid: "var(--dur-base)", slow: "var(--dur-slow)", draw: "var(--dur-draw)" },
    transitionTimingFunction: { DEFAULT: "var(--ease-out)", out: "var(--ease-out)", in: "var(--ease-in)", inout: "var(--ease-inout)", spring: "var(--ease-spring)" },
    transitionDelay: {},
    animation: { none: "none" },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        num: ["var(--font-sans)"],
      },
      colors: {
        canvas: token("canvas"),
        paper: token("paper"),
        ink: token("ink"),
        "ink-muted": token("ink-muted"),
        rule: token("rule"),
        "rule-strong": token("rule-strong"),
        accent: token("accent"),
        "accent-deep": token("accent-deep"),
        highlight: token("highlight"),
        ok: token("ok"),
        "warn-mark": token("warn"),
        "warn-ink": token("warn-ink"),
        bad: token("bad"),
        info: token("info"),
        pencil: token("pencil"),
        // Nama v2 yang masih dipakai komponen, dipetakan ke token v3.
        surface: token("paper"),
        sunken: token("highlight"),
        line: token("rule"),
        control: token("rule-strong"),
        muted: token("ink-muted"),
        brand: token("accent"),
        "brand-hover": token("accent-deep"),
        "brand-ink": token("paper"),
        good: token("ok"),
        warn: token("warn-ink"),
      },
      boxShadow: { "elev-1": "var(--elev-1)", "elev-2": "var(--elev-2)", "elev-3": "var(--elev-3)", inset: "var(--inset)" },
      maxWidth: { read: "1100px" },
    },
  },
  plugins: [],
};
