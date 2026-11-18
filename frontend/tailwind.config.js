/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // docs/design-system.md: a single 4px radius, no elevation.
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
        line: token("line"),
        control: token("control"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("accent"),
        "brand-hover": token("accent-hover"),
        "brand-ink": "rgb(255 255 255 / <alpha-value>)",
        good: token("good"),
        warn: token("warn-ink"),
        "warn-mark": token("warn"),
        bad: token("bad"),
        info: token("info"),
      },
      transitionDuration: { fast: "100ms", base: "120ms", slow: "200ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0, 0, 1)" },
    },
  },
  plugins: [],
};
