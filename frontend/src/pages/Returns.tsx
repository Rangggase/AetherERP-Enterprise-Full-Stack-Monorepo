import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup, Impact } from "../components/Form";
import { Key } from "../components/Key";
import { ConfirmDialog, Drawer } from "../components/Layers";
import { RoomLink } from "../components/RoomLink";
import { ScrollX } from "../components/ScrollX";
import { useCrumb } from "../components/Shell";
import { DocChain, type ChainStep } from "../components/signature/DocChain";
import { Stepper } from "../components/Stepper";
import { FolderTabs } from "../components/Tabs";
import { receipt } from "../components/Toaster";
import { Code, DetailSkeleton, ErrorNote, PageHeader, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import { compactRupiah, date, num, qty, rupiah, today } from "../lib/format";
import { useInvoiceIndex, useReturns, useSalesOrder } from "../lib/relations";
import { useSession } from "../lib/session";
import { focusFirstError, useUnsavedGuard } from "../lib/useUnsaved";
import { roomName } from "../motion/viewTransition";
import { DocPaper, HistoryTab, JournalTab } from "./Details";
import "../styles/tables.css";

type Row = Record<string, any>;
const meta = (m: string, right = false, code = false) => ({ m, ...(right ? { right: true } : {}), ...(code ? { code: true } : {}) });

/** Rantai retur: pesanan (so_id) → faktur (invoice_id) → retur. Hanya relasi id. */
function useReturnChain(r: Row | undefined, current: boolean): ChainStep[] {
  const so = useSalesOrder(r?.so_id);
  const inv = useInvoiceIndex(!!r);
  if (!r) return [];
  const i = inv.data?.get(r.invoice_id);
  return [
    { key: "so", label: "Pesanan", glyph: "pesanan-penjualan", state: "done", docs: [{ id: r.so_id, number: so.data?.so_no ?? `Pesanan #${r.so_id}`, date: so.data?.order_date, status: so.data?.status, to: `/sales/orders/${r.so_id}`, room: roomName("so", r.so_id) }] },
    { key: "inv", label: "Faktur", glyph: "faktur", state: "done", docs: [{ id: r.invoice_id, number: i?.invoice_no ?? `Faktur #${r.invoice_id}`, date: i?.invoice_date, status: i?.status, to: `/accounting/invoices/${r.invoice_id}`, room: roomName("inv", r.invoice_id) }] },
    { key: "ret", label: "Retur", glyph: "retur", state: current ? "current" : "done", docs: [{ id: r.id, number: r.return_no, date: r.return_date, status: r.journal_entry_id ? "POSTED" : undefined, to: current ? undefined : `/sales/returns/${r.id}`, room: roomName("ret", r.id) }] },
  ];
}

function ReturnPreview({ r, onClose }: { r: Row | null; onClose: () => void }) {
  const chain = useReturnChain(r ?? undefined, true);
  return (
    <Drawer open={!!r} onClose={onClose} title={r ? <Code>{r.return_no}</Code> : ""} subtitle={r ? `Retur penjualan · ${date(r.return_date)}` : undefined}
      chain={r ? <DocChain steps={chain} mini /> : undefined} full={r ? { to: `/sales/returns/${r.id}`, room: roomName("ret", r.id) } : undefined}>
      {r && (<>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-table">
          <dt className="text-muted">Kredit ke pelanggan</dt><dd className="num">{rupiah(r.total_amount, true)}</dd>
          <dt className="text-muted">Biaya kembali ke stok</dt><dd className="num">{rupiah(r.cogs_reversed, true)}</dd>
          <dt className="text-muted">Alasan</dt><dd className="text-right">{r.reason || "–"}</dd>
        </dl>
        <div className="mt-6 border-t border-line pt-4"><SectionTitle>Item</SectionTitle></div>
        <table className="tbl dense"><tbody>{r.items.map((i: Row) => <tr key={i.product_id}><td className="code">{i.sku}</td><td className="num">{qty(i.quantity)}</td><td className="num">{rupiah(i.unit_price)}</td></tr>)}</tbody></table>
      </>)}
    </Drawer>
  );
}

export function Returns() {
  const q = useReturns();
  const [open, setOpen] = useState<Row | null>(null);
  const columns: ColumnDef<Row, any>[] = [
    { header: "Retur", accessorKey: "return_no", meta: meta("t", false, true), cell: (c) => <RoomLink to={`/sales/returns/${c.row.original.id}`} room={roomName("ret", c.row.original.id)} className="font-medium hover:underline">{c.getValue()}</RoomLink> },
    { header: "Tanggal", accessorKey: "return_date", cell: (c) => date(c.getValue()), meta: meta("d") },
    { header: "Alasan", accessorKey: "reason", meta: meta("s") },
    { header: "Item", accessorKey: "items", enableColumnFilter: false, cell: (c) => c.getValue().map((i: Row) => `${i.sku} × ${qty(i.quantity)}`).join(", "), meta: meta("x") },
    { header: "Kredit", accessorKey: "total_amount", meta: meta("v", true), cell: (c) => rupiah(c.getValue()) },
    { header: "Biaya kembali ke stok", accessorKey: "cogs_reversed", meta: meta("x", true), cell: (c) => rupiah(c.getValue()) },
  ];
  const total = (q.data ?? []).reduce((s, r) => s + num(r.total_amount), 0);
  return (
    <>
      <PageHeader title="Retur penjualan" sub={q.data ? `${q.data.length} retur · kredit ${compactRupiah(total)}. Setiap retur mengkredit faktur dan mengembalikan stok dengan biaya saat barang keluar.` : "Memuat…"} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Row> selectable emptyArt="struk-kosong" label="Retur penjualan" data={q.data ?? []} columns={columns} loading={q.isLoading} onOpen={setOpen} selectedId={(r) => r.id === open?.id}
          empty="Belum ada retur. Catat retur dari pesanan yang sudah difaktur." />
      )}
      <ReturnPreview r={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Detail retur: dokumen kertas dengan Jejak Tinta (M1) dari journal_entry_id yang dikembalikan API. */
export function ReturnDetail() {
  const { id } = useParams();
  const loc = useLocation();
  const { branches } = useSession();
  const q = useReturns();
  const r = (q.data ?? []).find((x) => String(x.id) === id);
  const chain = useReturnChain(r, true);
  const [tab, setTab] = useState<"Jurnal" | "Riwayat">("Jurnal");
  useCrumb(r?.return_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  if (q.isLoading) return <DetailSkeleton />;
  if (!r) return <ErrorNote error={new Error(`Retur #${id} tidak ada di 200 retur terbaru.`)} />;
  const justPosted = !!(loc.state as { posted?: boolean } | null)?.posted;
  return (
    <>
      <DocPaper kind="Retur penjualan" number={r.return_no} room={roomName("ret", r.id)} status={r.journal_entry_id ? "POSTED" : "DRAFT"} landStamp={justPosted} backTo="/sales/returns"
        branch={branches.find((b) => b.id === r.branch_id)?.name} line={<>tanggal {date(r.return_date)}{r.reason ? ` · ${r.reason}` : ""}</>}
        chain={<DocChain steps={chain} />}
        facts={[["Tanggal retur", date(r.return_date)], ["Alasan", r.reason || "–"], ["Kredit ke pelanggan", <span key="k" className="font-num">{rupiah(r.total_amount, true)}</span>], ["Biaya kembali ke stok", <span key="b" className="font-num">{rupiah(r.cogs_reversed, true)}</span>]]}>
        <SectionTitle>Item yang diretur</SectionTitle>
        <ScrollX>
          <table className="tbl ledger min-w-[420px]">
            <thead><tr><th>SKU</th><th className="text-right">Jumlah</th><th className="text-right">Harga satuan</th><th className="text-right">Kredit</th></tr></thead>
            <tbody>
              {r.items.map((i: Row) => <tr key={i.product_id}><td className="code">{i.sku}</td><td className="num">{qty(i.quantity)}</td><td className="num">{rupiah(i.unit_price)}</td><td className="num">{rupiah(num(i.quantity) * num(i.unit_price))}</td></tr>)}
              <tr className="total"><td colSpan={3} className="num font-medium">Total kredit</td><td className="num font-semibold">{rupiah(r.total_amount, true)}</td></tr>
            </tbody>
          </table>
        </ScrollX>
      </DocPaper>
      <div className="mx-auto max-w-read">
        <FolderTabs tabs={[{ key: "Jurnal", label: "Jurnal", glyph: "tinta", count: r.journal_entry_id ? 1 : 0 }, { key: "Riwayat", label: "Riwayat", glyph: "audit" }]} active={tab} onChange={setTab} label="Isi retur">
          {tab === "Jurnal" && <JournalTab ids={r.journal_entry_id ? [r.journal_entry_id] : []} note="Aturan retur: debit 4150 Retur Penjualan dan kredit 1200 Piutang sebesar nilai retur; debit Persediaan dan kredit 5100 HPP sebesar biaya yang dikembalikan." />}
          {tab === "Riwayat" && <HistoryTab entity="sales_return" id={r.id} />}
        </FolderTabs>
      </div>
    </>
  );
}

export function NewReturn() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { branches } = useSession();
  const so = useQuery({ queryKey: ["so", id], queryFn: () => api<Row>(`/sales/orders/${id}`) });
  const prior = useReturns();
  const inv = useInvoiceIndex();
  const products = useQuery({ queryKey: ["products"], queryFn: () => api<Row[]>("/master/products") });
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useCrumb(so.data?.so_no);
  useUnsavedGuard(Object.values(amounts).some((v) => Number(v) > 0) || reason !== "");

  const save = useMutation({
    mutationFn: (items: { product_id: number; quantity: string }[]) => api<Row>(`/sales/orders/${id}/return`, { method: "POST", body: { return_date: when, reason: reason || null, items } }),
    onSuccess: (r) => {
      const stocked = new Set((products.data ?? []).filter((p) => p.product_type !== "SERVICE").map((p) => p.id));
      receipt({
        title: "Retur dicatat", number: r.return_no, journalId: r.journal_entry_id, journalDate: r.return_date,
        lines: [{ label: "Kredit ke pelanggan", value: rupiah(r.total_amount, true) }, { label: "Biaya kembali ke stok", value: rupiah(r.cogs_reversed, true) }],
        stock: r.items.filter((i: Row) => stocked.has(i.product_id)).map((i: Row) => ({ sku: i.sku, change: `+${qty(i.quantity)}` })),
        note: "Barang kembali dengan biaya saat keluar dari gudang.",
      });
      for (const k of ["returns", "sos", "so", "stock", "invoices", "invoice", "overview", "journals", "dash", "palette"]) void qc.invalidateQueries({ queryKey: [k] });
      setConfirm(false);
      nav(`/sales/returns/${r.id}`, { state: { posted: true } });
    },
    onError: (e) => { setConfirm(false); setError(e instanceof Error ? e.message : "Retur tidak bisa dicatat. Coba lagi."); },
  });

  if (so.isError) return <ErrorNote error={so.error} retry={() => so.refetch()} />;
  const d = so.data;
  if (!d) return <DetailSkeleton />;

  const mine = (prior.data ?? []).filter((r) => String(r.so_id) === id);
  const returned = (pid: number) => mine.reduce((s, r) => s + r.items.filter((i: Row) => i.product_id === pid).reduce((t: number, i: Row) => t + num(i.quantity), 0), 0);
  const lines: Row[] = (d.items as Row[]).map((i) => ({ ...i, left: num(i.quantity) - returned(i.product_id) }));
  const picked = lines.filter((l) => num(amounts[l.product_id]) > 0);
  // Pratinjau kredit yang sudah ada di v2: jumlah × harga jual pesanan. Biaya kembali ke stok dihitung sistem saat dicatat.
  const credit = picked.reduce((s, l) => s + num(amounts[l.product_id]) * num(l.unit_price), 0);
  const tooMany = picked.some((l) => num(amounts[l.product_id]) > l.left);
  // Faktur hanya diketahui bila retur sebelumnya untuk pesanan ini menautkannya lewat id.
  const invoice = mine.length ? inv.data?.get(mine[0]!.invoice_id) ?? null : null;
  const branch = branches.find((b) => b.id === d.branch_id)?.name ?? "gudang asal";

  return (
    <>
      <PageHeader title={<>Retur dari <span className="code">{d.so_no}</span></>} sub={`${d.customer_name}${invoice ? ` · faktur ${invoice.invoice_no} · sisa tagihan ${rupiah(invoice.outstanding)}` : ""}. Hanya pesanan yang sudah difaktur yang bisa diretur, dan kredit tidak boleh melebihi sisa tagihan.`} />
      <form onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (picked.length === 0) { setError("Belum ada item yang diretur. Isi jumlah retur pada minimal satu item."); focusFirstError(); return; }
        if (tooMany) { setError("Ada jumlah yang melebihi sisa yang bisa diretur. Kurangi jumlahnya."); focusFirstError(); return; }
        setConfirm(true);
      }}>
        {error && <p role="alert" data-form-error="" tabIndex={-1} className="mb-4 flex items-start gap-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title="Item yang diretur" hint="Hanya jumlah yang belum diretur yang bisa dipilih.">
          <ul className="border-t border-ink">
            {lines.map((l) => {
              const n = num(amounts[l.product_id]);
              const over = n > l.left;
              return (
                <li key={l.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-line py-3 md:grid-cols-[minmax(0,1fr)_72px_96px_184px_112px]">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <span className="code font-medium">{l.sku}</span> · {l.name}
                    <div className="text-table text-muted">{rupiah(l.unit_price)} per unit</div>
                  </div>
                  <div className="text-table text-muted md:text-right">Terjual <span className="font-num text-ink">{qty(l.quantity)}</span></div>
                  <div className="text-table text-muted md:text-right">Bisa diretur <span className="font-num text-ink">{qty(l.left)}</span></div>
                  <span className="col-span-2 md:col-span-1"><Stepper label={`jumlah retur ${l.sku}`} name={`return-qty-${l.product_id}`} value={amounts[l.product_id] ?? ""} max={l.left} disabled={l.left <= 0} invalid={over} onChange={(v) => setAmounts({ ...amounts, [l.product_id]: v })} /></span>
                  <div className="num col-span-2 text-table md:col-span-1">{n > 0 ? rupiah(n * num(l.unit_price)) : "–"}</div>
                  {over && <p role="alert" className="col-span-2 text-table text-bad md:col-span-5">Melebihi sisa yang bisa diretur ({qty(l.left)}). Kurangi jumlahnya.</p>}
                </li>
              );
            })}
          </ul>
        </FormGroup>
        <FormGroup title="Alasan dan tanggal" hint="Alasan tercatat di riwayat retur.">
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Tanggal retur"><input className="field" name="return-date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Alasan"><input className="field" name="reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rusak, barang salah…" /></Field>
          </div>
        </FormGroup>
        <ActionBar summary={<>
          <Impact label="Kredit ke pelanggan" value={credit} />
          {invoice && <Impact label="Sisa tagihan setelah retur" value={num(invoice.outstanding) - credit} />}
          <Impact small label="Biaya stok kembali (FIFO)" value="dihitung sistem saat dicatat" />
        </>}>
          <Link className="btn btn-text" to={`/sales/orders/${id}`}>Batal</Link>
          <Key type="submit" tone="primary" glyph="retur" m={save}>Simpan retur</Key>
        </ActionBar>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Simpan retur untuk ${d.so_no}?`} confirmLabel="Ya, simpan retur" pending={save.isPending}
        impact={[["Kredit ke pelanggan", rupiah(credit, true)], ["Item", `${picked.length} produk`], ...(invoice ? ([["Faktur", invoice.invoice_no]] as [string, string][]) : [])]}
        onConfirm={() => save.mutate(picked.map((l) => ({ product_id: l.product_id, quantity: amounts[l.product_id]! })))}>
        <p className="text-muted">Setelah disimpan, ini tidak bisa diubah:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{invoice ? `Faktur ${invoice.invoice_no} berkurang ${rupiah(credit, true)}.` : `Faktur pesanan ini berkurang ${rupiah(credit, true)}.`}</li>
          <li>Barang berstok kembali ke {branch} dengan biaya saat keluar dari gudang. Jasa tidak memengaruhi stok.</li>
          <li>Jurnal diposting. Koreksi hanya lewat jurnal pembalik.</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
