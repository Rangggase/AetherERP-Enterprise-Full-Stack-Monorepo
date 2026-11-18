import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/Layers";
import { toast } from "../components/Toaster";
import { api } from "./api";
import { useSession } from "./session";

export type Row = Record<string, any>;

export interface Step { from: string; action: string; next: string; label: string; perm: string; danger?: boolean; consequence?: string }

/** Status transition with an optimistic cache patch; rolls back and explains on failure. */
export function useTransition(listKeys: string[], base: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string; step: Step }) =>
      api(`${base}/${id}/${action}`, { method: "POST", body: action === "deliver" || action === "invoice" ? {} : undefined }),
    onMutate: async (v) => {
      for (const k of listKeys) await qc.cancelQueries({ queryKey: [k] });
      const snap = listKeys.flatMap((k) => qc.getQueriesData<Row[] | Row>({ queryKey: [k] }));
      for (const k of listKeys) {
        qc.setQueriesData<Row[] | Row>({ queryKey: [k] }, (d) => {
          if (Array.isArray(d)) return d.map((r) => (r.id === v.id ? { ...r, status: v.step.next } : r));
          if (d && typeof d === "object" && (d as Row).id === v.id) return { ...d, status: v.step.next };
          return d;
        });
      }
      return { snap };
    },
    onError: (err, _v, ctx) => {
      ctx?.snap.forEach(([k, d]) => qc.setQueryData(k, d));
      toast(err instanceof Error ? err.message : "Tindakan gagal. Coba lagi.", "error");
    },
    onSuccess: (_d, v) => toast(`${v.step.label}: berhasil.`),
    onSettled: () => {
      for (const k of [...listKeys, "overview", "stock", "invoices", "journals", "invoice", "so", "po"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** Actions available for a row's current status and the user's permissions. Unavailable actions are not shown. */
export function RowActions({ row, steps, run, extra, size = "sm" }: { row: Row; steps: Step[]; run: ReturnType<typeof useTransition>; extra?: React.ReactNode; size?: "sm" | "md" }) {
  const { can } = useSession();
  const [confirm, setConfirm] = useState<Step | null>(null);
  const avail = steps.filter((s) => s.from === row.status && can(s.perm));
  const cls = size === "sm" ? "btn btn-sm" : "btn";
  return (
    <>
      {avail.map((s) => (
        <button key={s.action} className={s.danger ? `${cls} btn-danger` : `${cls}`} disabled={run.isPending} onClick={() => (s.danger ? setConfirm(s) : run.mutate({ id: row.id, action: s.action, step: s }))}>
          {s.label}
        </button>
      ))}
      {extra}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={`${confirm?.label} ${row.so_no ?? row.po_no ?? row.invoice_no ?? ""}?`}
        confirmLabel={`Ya, ${confirm?.label.toLowerCase()}`}
        danger
        pending={run.isPending}
        onConfirm={() => { if (confirm) run.mutate({ id: row.id, action: confirm.action, step: confirm }, { onSettled: () => setConfirm(null) }); }}
      >
        <p>{confirm?.consequence}</p>
      </ConfirmDialog>
    </>
  );
}

export const SO_STEPS: Step[] = [
  { from: "QUOTATION", action: "confirm", next: "CONFIRMED_SO", label: "Konfirmasi", perm: "sales.write" },
  { from: "CONFIRMED_SO", action: "deliver", next: "DELIVERED", label: "Kirim", perm: "inventory.write" },
  { from: "DELIVERED", action: "invoice", next: "INVOICED", label: "Buat faktur", perm: "sales.write" },
  { from: "QUOTATION", action: "cancel", next: "CANCELLED", label: "Batalkan", perm: "sales.write", danger: true, consequence: "Penawaran dibatalkan dan tidak bisa diaktifkan lagi." },
  { from: "CONFIRMED_SO", action: "cancel", next: "CANCELLED", label: "Batalkan", perm: "sales.write", danger: true, consequence: "Pesanan dibatalkan dan stok yang dicadangkan dilepas kembali. Ini tidak bisa dibatalkan." },
];
export const PO_STEPS: Step[] = [
  { from: "DRAFT", action: "submit", next: "APPROVED", label: "Ajukan", perm: "procurement.write" },
  { from: "PENDING_APPROVAL", action: "approve", next: "APPROVED", label: "Setujui", perm: "procurement.approve" },
];

export const returnable = (status: string): boolean => status === "INVOICED" || status === "PARTIALLY_PAID";
export const ReturnLink = ({ id, size = "sm" }: { id: number; size?: "sm" | "md" }) => {
  const { can } = useSession();
  return can("sales.write") ? <Link className={size === "sm" ? "btn btn-sm" : "btn"} to={`/sales/orders/${id}/return`}>Retur</Link> : null;
};
