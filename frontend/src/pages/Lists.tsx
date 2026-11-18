import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { Drawer } from "../components/Layers";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader, SectionTitle, Status } from "../components/ui";
import { api } from "../lib/api";
import { PO_STEPS, ReturnLink, returnable, RowActions, SO_STEPS, useTransition, type Row, type Step } from "../lib/actions";
import { compactRupiah, date, dateTime, num, qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";

type M = "t" | "v" | "s" | "d" | "x" | "h";
const R = (m?: M) => ({ right: true, m });

function useList(key: string, path: string, params: Record<string, unknown> = {}, paged = true) {
  return useQuery({
    queryKey: [key, params],
    queryFn: async (): Promise<Row[]> => {
      const r = await api<Page<Row> | Row[]>(path, { params: paged ? { page_size: 200, ...params } : params });
      return Array.isArray(r) ? r : r.items;
    },
  });
}

const col = (header: string, accessorKey: string, extra: Partial<ColumnDef<Row, any>> & { m?: M } = {}): ColumnDef<Row, any> => {
  const { m, ...rest } = extra;
  return { header, accessorKey, ...rest, meta: { ...((rest.meta as object) ?? {}), ...(m ? { m } : {}) } } as ColumnDef<Row, any>;
};
const money = (header: string, key: string, m?: M) => col(header, key, { cell: (c) => rupiah(c.getValue()), meta: R(m), sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)) });
const status = (key = "status") => col("Status", key, { cell: (c) => <Status value={c.getValue()} />, m: "x" });
const actionCol = (render: (row: Row) => React.ReactNode): ColumnDef<Row, any> =>
  ({ id: "aksi", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <div className="flex justify-end gap-1.5">{render(c.row.original)}</div>, meta: { m: "x" } }) as ColumnDef<Row, any>;

function ListPage({ title, sub, q, columns, actions, label, onOpen, selectedId, empty, emptyAction, preview }: {
  title: string; sub?: string; q: ReturnType<typeof useList>; columns: ColumnDef<Row, any>[]; actions?: React.ReactNode; label: string;
  onOpen?: (r: Row) => void; selectedId?: (r: Row) => boolean; empty?: string; emptyAction?: React.ReactNode; preview?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} sub={sub} actions={actions} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> label={label} data={q.data ?? []} columns={columns} loading={q.isLoading} onOpen={onOpen} selectedId={selectedId} empty={empty} emptyAction={emptyAction} />}
      {preview}
    </>
  );
}

const Facts = ({ items }: { items: [string, React.ReactNode][] }) => (
  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-table">
    {items.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num">{v}</dd></div>))}
  </dl>
);

const Items = ({ rows }: { rows: Row[] }) => (
  <>
    <div className="mt-6 border-t border-line pt-4"><SectionTitle>Item</SectionTitle></div>
    <table className="tbl dense"><tbody>
      {rows.slice(0, 6).map((i) => (<tr key={i.id}><td>{i.sku} {i.name}</td><td className="num">{qty(i.quantity)}</td></tr>))}
    </tbody></table>
    {rows.length > 6 && <p className="mt-1 text-xs text-muted">dan {rows.length - 6} item lain di dokumen.</p>}
  </>
);

export function PurchaseOrders() {
  const { branchId, can } = useSession();
  const q = useList("pos", "/procurement/purchase-orders", { branch_id: branchId });
  const run = useTransition(["pos", "po"], "/procurement/purchase-orders");
  const [open, setOpen] = useState<Row | null>(null);
  const live = open ? (q.data ?? []).find((r) => r.id === open.id) ?? open : null;
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_amount), 0);
  const pending = (q.data ?? []).filter((r) => r.status === "PENDING_APPROVAL").length;
  const columns = [
    col("Nomor", "po_no", { m: "t" }), col("Pemasok", "supplier_name", { m: "s" }), col("Tanggal", "order_date", { cell: (c) => date(c.getValue()), m: "d" }),
    money("Total", "total_amount", "v"), status(),
  ];
  return (
    <ListPage title="Pesanan pembelian" label="Pesanan pembelian" q={q} columns={columns}
      sub={q.data ? `${q.data.length} pesanan · total ${compactRupiah(total)}${pending ? ` · ${pending} perlu persetujuan` : ""}` : "Memuat…"}
      actions={can("procurement.write") && <Link className="btn btn-primary" to="/procurement/orders/new">Buat pesanan</Link>}
      empty="Belum ada pesanan pembelian." emptyAction={can("procurement.write") ? <Link className="btn btn-sm" to="/procurement/orders/new">Buat pesanan pembelian</Link> : undefined}
      onOpen={setOpen} selectedId={(r) => r.id === open?.id}
      preview={
        <Drawer open={!!live} onClose={() => setOpen(null)} title={live?.po_no ?? ""} subtitle={live ? `${live.supplier_name}` : undefined}
          footer={live && <><Link className="btn btn-primary" to={`/procurement/orders/${live.id}`}>Buka dokumen</Link><RowActions row={live} steps={PO_STEPS} run={run} size="md" /></>}>
          {live && (<>
            <div className="mb-3"><Status value={live.status} /></div>
            <Facts items={[["Tanggal pesanan", date(live.order_date)], ["Total", rupiah(live.total_amount)], ["Pemasok", live.supplier_name]]} />
            <Items rows={live.items} />
          </>)}
        </Drawer>
      } />
  );
}

