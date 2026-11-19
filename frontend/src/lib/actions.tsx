import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/Layers";
import { receipt, toast, type ReceiptData } from "../components/Toaster";
import { statusText } from "../components/ui";
import { api } from "./api";
import { date, qty, rupiah } from "./format";
import { useSession } from "./session";

export type Row = Record<string, any>;

export interface Step { from: string; action: string; next: string; label: string; perm: string; danger?: boolean; consequence?: string }

/**
 * Struk Upacara Posting (M2) dari respons API sebuah aksi status. Isi struk hanya dari data yang dikembalikan API;
 * perubahan stok hanya tampil bila respons memuat item dan jumlahnya.
 */
export function receiptFor(step: Step, res: Row, skuOf?: (productId: number) => string | undefined): ReceiptData {
  const no = res.so_no ?? res.po_no ?? res.transfer_no ?? res.wo_no ?? res.do_no ?? res.invoice_no;
  switch (step.action) {
    case "confirm": return { title: "Pesanan dikonfirmasi", number: no, lines: [{ label: "Total", value: rupiah(res.total_amount) }, { label: "Status", value: statusText(res.status) }] };
    case "deliver": return { title: "Barang dikirim", number: res.do_no, lines: [{ label: "HPP (FIFO)", value: rupiah(res.cogs_total, true) }], journalId: res.journal_entry_id };
    case "invoice": return { title: "Faktur dibuat", number: res.invoice_no, lines: [{ label: "Total", value: rupiah(res.total_amount) }, { label: "Jatuh tempo", value: date(res.due_date) }], link: { to: `/accounting/invoices/${res.id}`, label: "Buka faktur" } };
    case "cancel": return { title: "Pesanan dibatalkan", number: no, lines: [{ label: "Status", value: statusText(res.status) }] };
    case "submit": return { title: res.status === "PENDING_APPROVAL" ? "Pesanan diajukan, menunggu persetujuan" : "Pesanan diajukan", number: no, lines: [{ label: "Total", value: rupiah(res.total_amount) }, { label: "Status", value: statusText(res.status) }] };
    case "approve": return { title: "Pesanan disetujui", number: no, lines: [{ label: "Total", value: rupiah(res.total_amount) }] };
    case "dispatch":
    case "receive": return {
      title: step.action === "dispatch" ? "Transfer dikirim" : "Transfer diterima", number: no, lines: [{ label: "Status", value: statusText(res.status) }],
      stock: (res.items ?? []).map((i: Row) => ({ sku: skuOf?.(i.product_id) ?? `Produk #${i.product_id}`, change: `${step.action === "dispatch" ? "−" : "+"}${qty(i.quantity)}` })),
      note: step.action === "dispatch" ? "Stok keluar dari gudang asal." : "Stok masuk ke gudang tujuan dengan biaya asalnya.",
    };
    case "complete": return {
      title: "Perakitan selesai", number: no, lines: [{ label: "Biaya total", value: rupiah(res.total_cost) }, { label: "Biaya satuan", value: rupiah(res.unit_cost, true) }],
      stock: res.sku ? [{ sku: res.sku, change: `+${qty(res.quantity)}` }] : undefined,
    };
    default: return { title: `${step.label}: berhasil`, number: no };
  }
}

/** Transisi status dengan tambalan cache optimistis; dibatalkan dan dijelaskan bila gagal; struk M2 bila berhasil. */
export function useTransition(listKeys: string[], base: string, skuOf?: (productId: number) => string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string; step: Step }) =>
      api<Row>(`${base}/${id}/${action}`, { method: "POST", body: action === "deliver" || action === "invoice" ? {} : undefined }),
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
    onSuccess: (res, v) => receipt(receiptFor(v.step, res ?? {}, skuOf)),
    onSettled: () => {
      for (const k of [...listKeys, "overview", "stock", "invoices", "journals", "invoice", "so", "po", "dash", "transfers", "wo", "palette"]) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** Aksi yang tersedia untuk status baris dan izin pengguna. Aksi yang tidak tersedia tidak ditampilkan. */
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
        impact={row.total_amount !== undefined ? [["Total dokumen", rupiah(row.total_amount)], ["Status sekarang", statusText(row.status)]] : undefined}
        onConfirm={() => { if (confirm) run.mutate({ id: row.id, action: confirm.action, step: confirm }, { onSettled: () => setConfirm(null) }); }}
      >
        <p>{confirm?.consequence}</p>
      </ConfirmDialog>
    </>
  );
}

export const SO_STEPS: Step[] = [
  { from: "QUOTATION", action: "confirm", next: "CONFIRMED_SO", label: "Konfirmasi pesanan", perm: "sales.write" },
  { from: "CONFIRMED_SO", action: "deliver", next: "DELIVERED", label: "Kirim barang", perm: "inventory.write" },
  { from: "DELIVERED", action: "invoice", next: "INVOICED", label: "Buat faktur", perm: "sales.write" },
  { from: "QUOTATION", action: "cancel", next: "CANCELLED", label: "Batalkan penawaran", perm: "sales.write", danger: true, consequence: "Penawaran dibatalkan dan tidak bisa diaktifkan lagi." },
  { from: "CONFIRMED_SO", action: "cancel", next: "CANCELLED", label: "Batalkan pesanan", perm: "sales.write", danger: true, consequence: "Pesanan dibatalkan dan stok yang dicadangkan dilepas kembali. Ini tidak bisa dibatalkan." },
];
export const PO_STEPS: Step[] = [
  { from: "DRAFT", action: "submit", next: "APPROVED", label: "Ajukan pesanan", perm: "procurement.write" },
  { from: "PENDING_APPROVAL", action: "approve", next: "APPROVED", label: "Setujui pesanan", perm: "procurement.approve" },
];

export const returnable = (status: string): boolean => status === "INVOICED" || status === "PARTIALLY_PAID";
export const ReturnLink = ({ id, size = "sm" }: { id: number; size?: "sm" | "md" }) => {
  const { can } = useSession();
  return can("sales.write") ? <Link className={size === "sm" ? "btn btn-sm" : "btn"} to={`/sales/orders/${id}/return`}>Buat retur</Link> : null;
};

/** Pembayaran penuh faktur (aksi yang sudah ada) dengan struk M2 dari respons API. */
export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: Row) => api<Row>(`/invoices/${r.id}/payments`, { method: "POST", body: { amount: r.outstanding } }),
    onSuccess: (res) => {
      receipt({
        title: "Pembayaran dicatat", number: res.payment_no, journalId: res.journal_entry_id,
        lines: [{ label: "Faktur", value: res.invoice?.invoice_no ?? "" }, { label: "Total dibayar", value: rupiah(res.invoice?.paid_amount, true) }, { label: "Sisa tagihan", value: rupiah(res.invoice?.outstanding, true) }, { label: "Status faktur", value: statusText(res.invoice?.status ?? "") }],
      });
      for (const k of ["so", "sos", "invoices", "invoice", "overview", "journals", "dash", "palette"]) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Pembayaran gagal. Coba lagi.", "error"),
  });
}
