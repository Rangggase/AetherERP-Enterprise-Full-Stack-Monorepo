/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // docs/design-system.md v3: 4px radius; depth comes from the --elev-* tokens.
    borderRadius: { none: "0", DEFAULT: "4px", sm: "4px", md: "4px", lg: "4px", xl: "4px", full: "9999px" },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      table: ["0.8125rem", { lineHeight: "1.25rem" }],
      sm: ["0.875rem", { lineHeight: "1.375rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.375rem", { lineHeight: "1.75rem" }],
      xl: ["1.875rem", { lineHeight: "2.25rem" }],
      "2xl": ["1.875rem", { lineHeight: "2.25rem" }],
      figure: ["3.5rem", { lineHeight: "3.75rem" }],
    },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        num: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        sunken: token("sunken"),
        highlight: token("highlight"),
        "accent-deep": token("accent-deep"),
        "key-edge": token("key-edge"),
        line: token("line"),
        control: token("control"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("accent"),
        "brand-hover": token("accent-hover"),
        "brand-ink": token("surface"),
        good: token("good"),
        warn: token("warn-ink"),
        "warn-mark": token("warn"),
        bad: token("bad"),
        info: token("info"),
      },
      boxShadow: { "elev-1": "var(--elev-1)", "elev-2": "var(--elev-2)", "elev-3": "var(--elev-3)", inset: "var(--inset)" },
      transitionDuration: { press: "90ms", fast: "140ms", base: "140ms", mid: "220ms", slow: "360ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0.8, 0.2, 1)", in: "cubic-bezier(0.4, 0, 1, 1)", spring: "cubic-bezier(0.3, 1.35, 0.5, 1)" },
    },
  },
  plugins: [],
};