export function Receipts() {
  const q = useList("grn", "/procurement/goods-receipts", {}, false);
  return (
    <ListPage title="Penerimaan barang" label="Penerimaan barang" q={q} sub="Setiap penerimaan menambah lapisan FIFO dan mencatat jurnal Persediaan terhadap Barang diterima belum ditagih."
      columns={[col("Nomor", "grn_no", { m: "t" }), col("Diterima", "received_date", { cell: (c) => date(c.getValue()), m: "d" }), money("Nilai", "total_value", "v")]}
      empty="Belum ada penerimaan barang. Terima barang dari pesanan pembelian yang sudah disetujui." />
  );
}

export function SalesOrders() {
  const { branchId, can } = useSession();
  const q = useList("sos", "/sales/orders", { branch_id: branchId });
  const run = useTransition(["sos", "so"], "/sales/orders");
  const [open, setOpen] = useState<Row | null>(null);
  const live = open ? (q.data ?? []).find((r) => r.id === open.id) ?? open : null;
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_amount), 0);
  const quotes = (q.data ?? []).filter((r) => r.status === "QUOTATION").length;
  const columns = [
    col("Nomor", "so_no", { m: "t" }), col("Pelanggan", "customer_name", { m: "s" }), col("Tanggal", "order_date", { cell: (c) => date(c.getValue()), m: "d" }),
    money("Total", "total_amount", "v"), status(),
  ];
  return (
    <ListPage title="Pesanan penjualan" label="Pesanan penjualan" q={q} columns={columns}
      sub={q.data ? `${q.data.length} pesanan · total ${compactRupiah(total)}${quotes ? ` · ${quotes} penawaran menunggu konfirmasi` : ""}` : "Memuat…"}
      actions={can("sales.write") && <Link className="btn btn-primary" to="/sales/orders/new">Buat pesanan</Link>}
      empty="Belum ada pesanan penjualan." emptyAction={can("sales.write") ? <Link className="btn btn-sm" to="/sales/orders/new">Buat pesanan penjualan</Link> : undefined}
      onOpen={setOpen} selectedId={(r) => r.id === open?.id}
      preview={
        <Drawer open={!!live} onClose={() => setOpen(null)} title={live?.so_no ?? ""} subtitle={live ? `${live.customer_name}` : undefined}
          footer={live && <><Link className="btn btn-primary" to={`/sales/orders/${live.id}`}>Buka dokumen</Link><RowActions row={live} steps={SO_STEPS} run={run} size="md" extra={returnable(live.status) ? <ReturnLink id={live.id} size="md" /> : undefined} /></>}>
          {live && (<>
            <div className="mb-3"><Status value={live.status} /></div>
            <Facts items={[["Tanggal pesanan", date(live.order_date)], ["Total", rupiah(live.total_amount)], ["Pelanggan", live.customer_name]]} />
            <Items rows={live.items} />
          </>)}
        </Drawer>
      } />
  );
}

export function Stock() {
  const { branchId, branches } = useSession();
  const q = useList("stock", "/inventory/balances", { branch_id: branchId }, false);
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const low = (q.data ?? []).filter((r) => r.is_low).length;
  return (
    <ListPage title="Level stok" label="Level stok" q={q}
      sub={q.data ? `${q.data.length} baris stok${low ? ` · ${low} di bawah titik pesan ulang` : ""}. Tersedia = stok fisik dikurangi yang dicadangkan.` : "Memuat…"}
      columns={[col("SKU", "sku", { m: "t" }), col("Produk", "name", { m: "s" }),
        col("Gudang", "branch_id", { cell: (c) => name(c.getValue()), filterFn: (r, id, v) => name(r.getValue(id)).toLowerCase().includes(String(v).toLowerCase()), m: "d" }),
        col("Stok fisik", "on_hand", { cell: (c) => qty(c.getValue()), meta: R("x") }), col("Dicadangkan", "reserved", { cell: (c) => qty(c.getValue()), meta: R("x") }),
        col("Tersedia", "available", { cell: (c) => <span className={c.row.original.is_low ? "font-medium text-warn" : ""}>{qty(c.getValue())}{c.row.original.is_low ? " (rendah)" : ""}</span>, meta: R("v") }),
        money("Nilai FIFO", "value", "x")]}
      empty="Belum ada stok. Stok muncul setelah barang diterima atau dirakit." />
  );
}

