import { useEffect, useRef, useState, type ReactNode } from "react";
import { Glyph } from "./glyphs";
import { Key } from "./Key";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const OUT = { duration: 140, easing: "cubic-bezier(0.4, 0, 1, 1)" };

/**
 * Native <dialog> as a level 3 layer: focus is trapped, Escape closes, focus returns to the opener.
 * Closing plays a short exit (opacity, plus a shift unless the user asked for less motion) before the dialog goes away.
 */
function useModal(open: boolean, onClose: () => void, exit: (r: boolean) => Keyframe[]) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      setShown(true);
      d.showModal();
    } else if (!open && d.open) {
      const done = () => { d.close(); setShown(false); (opener.current as HTMLElement | null)?.focus?.(); };
      const a = d.animate?.(exit(reduced()), OUT);
      if (a) a.onfinish = done; else done();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener("cancel", cancel);
    return () => d.removeEventListener("cancel", cancel);
  }, [onClose]);
  return { ref, shown: open || shown };
}

/** Preview drawer from the right (C8, 220 ms). Close and "Buka lengkap" live in it; the page does not change. */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { ref, shown } = useModal(open, onClose, (r) => (r ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }]));
  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="drawer-in m-0 ml-auto h-dvh max-h-none w-[min(420px,100vw)] max-w-none border-0 border-l border-line bg-surface p-0 shadow-elev-3"
    >
      {shown && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
            <div className="min-w-0">
              <h2 id="drawer-title" className="font-serif text-lg font-medium font-num">{title}</h2>
              {subtitle && <p className="text-table text-muted">{subtitle}</p>}
            </div>
            <button type="button" className="btn btn-text h-11 w-11 shrink-0 justify-center px-0 md:h-9 md:w-9" onClick={onClose} aria-label="Tutup pratinjau"><Glyph name="tutup" size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap gap-2 border-t border-line px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation for risky actions (C8): a level 3 sheet that states the consequence; danger uses the danger key. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Kembali", danger, pending }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; pending?: boolean;
}) {
  const { ref, shown } = useModal(open, onClose, (r) => (r ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.98)" }]));
  return (
    <dialog ref={ref} aria-labelledby="confirm-title" aria-describedby="confirm-body" className="dlg-in m-auto w-[min(480px,calc(100vw-2rem))] rounded border border-line bg-surface p-0 shadow-elev-3">
      {shown && (
        <>
          <div className="p-6 pb-5">
            <h2 id="confirm-title" className="mb-2 flex items-start gap-2 font-serif text-lg font-medium">{danger && <Glyph name="peringatan" size={22} className="mt-0.5 text-bad" />}{title}</h2>
            <div id="confirm-body" className="text-sm">{children}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3">
            <button type="button" className="btn" onClick={onClose} autoFocus>{cancelLabel}</button>
            <Key tone={danger ? "danger" : "primary"} glyph={danger ? "tutup" : "simpan"} onClick={onConfirm} pending={pending}>{confirmLabel}</Key>
          </div>
        </>
      )}
    </dialog>
  );
}
