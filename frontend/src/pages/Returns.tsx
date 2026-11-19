import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup, Impact } from "../components/Form";
import { ConfirmDialog, Drawer } from "../components/Layers";
import { useCrumb } from "../components/Shell";
import { toast } from "../components/Toaster";
import { DetailSkeleton, ErrorNote, PageHeader, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import { date, num, qty, rupiah, today } from "../lib/format";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { Key, KeyLink } from "../components/Key";
import { Stepper } from "../components/Stepper";

type Row = Record<string, any>;
const meta = (m: string, right = false) => ({ m, ...(right ? { right: true } : {}) });

export function Returns() {
  const q = useQuery({ queryKey: ["returns"], queryFn: () => api<Row[]>("/sales/returns") });
  const [open, setOpen] = useState<Row | null>(null);
  const columns: ColumnDef<Row, any>[] = [
    { header: "Retur", accessorKey: "return_no", meta: meta("t") },
    { header: "Tanggal", accessorKey: "return_date", cell: (c) => date(c.getValue()), meta: meta("d") },
    { header: "Alasan", accessorKey: "reason", meta: meta("s") },
    { header: "Item", accessorKey: "items", enableColumnFilter: false, cell: (c) => c.getValue().map((i: Row) => `${i.sku} × ${qty(i.quantity)}`).join(", "), meta: meta("x") },
    { header: "Kredit", accessorKey: "total_amount", meta: meta("v", true), cell: (c) => rupiah(c.getValue()) },
    { header: "Biaya kembali ke stok", accessorKey: "cogs_reversed", meta: meta("x", true), cell: (c) => rupiah(c.getValue()) },
  ];
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_amount), 0);
  return (
    <>
      <PageHeader title="Retur penjualan" sub={q.data ? `${q.data.length} retur · kredit ${rupiah(total)}. Setiap retur mengkredit faktur dan mengembalikan stok dengan biaya saat barang keluar.` : "Memuat…"} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Row> selectable emptyArt="struk" label="Retur penjualan" data={q.data ?? []} columns={columns} loading={q.isLoading} onOpen={setOpen} selectedId={(r) => r.id === open?.id}
          empty="Belum ada retur. Catat retur dari pesanan yang sudah difaktur." />
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.return_no ?? ""} subtitle={open ? `Pesanan #${open.so_id} · ${date(open.return_date)}` : undefined}
        footer={open && <KeyLink tone="primary" glyph="buka-lengkap" to={`/sales/orders/${open.so_id}`}>Buka pesanan</KeyLink>}>
        {open && (<>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-table">
            <dt className="text-muted">Kredit ke pelanggan</dt><dd className="num">{rupiah(open.total_amount)}</dd>
            <dt className="text-muted">Biaya kembali ke stok</dt><dd className="num">{rupiah(open.cogs_reversed)}</dd>
            <dt className="text-muted">Alasan</dt><dd className="text-right">{open.reason || "–"}</dd>
          </dl>
          <div className="mt-6 border-t border-line pt-4"><SectionTitle>Item</SectionTitle></div>
          <table className="tbl dense"><tbody>{open.items.map((i: Row) => <tr key={i.product_id}><td>{i.sku}</td><td className="num">{qty(i.quantity)}</td><td className="num">{rupiah(i.unit_price)}</td></tr>)}</tbody></table>
        </>)}
      </Drawer>
    </>
  );
}