export function Movements() {
  const { branchId } = useSession();
  const q = useList("movements", "/inventory/movements", { branch_id: branchId, page_size: 200 }, false);
  return (
    <ListPage title="Kartu stok" label="Kartu stok" q={q} sub="Catatan permanen setiap pergerakan stok; 200 terbaru ditampilkan."
      columns={[col("Waktu", "created_at", { cell: (c) => dateTime(c.getValue()), m: "t" }), col("Jenis", "type", { m: "s" }), col("ID produk", "product_id", { meta: R("x") }),
        col("Jumlah", "quantity", { cell: (c) => qty(c.getValue()), meta: R("v") }), col("Biaya satuan", "unit_cost", { cell: (c) => rupiah(c.getValue(), true), meta: R("x") }), col("Referensi", "ref_type", { m: "d" })]}
      empty="Belum ada pergerakan stok." />
  );
}

export function Transfers() {
  const { branches } = useSession();
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const q = useList("transfers", "/inventory/transfers", {}, false);
  const run = useTransition(["transfers"], "/inventory/transfers");
  const steps: Step[] = [
    { from: "REQUESTED", action: "dispatch", next: "IN_TRANSIT", label: "Kirim", perm: "inventory.write" },
    { from: "IN_TRANSIT", action: "receive", next: "RECEIVED", label: "Terima", perm: "inventory.write" },
  ];
  return (
    <ListPage title="Transfer antar gudang" label="Transfer stok" q={q} sub="Lapisan biaya FIFO ikut berpindah bersama barang, jadi gudang penerima mempertahankan biaya aslinya."
      columns={[col("Nomor", "transfer_no", { m: "t" }), col("Dari", "from_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false, m: "s" }), col("Ke", "to_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false, m: "d" }),
        col("Item", "items", { cell: (c) => c.getValue().length, meta: R("x"), enableColumnFilter: false }), status(), actionCol((r) => <RowActions row={r} steps={steps} run={run} />)]}
      empty="Belum ada transfer antar gudang." />
  );
}

export function WorkOrders() {
  const q = useList("wo", "/inventory/work-orders", {}, false);
  const run = useTransition(["wo"], "/inventory/work-orders");
  const steps: Step[] = [{ from: "DRAFT", action: "complete", next: "COMPLETED", label: "Selesaikan", perm: "inventory.write" }];
  return (
    <ListPage title="Perakitan" label="Perintah perakitan" q={q} sub="Penyelesaian memakai komponen secara FIFO dan menghitung biaya barang jadi dari yang benar-benar terpakai."
      columns={[col("Perintah kerja", "wo_no", { m: "t" }), col("Produk", "sku", { m: "s" }), col("Jumlah", "quantity", { cell: (c) => qty(c.getValue()), meta: R("x") }),
        money("Total biaya", "total_cost", "v"), col("Biaya satuan", "unit_cost", { cell: (c) => rupiah(c.getValue(), true), meta: R("x") }), status(), actionCol((r) => <RowActions row={r} steps={steps} run={run} />)]}
      empty="Belum ada perintah perakitan." />
  );
}

export function Reorder() {
  const { branchId } = useSession();
  const q = useList("reorder", "/inventory/reorder-recommendations", { branch_id: branchId }, false);
  return (
    <ListPage title="Saran pesan ulang" label="Rekomendasi pesan ulang" q={q} sub="Berdasarkan rata-rata pemakaian harian 30 hari terakhir ditambah stok pengaman."
      columns={[col("SKU", "sku", { m: "t" }), col("Produk", "name", { m: "s" }), col("Tersedia", "available", { cell: (c) => qty(c.getValue()), meta: R("x") }),
        col("Titik pesan ulang", "reorder_point", { cell: (c) => qty(c.getValue()), meta: R("x") }), col("Rata-rata per hari", "avg_daily_usage", { cell: (c) => qty(c.getValue()), meta: R("x") }),
        col("Saran pesan", "suggested_order_qty", { cell: (c) => <strong>{qty(c.getValue())}</strong>, meta: R("v") })]}
      empty="Tidak ada item yang perlu dipesan ulang sekarang." />
  );
}

