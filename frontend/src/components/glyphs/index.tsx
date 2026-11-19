import clsx from "clsx";
import { GLYPHS, type GlyphName } from "./paths";

export { GLYPHS, type GlyphName };

/** A line glyph from the AetherERP set. Always next to a word; hidden from assistive technology. */
export function Glyph({ name, size = 20, className }: { name: GlyphName; size?: number; className?: string }) {
  return (
    <svg
      className={clsx("glyph", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      // Static, trusted markup generated from the glyph catalogue.
      dangerouslySetInnerHTML={{ __html: GLYPHS[name].d }}
    />
  );
}

/** The tick a key shows on success; drawn with stroke-dashoffset. */
export function Tick({ size = 16 }: { size?: number }) {
  return (
    <svg className="glyph tick" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path pathLength={1} d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}
