import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { Glyph, type GlyphName } from "../components/glyphs";
import { KeyLink } from "../components/Key";
import { Drawer } from "../components/Layers";
import { RoomLink } from "../components/RoomLink";
import { DocChain, type ChainStep } from "../components/signature/DocChain";
import { Code, ErrorNote, PageHeader, Pencil, SectionTitle, Status, statusText, type Art } from "../components/ui";
import { PO_STEPS, ReturnLink, returnable, RowActions, SO_STEPS, usePayInvoice, useTransition, type Row, type Step } from "../lib/actions";
import { api } from "../lib/api";
import { actionCol, code, col, day, docNo, money, quantity, status } from "../lib/columns";
import { compactRupiah, date, dateTime, num, qty, rupiah, today } from "../lib/format";
import { openJournal } from "../lib/journals";
import { activityPhrase } from "../lib/labels";
import { useReceipts, useReturns } from "../lib/relations";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { roomName } from "../motion/viewTransition";
import { Timeline } from "./Details";
import "../styles/tables.css";

export function useList(key: string, path: string, params: Record<string, unknown> = {}, paged = true) {
  return useQuery({
    queryKey: [key, params],
    queryFn: async (): Promise<Row[]> => {
      const r = await api<Page<Row> | Row[]>(path, { params: paged ? { page_size: 200, ...params } : params });
      return Array.isArray(r) ? r : r.items;
    },
  });
}

/** Peta id produk → SKU dari data master (untuk respons yang hanya membawa product_id). */
export function useSkuOf() {
  const { can } = useSession();
  const q = useQuery({ queryKey: ["products"], enabled: can("master.read"), queryFn: () => api<Row[]>("/master/products") });
  return useMemo(() => {
    const m = new Map((q.data ?? []).map((p) => [p.id as number, p]));
    return { skuOf: (id: number) => m.get(id)?.sku as string | undefined, productOf: (id: number) => m.get(id) };
  }, [q.data]);
}

/**
 * Bilah filter berbentuk chip: satu chip per status yang ada di data, dengan jumlahnya. Tetap tampil walau hanya ada
 * satu status, supaya tinggi halaman sama dengan kerangkanya dan tabel tidak bergeser setelah data datang.
 */
function StatusChips({ rows }: { rows: Row[] }) {
  const [sp, setSp] = useSearchParams();
  const cur = sp.get("status");
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  const keys = Object.keys(counts);
  if (keys.length === 0) return null;
  const set = (s: string | null) => setSp((p) => { const n = new URLSearchParams(p); if (s) n.set("status", s); else n.delete("status"); return n; }, { replace: true });
  return (
    <div role="group" aria-label="Saring menurut status" className="mb-3 flex flex-wrap gap-2">
      <button type="button" className="chip-toggle" aria-pressed={!cur} onClick={() => set(null)}>Semua <span className="font-num opacity-70">{rows.length}</span></button>
      {keys.map((k) => <button key={k} type="button" className="chip-toggle" aria-pressed={cur === k} onClick={() => set(cur === k ? null : k)}>{statusText(k)} <span className="font-num opacity-70">{counts[k]}</span></button>)}
    </div>
  );
}

/** Kerangka bilah chip selama daftar dimuat, setinggi chip asli. */
const ChipsSkeleton = () => (
  <div aria-hidden="true" className="mb-3 flex flex-wrap gap-2">
    {[0, 1, 2].map((i) => <span key={i} className="chip-toggle is-wait"><Pencil i={i} /></span>)}
  </div>
);

/**
 * Pola halaman daftar (10): kepala halaman dengan jumlah data dan satu aksi utama, bilah filter chip, tabel lembar buku besar,
 * laci pratinjau, dan Transisi Ruang dari nomor dokumen ke detailnya.
 */
