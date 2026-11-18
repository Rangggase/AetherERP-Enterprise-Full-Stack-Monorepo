import { useEffect, useRef, type ReactNode } from "react";

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener("cancel", cancel);
    return () => d.removeEventListener("cancel", cancel);
  }, [onClose]);
  return ref;
}

/** Preview drawer from the right. Native <dialog>: focus is trapped, Escape closes, focus returns to the row. */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useModal(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="drawer-in m-0 ml-auto h-dvh max-h-none w-[min(420px,100vw)] max-w-none border-0 border-l border-ink bg-surface p-0 backdrop:bg-ink/30"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
            <div className="min-w-0">
              <h2 id="drawer-title" className="font-serif text-lg font-medium">{title}</h2>
              {subtitle && <p className="text-table text-muted">{subtitle}</p>}
            </div>
            <button className="btn btn-text shrink-0" onClick={onClose}>Tutup</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="flex gap-2 border-t border-line px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation for risky actions: states the consequences in the user's terms. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Kembali", danger, pending }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; pending?: boolean;
}) {
  const ref = useModal(open, onClose);
  return (
    <dialog ref={ref} aria-labelledby="confirm-title" className="m-auto w-[min(480px,calc(100vw-2rem))] rounded border border-ink bg-surface p-6 backdrop:bg-ink/40">
      {open && (
        <>
          <h2 id="confirm-title" className="mb-2 font-serif text-lg font-medium">{title}</h2>
          <div className="text-sm">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={onClose} autoFocus>{cancelLabel}</button>
            <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={pending}>{pending ? "Memproses…" : confirmLabel}</button>
          </div>
        </>
      )}
    </dialog>
  );
}