export function NewReturn() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { branches } = useSession();
  const so = useQuery({ queryKey: ["so", id], queryFn: () => api<Row>(`/sales/orders/${id}`) });
  const prior = useQuery({ queryKey: ["returns"], queryFn: () => api<Row[]>("/sales/returns") });
  const invoices = useQuery({ queryKey: ["invoices", { all: true }], queryFn: async () => (await api<Page<Row>>("/invoices", { params: { page_size: 200 } })).items });
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<Row | null>(null);
  useCrumb(so.data?.so_no);

  const returned = (pid: number) =>
    (prior.data ?? []).filter((r) => String(r.so_id) === id).reduce((s, r) => s + r.items.filter((i: Row) => i.product_id === pid).reduce((t: number, i: Row) => t + num(i.quantity), 0), 0);

  const save = useMutation({
    mutationFn: (items: { product_id: number; quantity: string }[]) => api<Row>("/sales/orders/" + id + "/return", { method: "POST", body: { return_date: when, reason: reason || null, items } }),
    onSuccess: (r) => { for (const k of ["returns", "sos", "so", "stock", "invoices", "invoice", "overview", "journals"]) void qc.invalidateQueries({ queryKey: [k] }); toast("Retur dicatat."); setConfirm(false); setDone(r); },
    onError: (e) => { setConfirm(false); setError(e instanceof Error ? e.message : "Retur tidak bisa dicatat. Coba lagi."); },
  });

  if (so.isError) return <ErrorNote error={so.error} retry={() => so.refetch()} />;
  const d = so.data;
  if (!d) return <DetailSkeleton />;

  if (done) {
    return (
      <>
        <PageHeader title="Retur dicatat" sub={`${done.return_no} untuk ${d.so_no}`} />
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
          <dt className="text-muted">Kredit ke pelanggan</dt><dd className="num">{rupiah(done.total_amount, true)}</dd>
          <dt className="text-muted">Biaya kembali ke stok</dt><dd className="num">{rupiah(done.cogs_reversed, true)}</dd>
          <dt className="text-muted">Item</dt><dd className="text-right">{done.items.map((i: Row) => `${i.sku} × ${qty(i.quantity)}`).join(", ")}</dd>
        </dl>
        <p className="mt-4 max-w-prose text-table text-muted">Faktur berkurang sebesar kredit, stok kembali dengan biaya saat keluar dari gudang, dan jurnalnya sudah diposting.</p>
        <div className="mt-6 flex gap-2"><KeyLink tone="primary" glyph="retur" to="/sales/returns">Lihat daftar retur</KeyLink><Link className="btn" to={`/sales/orders/${id}`}>Kembali ke pesanan</Link></div>
      </>
    );
  }

  const lines: Row[] = (d.items as Row[]).map((i) => ({ ...i, left: num(i.quantity) - returned(i.product_id) }));
  const picked = lines.filter((l) => num(amounts[l.product_id]) > 0);
  const credit = picked.reduce((s, l) => s + num(amounts[l.product_id]) * num(l.unit_price), 0);
  const tooMany = picked.some((l) => num(amounts[l.product_id]) > l.left);

  // The invoice is not linked in the API response: match the customer's open invoice whose total equals this order less earlier returns.
  const returnedValue = (prior.data ?? []).filter((r) => String(r.so_id) === id).reduce((s, r) => s + num(r.total_amount), 0);
  const candidates = (invoices.data ?? []).filter((i) => i.type === "AR" && i.customer_id === d.customer_id && i.status !== "PAID" && i.invoice_date >= d.order_date && Math.abs(num(i.total_amount) - (num(d.total_amount) - returnedValue)) < 0.005);
  const invoice = candidates.length === 1 ? candidates[0]! : null;
  const branch = branches.find((b) => b.id === d.branch_id)?.name ?? "gudang";

  return (
    <>
      <PageHeader title={`Retur dari ${d.so_no}`} sub={`${d.customer_name}${invoice ? ` · faktur ${invoice.invoice_no} · sisa tagihan ${rupiah(invoice.outstanding)}` : ""}. Hanya pesanan yang sudah difaktur yang bisa diretur, dan kredit tidak boleh melebihi sisa tagihan.`} />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); setConfirm(true); }}>
        {error && <p role="alert" className="mb-4 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title="Item yang diretur" hint="Hanya jumlah yang belum diretur yang bisa dipilih.">
          <ul className="border-t border-ink">
            {lines.map((l) => {
              const n = num(amounts[l.product_id]);
              const over = n > l.left;
              return (
                <li key={l.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-line py-3 md:grid-cols-[minmax(0,1fr)_72px_96px_184px_112px]">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <span className="font-medium">{l.sku}</span> · {l.name}
                    <div className="text-table text-muted">{rupiah(l.unit_price)} per unit</div>
                  </div>
                  <div className="text-table text-muted md:text-right">Terjual <span className="font-num text-ink">{qty(l.quantity)}</span></div>
                  <div className="text-table text-muted md:text-right">Bisa diretur <span className="font-num text-ink">{qty(l.left)}</span></div>
                  <span className="col-span-2 md:col-span-1"><Stepper label={`jumlah retur ${l.sku}`} name={`return-qty-${l.product_id}`} value={amounts[l.product_id] ?? ""} max={l.left} disabled={l.left <= 0} invalid={over} onChange={(v) => setAmounts({ ...amounts, [l.product_id]: v })} /></span>
                  <div className="num col-span-2 text-table md:col-span-1">{n > 0 ? rupiah(n * num(l.unit_price)) : "–"}</div>
                </li>
              );
            })}
          </ul>
          {tooMany && <p role="alert" className="mt-2 text-table text-bad">Ada jumlah yang melebihi sisa yang masih bisa diretur.</p>}
        </FormGroup>
        <FormGroup title="Alasan dan tanggal" hint="Alasan tercatat di riwayat retur.">
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Tanggal retur"><input className="field" name="return-date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Alasan"><input className="field" name="reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rusak, barang salah…" /></Field>
          </div>
        </FormGroup>
        <ActionBar summary={<>
          <Impact label="Kredit ke pelanggan" value={rupiah(credit, true)} />
          {invoice && <Impact label="Sisa tagihan setelah retur" value={rupiah(num(invoice.outstanding) - credit, true)} />}
          <Impact small label="Biaya stok kembali (FIFO)" value="dihitung sistem saat dicatat" />
        </>}>
          <Link className="btn btn-text" to="/sales/orders">Batal</Link>
          <Key type="submit" tone="primary" glyph="retur" m={save} disabled={picked.length === 0 || tooMany}>Catat retur</Key>
        </ActionBar>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Catat retur untuk ${d.so_no}?`} confirmLabel="Ya, catat retur" pending={save.isPending}
        onConfirm={() => save.mutate(picked.map((l) => ({ product_id: l.product_id, quantity: amounts[l.product_id]! })))}>
        <p className="text-muted">Setelah dicatat, ini tidak bisa diubah:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{invoice ? `Faktur ${invoice.invoice_no} berkurang ${rupiah(credit, true)}.` : `Faktur pesanan ini berkurang ${rupiah(credit, true)}.`}</li>
          <li>Barang berstok kembali ke {branch} dengan biaya saat keluar dari gudang. Jasa tidak memengaruhi stok.</li>
          <li>Jurnal diposting. Koreksi hanya lewat jurnal pembalik.</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