function ListPage({ title, sub, q, columns, actions, label, onOpen, selectedId, empty, emptyAction, preview, lead, art, chips }: {
  art?: Art; lead?: ReactNode; title: string; sub?: string; q: ReturnType<typeof useList>; columns: ColumnDef<Row, any>[]; actions?: ReactNode; label: string;
  onOpen?: (r: Row) => void; selectedId?: (r: Row) => boolean; empty?: string; emptyAction?: ReactNode; preview?: ReactNode; chips?: boolean;
}) {
  const statusParam = useSearchParams()[0].get("status");
  const loc = useLocation();
  return (
    <>
      <PageHeader title={title} sub={sub} actions={actions} cta room={roomName("list", loc.pathname.replace(/\//g, "-"))} />
      {lead}
      {chips && (q.data ? <StatusChips rows={q.data} /> : q.isLoading ? <ChipsSkeleton /> : null)}
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Row> key={statusParam ?? "semua"} selectable initialFilters={statusParam ? [{ id: "status", value: `=${statusParam}` }] : undefined} emptyArt={art} label={label}
          data={q.data ?? []} columns={columns} loading={q.isLoading} onOpen={onOpen} selectedId={selectedId} empty={empty} emptyAction={emptyAction} />
      )}
      {preview}
    </>
  );
}

const Facts = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-table">
    {items.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num">{v}</dd></div>))}
  </dl>
);
const Items = ({ rows }: { rows: Row[] }) => (
  <>
    <div className="mt-6 border-t border-line pt-4"><SectionTitle>Item</SectionTitle></div>
    <table className="tbl dense"><tbody>
      {rows.slice(0, 6).map((i) => (<tr key={i.id}><td><span className="code">{i.sku}</span> {i.name}</td><td className="num">{qty(i.quantity)}</td></tr>))}
    </tbody></table>
    {rows.length > 6 && <p className="mt-1 text-xs text-muted">dan {rows.length - 6} item lain di dokumen.</p>}
  </>
);

function PoPreview({ po, onClose, run }: { po: Row | null; onClose: () => void; run: ReturnType<typeof useTransition> }) {
  const grns = useReceipts(po?.id);
  const chain: ChainStep[] = po ? [
    { key: "po", label: "Pesanan", glyph: "pesanan-pembelian", state: "current", docs: [{ id: po.id, number: po.po_no, date: po.order_date, status: po.status }] },
    { key: "grn", label: "Penerimaan", glyph: "penerimaan-barang", docs: (grns.data ?? []).map((g) => ({ id: g.id, number: g.grn_no, date: g.received_date })), state: grns.data?.length ? "done" : "missing" },
  ] : [];
  return (
    <Drawer open={!!po} onClose={onClose} title={po ? <Code>{po.po_no}</Code> : ""} subtitle={po?.supplier_name} chain={po ? <DocChain steps={chain} mini /> : undefined}
      full={po ? { to: `/procurement/orders/${po.id}`, room: roomName("po", po.id) } : undefined} footer={po && <RowActions row={po} steps={PO_STEPS} run={run} size="md" />}>
      {po && (<>
        <div className="mb-3"><Status value={po.status} /></div>
        <Facts items={[["Tanggal pesanan", date(po.order_date)], ["Total", rupiah(po.total_amount)], ["Pemasok", po.supplier_name]]} />
        <Items rows={po.items} />
      </>)}
    </Drawer>
  );
}

export function PurchaseOrders() {
  const { branchId, can } = useSession();
  const q = useList("pos", "/procurement/purchase-orders", { branch_id: branchId });
  const run = useTransition(["pos", "po"], "/procurement/purchase-orders");
  const [open, setOpen] = useState<Row | null>(null);
  const live = open ? (q.data ?? []).find((r) => r.id === open.id) ?? open : null;
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_amount), 0);
  const pending = (q.data ?? []).filter((r) => r.status === "PENDING_APPROVAL").length;
  const qc = useQueryClient();
  return (
    <ListPage title="Pesanan pembelian" label="Pesanan pembelian" q={q} chips
      columns={[docNo("Nomor", "po_no", (r) => `/procurement/orders/${r.id}`, (r) => roomName("po", r.id), (r) => qc.setQueryData(["po", String(r.id)], r)), col("Pemasok", "supplier_name", { m: "s" }), day("Tanggal", "order_date"), money("Total", "total_amount", "v"), status()]}
      sub={q.data ? `${q.data.length} pesanan · ${compactRupiah(total)}${pending ? ` · ${pending} perlu persetujuan` : ""}` : "Memuat pesanan…"}
      actions={can("procurement.write") && <KeyLink tone="primary" glyph="buat" to="/procurement/orders/new">Buat pesanan pembelian</KeyLink>}
      empty="Belum ada pesanan pembelian." emptyAction={can("procurement.write") ? <Link className="btn btn-sm" to="/procurement/orders/new">Buat pesanan pembelian</Link> : undefined}
      onOpen={setOpen} selectedId={(r) => r.id === open?.id} preview={<PoPreview po={live} onClose={() => setOpen(null)} run={run} />} />
  );
}