export function Journals() {
  const { branchId, can } = useSession();
  const q = useList("journals", "/accounting/journals", { branch_id: branchId });
  return (
    <ListPage title="Jurnal umum" label="Jurnal umum" q={q} sub="Jurnal yang sudah diposting tidak bisa diubah. Perbaiki kesalahan dengan jurnal pembalik."
      actions={can("accounting.post") && <Link className="btn btn-primary" to="/accounting/journals/new">Buat jurnal</Link>}
      columns={[col("Jurnal", "entry_no", { m: "t" }), col("Tanggal", "entry_date", { cell: (c) => date(c.getValue()), m: "d" }), col("Keterangan", "description", { m: "s" }), col("Sumber", "source_type", { m: "x" }),
        money("Jumlah", "total", "v"), status()]}
      empty="Belum ada jurnal." emptyAction={can("accounting.post") ? <Link className="btn btn-sm" to="/accounting/journals/new">Buat jurnal</Link> : undefined} />
  );
}

export function Invoices() {
  const { branchId, can } = useSession();
  const q = useList("invoices", "/invoices", { branch_id: branchId });
  const qc = useQueryClient();
  const [open, setOpen] = useState<Row | null>(null);
  const live = open ? (q.data ?? []).find((r) => r.id === open.id) ?? open : null;
  const pay = useMutation({
    mutationFn: (r: Row) => api(`/invoices/${r.id}/payments`, { method: "POST", body: { amount: r.outstanding } }),
    onSuccess: () => { toast("Pembayaran dicatat."); for (const k of ["invoices", "invoice", "overview", "journals"]) void qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pembayaran gagal. Coba lagi.", "error"),
  });
  const overdue = (q.data ?? []).filter((r) => r.status !== "PAID" && r.status !== "VOID" && r.due_date < new Date().toISOString().slice(0, 10)).length;
  return (
    <ListPage title="Faktur dan tagihan" label="Faktur dan tagihan" q={q}
      sub={q.data ? `${q.data.length} dokumen${overdue ? ` · ${overdue} lewat jatuh tempo` : ""}. Piutang dibayar pelanggan; utang dibayar ke pemasok.` : "Memuat…"}
      columns={[col("Nomor", "invoice_no", { m: "t" }), col("Jenis", "type", { cell: (c) => (c.getValue() === "AR" ? "Piutang" : "Utang"), m: "s" }), col("Jatuh tempo", "due_date", { cell: (c) => date(c.getValue()), m: "d" }),
        money("Total", "total_amount", "x"), money("Sisa", "outstanding", "v"), status()]}
      empty="Belum ada faktur atau tagihan." onOpen={setOpen} selectedId={(r) => r.id === open?.id}
      preview={
        <Drawer open={!!live} onClose={() => setOpen(null)} title={live?.invoice_no ?? ""} subtitle={live ? (live.type === "AR" ? "Faktur piutang" : "Tagihan pemasok") : undefined}
          footer={live && <><Link className="btn btn-primary" to={`/accounting/invoices/${live.id}`}>Buka dokumen</Link>{can("payments.write") && live.status !== "PAID" && <button className="btn" disabled={pay.isPending} onClick={() => pay.mutate(live)}>Bayar penuh</button>}</>}>
          {live && (<>
            <div className="mb-3"><Status value={live.status} /></div>
            <Facts items={[["Tanggal", date(live.invoice_date)], ["Jatuh tempo", date(live.due_date)], ["Total", rupiah(live.total_amount)], ["Dibayar", rupiah(live.paid_amount)], ["Sisa", rupiah(live.outstanding)]]} />
          </>)}
        </Drawer>
      } />
  );
}

export function AuditLog() {
  const q = useList("audit", "/audit-logs", {});
  return (
    <ListPage title="Log audit" label="Log audit" q={q} sub="Jejak permanen tindakan penting beserta nilai sebelum dan sesudah."
      columns={[col("Waktu", "created_at", { cell: (c) => dateTime(c.getValue()), m: "t" }), col("Pengguna", "user", { m: "s" }), col("Tindakan", "action", { m: "x" }), col("Entitas", "entity_type", { m: "x" }), col("Ref", "entity_id", { m: "d" }),
        col("Perubahan", "after", { enableSorting: false, enableColumnFilter: false, cell: (c) => <code className="block max-w-xs truncate text-xs text-muted" title={JSON.stringify(c.row.original.before) + " → " + JSON.stringify(c.getValue())}>{c.getValue() ? JSON.stringify(c.getValue()) : ""}</code>, m: "h" }),
        col("IP", "ip_address", { m: "h" })]}
      empty="Belum ada kejadian audit." />
  );
}
