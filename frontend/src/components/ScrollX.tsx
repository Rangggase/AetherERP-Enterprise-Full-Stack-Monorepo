import { useEffect, useRef, useState, type ReactNode } from "react";

/** Horizontal scroll container for wide report tables, with edge shadows and a hint while the content overflows. */
export function ScrollX({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {overflows && <p className="pb-1 text-xs text-muted md:hidden" role="note">Geser ke samping untuk kolom lain</p>}
      <div ref={ref} className={`scroll-x ${className}`} tabIndex={overflows ? 0 : undefined} role={overflows ? "region" : undefined} aria-label={overflows ? "Tabel, dapat digeser" : undefined}>
        {children}
      </div>
    </>
  );
}