export function Receipts() {
  const q = useList("grn", "/procurement/goods-receipts", {}, false);
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_value), 0);
  return (
    <ListPage title="Penerimaan barang" label="Penerimaan barang" q={q} art="rak-kosong"
      sub={q.data ? `${q.data.length} penerimaan · ${compactRupiah(total)}. Setiap penerimaan menambah lapisan FIFO dan mencatat jurnal persediaan.` : "Memuat penerimaan…"}
      columns={[code("Nomor", "grn_no"), day("Diterima", "received_date"),
        col("Pesanan pembelian", "po_id", { m: "s", cell: (c) => <RoomLink to={`/procurement/orders/${c.getValue()}`} room={roomName("po", c.getValue())} className="hover:underline">Pesanan #{c.getValue()}</RoomLink> }),
        money("Nilai", "total_value", "v")]}
      empty="Belum ada penerimaan barang. Terima barang dari pesanan pembelian yang sudah disetujui." />
  );
}

function SoPreview({ so, onClose, run }: { so: Row | null; onClose: () => void; run: ReturnType<typeof useTransition> }) {
  const returns = useReturns(!!so);
  const mine = so ? (returns.data ?? []).filter((r) => r.so_id === so.id) : [];
  const chain: ChainStep[] = so ? [
    { key: "so", label: "Pesanan", glyph: "pesanan-penjualan", state: "current", docs: [{ id: so.id, number: so.so_no, date: so.order_date, status: so.status }] },
    { key: "ret", label: "Retur", glyph: "retur", docs: mine.map((r) => ({ id: r.id, number: r.return_no, date: r.return_date, to: `/sales/returns/${r.id}`, room: roomName("ret", r.id) })), state: mine.length ? "done" : "missing" },
  ] : [];
  return (
    <Drawer open={!!so} onClose={onClose} title={so ? <Code>{so.so_no}</Code> : ""} subtitle={so?.customer_name} chain={so ? <DocChain steps={chain} mini /> : undefined}
      full={so ? { to: `/sales/orders/${so.id}`, room: roomName("so", so.id) } : undefined}
      footer={so && <RowActions row={so} steps={SO_STEPS} run={run} size="md" extra={returnable(so.status) ? <ReturnLink id={so.id} size="md" /> : undefined} />}>
      {so && (<>
        <div className="mb-3"><Status value={so.status} /></div>
        <Facts items={[["Tanggal pesanan", date(so.order_date)], ["Total", rupiah(so.total_amount)], ["Pelanggan", so.customer_name]]} />
        <Items rows={so.items} />
      </>)}
    </Drawer>
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
  const qc = useQueryClient();
  return (
    <ListPage title="Pesanan penjualan" label="Pesanan penjualan" q={q} chips
      columns={[docNo("Nomor", "so_no", (r) => `/sales/orders/${r.id}`, (r) => roomName("so", r.id), (r) => qc.setQueryData(["so", String(r.id)], r)), col("Pelanggan", "customer_name", { m: "s" }), day("Tanggal", "order_date"), money("Total", "total_amount", "v"), status()]}
      sub={q.data ? `${q.data.length} pesanan · ${compactRupiah(total)}${quotes ? ` · ${quotes} penawaran menunggu konfirmasi` : ""}` : "Memuat pesanan…"}
      actions={can("sales.write") && <KeyLink tone="primary" glyph="buat" to="/sales/orders/new">Buat pesanan penjualan</KeyLink>}
      empty="Belum ada pesanan penjualan." emptyAction={can("sales.write") ? <Link className="btn btn-sm" to="/sales/orders/new">Buat pesanan penjualan</Link> : undefined}
      onOpen={setOpen} selectedId={(r) => r.id === open?.id} preview={<SoPreview so={live} onClose={() => setOpen(null)} run={run} />} />
  );
}

const MOVE: Record<string, { label: string; glyph: GlyphName }> = {
  GRN: { label: "Masuk dari pemasok", glyph: "penerimaan-barang" }, SALE: { label: "Keluar ke pelanggan", glyph: "pengiriman" }, SALE_RETURN: { label: "Retur masuk", glyph: "retur" },
  TRANSFER_OUT: { label: "Transfer keluar", glyph: "transfer" }, TRANSFER_IN: { label: "Transfer masuk", glyph: "transfer" }, WO_CONSUME: { label: "Dipakai perakitan", glyph: "perakitan" },
  WO_OUTPUT: { label: "Hasil perakitan", glyph: "perakitan" }, ADJUSTMENT: { label: "Selisih opname", glyph: "kartu-stok" }, COUNT: { label: "Selisih opname", glyph: "kartu-stok" },
};
const moveOf = (t: string) => MOVE[t] ?? { label: t.toLowerCase().replace(/_/g, " "), glyph: "kartu-stok" as GlyphName };

/**
 * Kartu stok (10): buku besar per produk dan gudang dengan saldo berjalan dan glyph jenis gerakan.
 * Saldo berjalan ditambatkan ke stok fisik dari API (/inventory/balances): baris terakhir sama persis dengan stok fisik,
 * baris sebelumnya mengurangkan gerakan satu per satu. API tidak punya tanggal bisnis gerakan, jadi waktu yang tampil adalah waktu pencatatan.
 */
export function Movements() {
  const { branchId, branches } = useSession();
  const { skuOf, productOf } = useSkuOf();
  const [sp, setSp] = useSearchParams();
  const product = sp.get("produk");
  const branch = sp.get("gudang") ?? (branchId ? String(branchId) : "");
  const bal = useList("stock", "/inventory/balances", {}, false);
  const recent = useQuery({ queryKey: ["movements", { branch_id: branchId }], enabled: !product, queryFn: async () => (await api<Page<Row>>("/inventory/movements", { params: { branch_id: branchId, page_size: 200 } })).items });
  const card = useQuery({
    queryKey: ["movements", { product, branch }],
    enabled: !!product && !!branch,
    queryFn: async () => {
      const all: Row[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await api<Page<Row>>("/inventory/movements", { params: { product_id: product, branch_id: branch, page_size: 200, page } });
        all.push(...r.items);
        if (page * r.page_size >= r.total) break;
      }
      return all.sort((a, b) => a.id - b.id);
    },
  });
  const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const stocked = [...new Map((bal.data ?? []).map((b) => [b.product_id as number, b])).values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const onHand = (bal.data ?? []).find((b) => String(b.product_id) === product && String(b.branch_id) === branch);
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;

  let ledger: (Row & { saldo: number })[] = [];
  if (card.data && onHand) {
    let after = num(onHand.on_hand);
    ledger = [...card.data].reverse().map((m) => { const row = { ...m, saldo: after }; after -= num(m.quantity); return row; }).reverse();
  }
  const opening = ledger.length ? ledger[0]!.saldo - num(ledger[0]!.quantity) : 0;

  return (
    <>
      <PageHeader title="Kartu stok" sub={product ? `${skuOf(Number(product)) ?? ""} · ${branch ? name(Number(branch)) : "pilih gudang"} · saldo berjalan ditambatkan ke stok fisik saat ini` : "Pilih produk dan gudang untuk melihat buku besarnya. Tanpa pilihan, 200 gerakan terbaru tampil."} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-table font-medium">Produk
          <select className="field mt-1 w-64" name="produk" value={product ?? ""} onChange={(e) => set("produk", e.target.value)}>
            <option value="">Semua (200 terbaru)</option>
            {stocked.map((p) => <option key={p.product_id} value={p.product_id}>{p.sku} · {p.name}</option>)}
          </select>
        </label>
        {product && (
          <label className="text-table font-medium">Gudang
            <select className="field mt-1 w-56" name="gudang" value={branch} onChange={(e) => set("gudang", e.target.value)}>
              <option value="">Pilih gudang</option>
              {(bal.data ?? []).filter((b) => String(b.product_id) === product).map((b) => <option key={b.branch_id} value={b.branch_id}>{name(b.branch_id)}</option>)}
            </select>
          </label>
        )}
      </div>
      {!product ? (
        recent.isError ? <ErrorNote error={recent.error} retry={() => recent.refetch()} /> :
        <DataTable<Row> label="Gerakan stok terbaru" data={recent.data ?? []} loading={recent.isLoading} empty="Belum ada gerakan stok."
          columns={[col("Dicatat", "created_at", { cell: (c) => dateTime(c.getValue()), m: "t" }),
            col("Jenis", "type", { m: "s", cell: (c) => <span className="inline-flex items-center gap-1.5"><Glyph name={moveOf(c.getValue()).glyph} size={16} />{moveOf(c.getValue()).label}</span> }),
            col("Produk", "product_id", { m: "d", code: true, cell: (c) => skuOf(c.getValue()) ?? `#${c.getValue()}`, filterFn: (r, id, v) => String(skuOf(r.getValue(id)) ?? "").toLowerCase().includes(String(v).toLowerCase()) }),
            col("Gudang", "branch_id", { m: "x", cell: (c) => name(c.getValue()), enableColumnFilter: false }),
            col("Jumlah", "quantity", { right: true, m: "v", cell: (c) => <span className={num(c.getValue()) < 0 ? "" : "text-good"}>{num(c.getValue()) > 0 ? "+" : ""}{qty(c.getValue())}</span> }),
            money("Biaya satuan", "unit_cost", "x", true)]} />
      ) : !branch ? <p className="text-muted">Pilih gudang untuk {skuOf(Number(product))}.</p>
        : card.isError ? <ErrorNote error={card.error} retry={() => card.refetch()} />
        : card.isLoading || bal.isLoading ? <div className="sheet p-6"><span className="pencil w-1/2" /></div>
        : !onHand ? <p className="text-muted">Produk ini tidak punya saldo di gudang tersebut.</p> : (
          <div className="tbl-sheet ledger-paper">
            <table className="tbl ledger" aria-label={`Kartu stok ${skuOf(Number(product))} di ${name(Number(branch))}`}>
              <thead><tr><th>Dicatat</th><th>Gerakan</th><th>Referensi</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Biaya satuan</th><th className="text-right">Saldo</th></tr></thead>
              <tbody>
                <tr><td colSpan={6} className="text-muted">Saldo awal (sebelum gerakan pertama yang tercatat)</td><td className="num font-medium">{qty(opening)}</td></tr>
                {ledger.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{dateTime(m.created_at)}</td>
                    <td><span className="inline-flex items-center gap-1.5"><Glyph name={moveOf(m.type).glyph} size={16} />{moveOf(m.type).label}</span></td>
                    <td className="code">{m.ref_type ? `${m.ref_type} #${m.ref_id}` : "–"}</td>
                    <td className="num">{num(m.quantity) > 0 ? qty(m.quantity) : ""}</td>
                    <td className="num">{num(m.quantity) < 0 ? qty(-num(m.quantity)) : ""}</td>
                    <td className="num">{rupiah(m.unit_cost, true)}</td>
                    <td className="num">{qty(m.saldo)}</td>
                  </tr>
                ))}
                <tr className="total"><td colSpan={6} className="font-semibold">Stok fisik saat ini (dari API)</td><td className="num font-semibold">{qty(onHand.on_hand)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      {product && productOf(Number(product))?.product_type === "SERVICE" && <p className="mt-2 text-muted">Jasa tidak punya stok.</p>}
    </>
  );
}

export function Transfers() {
  const { branches, can } = useSession();
  const { skuOf } = useSkuOf();
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const q = useList("transfers", "/inventory/transfers", {}, false);
  const run = useTransition(["transfers"], "/inventory/transfers", skuOf);
  const steps: Step[] = [
    { from: "REQUESTED", action: "dispatch", next: "IN_TRANSIT", label: "Kirim transfer", perm: "inventory.write" },
    { from: "IN_TRANSIT", action: "receive", next: "RECEIVED", label: "Terima transfer", perm: "inventory.write" },
  ];
  const open = (q.data ?? []).filter((r) => r.status !== "RECEIVED").length;
  return (
    <ListPage title="Transfer antar gudang" label="Transfer stok" q={q} chips
      sub={q.data ? `${q.data.length} transfer${open ? ` · ${open} belum selesai` : ""}. Lapisan biaya FIFO ikut berpindah bersama barang.` : "Memuat transfer…"}
      columns={[code("Nomor", "transfer_no"), col("Dari", "from_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false, m: "s" }), col("Ke", "to_branch_id", { cell: (c) => name(c.getValue()), enableColumnFilter: false, m: "d" }),
        col("Item", "items", { cell: (c) => c.getValue().map((i: Row) => `${skuOf(i.product_id) ?? `#${i.product_id}`} × ${qty(i.quantity)}`).join(", "), m: "x", enableColumnFilter: false }), status(),
        ...(can("inventory.write") ? [actionCol((r) => <RowActions row={r} steps={steps} run={run} />)] : [])]}
      empty="Belum ada transfer antar gudang." />
  );
}

export function WorkOrders() {
  const { can } = useSession();
  const q = useList("wo", "/inventory/work-orders", {}, false);
  const run = useTransition(["wo"], "/inventory/work-orders");
  const steps: Step[] = [{ from: "DRAFT", action: "complete", next: "COMPLETED", label: "Selesaikan perakitan", perm: "inventory.write" }];
  return (
    <ListPage title="Perakitan" label="Perintah perakitan" q={q} chips
      sub={q.data ? `${q.data.length} perintah kerja. Penyelesaian memakai komponen secara FIFO dan menghitung biaya barang jadi dari yang benar-benar terpakai.` : "Memuat perakitan…"}
      columns={[code("Perintah kerja", "wo_no"), code("Produk", "sku", "s"), quantity("Jumlah", "quantity", "x"), money("Total biaya", "total_cost", "v"), money("Biaya satuan", "unit_cost", "x", true), status(),
        ...(can("inventory.write") ? [actionCol((r) => <RowActions row={r} steps={steps} run={run} />)] : [])]}
      empty="Belum ada perintah perakitan." />
  );
}

export function Reorder() {
  const { branchId, branches } = useSession();
  const q = useList("reorder", "/inventory/reorder-recommendations", { branch_id: branchId }, false);
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  return (
    <ListPage title="Saran pesan ulang" label="Rekomendasi pesan ulang" q={q} art="rak-kosong"
      sub={q.data ? `${q.data.length} item perlu dipesan. Berdasarkan rata-rata pemakaian harian 30 hari terakhir ditambah stok pengaman.` : "Memuat saran…"}
      columns={[code("SKU", "sku"), col("Produk", "name", { m: "s" }), col("Gudang", "branch_id", { m: "d", cell: (c) => name(c.getValue()), enableColumnFilter: false }), quantity("Tersedia", "available", "x"),
        quantity("Titik pesan ulang", "reorder_point", "x"), quantity("Rata-rata per hari", "avg_daily_usage", "x"),
        col("Saran pesan", "suggested_order_qty", { right: true, m: "v", cell: (c) => <strong className="font-num">{qty(c.getValue())}</strong> })]}
      empty="Tidak ada item yang perlu dipesan ulang sekarang." />
  );
}

export function Journals() {
  const { branchId, can } = useSession();
  const q = useList("journals", "/accounting/journals", { branch_id: branchId });
  const qc = useQueryClient();
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total), 0);
  return (
    <ListPage title="Jurnal umum" label="Jurnal umum" q={q}
      sub={q.data ? `${q.data.length} jurnal · ${compactRupiah(total)}. Jurnal yang diposting tidak bisa diubah; koreksi lewat jurnal pembalik.` : "Memuat jurnal…"}
      actions={can("accounting.post") && <KeyLink tone="primary" glyph="buat" to="/accounting/journals/new">Buat jurnal</KeyLink>}
      columns={[docNo("Jurnal", "entry_no", (r) => `/accounting/journals/${r.id}`, (r) => roomName("je", r.id), (r) => qc.setQueryData(["journal", r.id], r)), day("Tanggal", "entry_date"), col("Keterangan", "description", { m: "s" }), col("Sumber", "source_type", { m: "x" }), money("Jumlah", "total", "v"), status()]}
      onOpen={(r) => openJournal({ id: r.id, date: r.entry_date })}
      empty="Belum ada jurnal." emptyAction={can("accounting.post") ? <Link className="btn btn-sm" to="/accounting/journals/new">Buat jurnal</Link> : undefined} />
  );
}

function InvoicePreview({ inv, onClose }: { inv: Row | null; onClose: () => void }) {
  const { can } = useSession();
  const pay = usePayInvoice();
  const returns = useReturns(!!inv);
  const mine = inv ? (returns.data ?? []).filter((r) => r.invoice_id === inv.id) : [];
  const chain: ChainStep[] = inv ? [
    { key: "inv", label: inv.type === "AR" ? "Faktur" : "Tagihan", glyph: "faktur", state: "current", docs: [{ id: inv.id, number: inv.invoice_no, date: inv.invoice_date, status: inv.status }] },
    { key: "pay", label: "Pembayaran", glyph: "simpan", docs: [], state: num(inv.paid_amount) > 0 ? "unlinked" : "missing" },
    ...(inv.type === "AR" ? [{ key: "ret", label: "Retur", glyph: "retur" as const, docs: mine.map((r) => ({ id: r.id, number: r.return_no, date: r.return_date, to: `/sales/returns/${r.id}`, room: roomName("ret", r.id) })), state: (mine.length ? "done" : "missing") as ChainStep["state"] }] : []),
  ] : [];
  return (
    <Drawer open={!!inv} onClose={onClose} title={inv ? <Code>{inv.invoice_no}</Code> : ""} subtitle={inv ? (inv.type === "AR" ? "Faktur piutang" : "Tagihan pemasok") : undefined}
      chain={inv ? <DocChain steps={chain} mini /> : undefined} full={inv ? { to: `/accounting/invoices/${inv.id}`, room: roomName("inv", inv.id) } : undefined}
      footer={inv && can("payments.write") && inv.status !== "PAID" && <button className="btn" disabled={pay.isPending} onClick={() => pay.mutate(inv)}>Bayar penuh</button>}>
      {inv && (<>
        <div className="mb-3"><Status value={inv.status} /></div>
        <Facts items={[["Tanggal", date(inv.invoice_date)], ["Jatuh tempo", date(inv.due_date)], ["Total", rupiah(inv.total_amount)], ["Dibayar", rupiah(inv.paid_amount)], ["Sisa", rupiah(inv.outstanding)]]} />
      </>)}
    </Drawer>
  );
}

export function Invoices() {
  const { branchId } = useSession();
  const q = useList("invoices", "/invoices", { branch_id: branchId });
  const [open, setOpen] = useState<Row | null>(null);
  const live = open ? (q.data ?? []).find((r) => r.id === open.id) ?? open : null;
  const t = today();
  const overdue = (q.data ?? []).filter((r) => r.status !== "PAID" && r.status !== "VOID" && r.due_date < t);
  return (
    <ListPage title="Faktur dan tagihan" label="Faktur dan tagihan" q={q} chips art="struk-kosong"
      sub={q.data ? `${q.data.length} dokumen${overdue.length ? ` · ${overdue.length} lewat jatuh tempo, ${compactRupiah(overdue.reduce((s, r) => s + num(r.outstanding), 0))}` : ""}. Piutang dibayar pelanggan; utang dibayar ke pemasok.` : "Memuat faktur…"}
      columns={[docNo("Nomor", "invoice_no", (r) => `/accounting/invoices/${r.id}`, (r) => roomName("inv", r.id)), col("Jenis", "type", { cell: (c) => (c.getValue() === "AR" ? "Piutang" : "Utang"), m: "s" }),
        col("Jatuh tempo", "due_date", { m: "d", cell: (c) => <span className={clsx(c.row.original.status !== "PAID" && c.getValue() < t && "font-medium text-bad")}>{date(c.getValue())}</span> }),
        money("Total", "total_amount", "x"), money("Sisa", "outstanding", "v"), status()]}
      empty="Belum ada faktur atau tagihan." onOpen={setOpen} selectedId={(r) => r.id === open?.id} preview={<InvoicePreview inv={live} onClose={() => setOpen(null)} />} />
  );
}

/** Aktivitas: linimasa buku catatan dengan titik tinta di margin (bawaan) atau tabel dengan ekspor CSV seperti v2. */
export function AuditLog() {
  const q = useList("audit", "/audit-logs", {});
  const [view, setView] = useState<"linimasa" | "tabel">("linimasa");
  return (
    <>
      <PageHeader title="Log audit" sub={q.data ? `${q.data.length} kejadian terbaru. Jejak permanen tindakan penting beserta nilai sebelum dan sesudah.` : "Memuat kejadian…"}
        actions={<div role="group" aria-label="Tampilan" className="seg">{(["linimasa", "tabel"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "linimasa" ? "Linimasa" : "Tabel"}</button>)}</div>} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : view === "linimasa" ? (
        q.isLoading ? <div className="sheet grid gap-3 p-6"><span className="pencil w-1/3" /><span className="pencil w-1/2" /></div> : (
          <div className="sheet px-5 py-5 md:px-8">
            <Timeline items={(q.data ?? []).slice(0, 80).map((a) => ({ id: a.id, title: <>{activityPhrase(a.action, a.entity_type)}{a.after && typeof a.after === "object" ? <span className="font-normal text-muted"> · {Object.values(a.after).filter((v) => typeof v === "string" || typeof v === "number").slice(0, 2).join(" · ")}</span> : null}</>, who: a.user ?? "Sistem", at: a.created_at }))} />
            {(q.data ?? []).length > 80 && <p className="mt-4 text-table text-muted">Linimasa menampilkan 80 kejadian terbaru. Tampilan Tabel memuat semua {q.data!.length} dan bisa diekspor.</p>}
          </div>
        )
      ) : (
        <DataTable<Row> label="Log audit" data={q.data ?? []} loading={q.isLoading} empty="Belum ada kejadian audit." selectable
          columns={[col("Waktu", "created_at", { cell: (c) => dateTime(c.getValue()), m: "t" }), col("Pengguna", "user", { m: "s" }), col("Tindakan", "action", { m: "x", cell: (c) => activityPhrase(c.getValue(), c.row.original.entity_type) }), col("Entitas", "entity_type", { m: "x" }), col("Ref", "entity_id", { m: "d" }),
            col("Perubahan", "after", { enableSorting: false, enableColumnFilter: false, cell: (c) => <code className="block max-w-xs truncate text-xs text-muted" title={JSON.stringify(c.row.original.before) + " → " + JSON.stringify(c.getValue())}>{c.getValue() ? JSON.stringify(c.getValue()) : ""}</code>, m: "h" }),
            col("IP", "ip_address", { m: "h" })]} />
      )}
    </>
  );
}
