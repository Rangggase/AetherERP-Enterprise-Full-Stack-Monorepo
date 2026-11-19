import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { play } from "../motion/animate";
import { exitMs } from "../motion/tokens";
import { transitionTo } from "../motion/viewTransition";
import { Glyph } from "./glyphs";
import { Key } from "./Key";

/**
 * <dialog> bawaan sebagai lapisan: fokus terkunci, latar inert, Escape menutup lapisan teratas, fokus kembali ke pemicu.
 * Menutup memutar keluar singkat (sekitar 70% durasi masuk) sebelum dialog hilang.
 */
function useModal(open: boolean, onClose: () => void, exit: Keyframe[]) {
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
      const done = () => { d.close(); setShown(false); (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true }); };
      const a = play(d, exit, { duration: exitMs("dur-base"), easing: "in", reduced: [{ opacity: 1 }, { opacity: 0 }] });
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
  // Dialog yang masih terbuka saat komponen dilepas (misalnya pindah halaman) ditutup tanpa animasi.
  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);
  return { ref, shown: open || shown };
}

/**
 * Laci pratinjau (8): lembar --elev-3 dari kanan, lembar bawah dengan pegangan di ponsel.
 * Kepala memuat Rantai Dokumen mini (`chain`). "Buka lengkap" memakai Transisi Ruang (M4 pasangan c).
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, chain, full }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; chain?: ReactNode;
  full?: { to: string; room?: string; label?: string };
}) {
  const id = useId();
  const nav = useNavigate();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { ref, shown } = useModal(open, onClose, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }]);
  const openFull = () => {
    if (!full) return;
    const go = () => { ref.current?.close(); nav(full.to); };
    transitionTo(go, { source: titleRef.current, name: full.room });
  };
  return (
    <dialog ref={ref} aria-labelledby={`${id}-t`} onClick={(e) => { if (e.target === ref.current) onClose(); }} className="drawer">
      {shown && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="handle" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
            <div className="min-w-0">
              <h2 ref={titleRef} id={`${id}-t`} className="font-serif text-lg font-medium">{title}</h2>
              {subtitle && <p className="text-table text-muted">{subtitle}</p>}
            </div>
            <button type="button" className="btn btn-text h-11 w-11 shrink-0 justify-center px-0 md:h-9 md:w-9" onClick={onClose} aria-label="Tutup pratinjau"><Glyph name="tutup" size={20} /></button>
          </div>
          {chain && <div className="border-b border-line px-6 py-3">{chain}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {(footer || full) && (
            <div className="flex flex-wrap gap-2 border-t border-line px-6 py-3">
              {full && <Key tone="primary" glyph="buka-lengkap" onClick={openFull}>{full.label ?? "Buka lengkap"}</Key>}
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * Konfirmasi aksi berisiko (8): menyatakan akibatnya. Dialog berbahaya menampilkan ringkasan dampak dengan angka (`impact`).
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Kembali", danger, pending, impact }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; pending?: boolean;
  impact?: [string, ReactNode][];
}) {
  const id = useId();
  const { ref, shown } = useModal(open, onClose, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.98)" }]);
  return (
    <dialog ref={ref} aria-labelledby={`${id}-t`} aria-describedby={`${id}-b`} className="dialog-sheet m-auto w-[min(500px,calc(100vw-2rem))]">
      {shown && (
        <>
          <div className="p-6 pb-5">
            <h2 id={`${id}-t`} className="mb-2 flex items-start gap-2 font-serif text-lg font-medium">{danger && <Glyph name="peringatan" size={22} className="mt-0.5 text-bad" />}{title}</h2>
            <div id={`${id}-b`} className="text-sm">
              {impact && impact.length > 0 && (
                <dl className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-y border-line py-3 text-table">
                  {impact.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>)}
                </dl>
              )}
              {children}
            </div>
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
