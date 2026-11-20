import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Glyph } from "../components/glyphs";
import { Key } from "../components/Key";
import { useRoomBack } from "../components/RoomLink";
import { ScrollX } from "../components/ScrollX";
import { useCrumb } from "../components/Shell";
import { DocChain, type ChainStep } from "../components/signature/DocChain";
import { InkThreads } from "../components/signature/InkThreads";
import { FolderTabs } from "../components/Tabs";
import { Cap, Code, DetailSkeleton, ErrorNote, Pencil, SectionTitle } from "../components/ui";
import { canReturn, PO_STEPS, ReturnLink, returnable, RowActions, SO_STEPS, usePayInvoice, useTransition, type Row } from "../lib/actions";
import { api } from "../lib/api";
import { date, dateTime, num, qty, rupiah } from "../lib/format";
import { useJournal } from "../lib/journals";
import { activityPhrase } from "../lib/labels";
import { useInvoiceIndex, useReceipts, useReturns } from "../lib/relations";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { roomName, takeRoom } from "../motion/viewTransition";
import "../styles/tables.css";

/**
 * Detail dokumen (10): tampil seperti kertas asli. Kop (nama aplikasi dan cabang; API tidak punya pengaturan nama usaha),
 * jenis dan nomor dokumen, tanggal, pihak, tabel item, total dengan garis ganda, cap status, Rantai Dokumen (M5),
 * dan tab map berkas (Item; Jurnal dengan M1; Riwayat sebagai linimasa titik tinta).
 */
export function DocPaper({ kind, number, room, line, status, actions, chain, facts, children, backTo, branch, landStamp }: {
  kind: string; number: string; room: string; line: ReactNode; status: string; actions?: ReactNode; chain?: ReactNode; facts: [string, ReactNode][]; children?: ReactNode; backTo: string; branch?: string;
  /** Dokumen baru saja diposting dari form: cap mendarat sekali (M2 langkah 3). */
  landStamp?: boolean;
}) {
  const h1 = useRef<HTMLHeadingElement>(null);
  const back = useRoomBack(backTo);
  const target = takeRoom(room);
  return (
    <article className="sheet doc-paper mx-auto max-w-read px-5 pb-7 pt-5 md:px-9" aria-label={`${kind} ${number}`}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3 text-table text-muted print:border-ink">
        <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded bg-brand font-serif text-xs font-semibold text-surface" aria-hidden="true">A</span><span className="font-serif font-semibold text-ink">AetherERP</span>{branch && <span>· {branch}</span>}</span>
        <button type="button" className="btn btn-text btn-sm print:hidden" onClick={() => back({ source: h1.current, room })}><Glyph name="kembali" size={16} />Kembali ke daftar</button>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-table text-muted">{kind}</p>
          <h1 ref={h1} tabIndex={-1} data-room-target={target ? "" : undefined} style={target ? { viewTransitionName: target } : undefined} className="font-serif text-xl font-medium outline-none max-md:text-[26px]"><Code>{number}</Code></h1>
          <p className="mt-1 text-table text-muted">{line}</p>
        </div>
        <Cap value={status} seed={number} className="mt-2" land={landStamp} />
      </div>
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      {chain && <div className="mt-5 border-t border-line pt-3 print:hidden">{chain}</div>}
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 md:order-1">{children}</div>
        <aside className="md:order-2" aria-label="Fakta dokumen">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-table md:grid-cols-1 md:gap-y-0">
            {facts.map(([k, v]) => <div key={k} className="contents md:block md:border-b md:border-line md:py-2"><dt className="text-muted">{k}</dt><dd className="font-medium md:mt-0.5">{v}</dd></div>)}
          </dl>
        </aside>
      </div>
    </article>
  );
}

export const ItemsTable = ({ rows, receivedCol }: { rows: Row[]; receivedCol?: boolean }) => {
  const total = rows.reduce((s, i) => s + num(i.quantity) * num(i.unit_price), 0);
  return (
    <ScrollX><table className="tbl ledger">
      <thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Jumlah</th>{receivedCol && <th className="text-right">Diterima</th>}<th className="text-right">Harga satuan</th><th className="text-right">Jumlah harga</th></tr></thead>
      <tbody>
        {rows.map((i, k) => (
          <tr key={i.id ?? k}><td className="code">{i.sku}</td><td>{i.name}</td><td className="num">{qty(i.quantity)}</td>{receivedCol && <td className="num">{qty(i.received_qty)}</td>}<td className="num">{rupiah(i.unit_price)}</td><td className="num">{rupiah(num(i.quantity) * num(i.unit_price))}</td></tr>
        ))}
        <tr className="total"><td colSpan={receivedCol ? 5 : 4} className="num font-medium">Total</td><td className="num font-semibold">{rupiah(total)}</td></tr>
      </tbody>
    </table></ScrollX>
  );
};

/** Jurnal yang tertaut lewat id (retur → journal_entry_id) dengan Jejak Tinta. */
function JournalById({ id }: { id: number }) {
  const q = useJournal(id);
  if (q.isLoading) return <div className="grid gap-3"><Pencil w={50} /><Pencil w={70} /></div>;
  if (!q.data) return <p className="text-muted">Jurnal #{id} tidak ditemukan di daftar jurnal.</p>;
  return <InkThreads journal={q.data} />;
}
export function JournalTab({ ids, note }: { ids: number[]; note: string }) {
  const { can } = useSession();
  if (!can("accounting.read")) return <p className="text-muted">Jurnal hanya tampil untuk pengguna dengan izin akuntansi.</p>;
  return (
    <div className="grid gap-8">
      {ids.map((id) => <JournalById key={id} id={id} />)}
      <p className="max-w-prose text-table text-muted">{note}</p>
    </div>
  );
}

/** Riwayat sebagai linimasa buku catatan dengan titik tinta di margin. */
export function HistoryTab({ entity, id }: { entity: string; id: number }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: ["audit", "doc", entity, id], enabled: can("audit.read"), queryFn: async () => (await api<Page<Row>>("/audit-logs", { params: { entity_type: entity, page_size: 200 } })).items });
  if (!can("audit.read")) return <p className="text-muted">Riwayat lengkap hanya tampil untuk pengguna dengan izin audit.</p>;
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  if (q.isLoading) return <div className="grid gap-3"><Pencil w={40} /><Pencil w={55} /></div>;
  const rows = (q.data ?? []).filter((a) => String(a.entity_id) === String(id));
  if (!rows.length) return <p className="text-muted">Belum ada riwayat tercatat untuk dokumen ini.</p>;
  return <Timeline items={rows.map((a) => ({ id: a.id, title: activityPhrase(a.action, a.entity_type), who: a.user ?? "Sistem", at: a.created_at }))} />;
}
export function Timeline({ items }: { items: { id: number | string; title: ReactNode; who?: string; at: string }[] }) {
  return (
    <ol className="relative ml-2 border-l border-accent/25 pl-5">
      {items.map((t) => (
        <li key={t.id} className="relative pb-4 last:pb-0 [contain-intrinsic-size:auto_52px] [content-visibility:auto]">
          <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-ink" />
          <p className="text-table font-medium">{t.title}</p>
          <p className="text-xs text-muted">{t.who ? `${t.who} · ` : ""}<time dateTime={t.at} title={dateTime(t.at)}>{dateTime(t.at)}</time></p>
        </li>
      ))}
    </ol>
  );
}

type DocTab = "Item" | "Jurnal" | "Riwayat";

export function SalesOrderDetail() {
  const { id } = useParams();
  const { can, branches } = useSession();
  const q = useQuery({ queryKey: ["so", id], queryFn: () => api<Row>(`/sales/orders/${id}`) });
  const run = useTransition(["so", "sos"], "/sales/orders");
  const returns = useReturns();
  const invoices = useInvoiceIndex();
  const [tab, setTab] = useState<DocTab>("Item");
  useCrumb(q.data?.so_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <DetailSkeleton />;

  const mine = (returns.data ?? []).filter((r) => r.so_id === d.id);
  // Faktur hanya diketahui lewat id yang dikembalikan retur pesanan ini (bukan ditebak dari pelanggan, tanggal, atau jumlah).
  const invIds = [...new Set(mine.map((r) => r.invoice_id as number))];
  const linkedInv = invIds.map((i) => invoices.data?.get(i)).filter(Boolean) as Row[];
  const after = (s: string[]) => s.includes(d.status);
  const chain: ChainStep[] = [
    { key: "so", label: "Pesanan", glyph: "pesanan-penjualan", state: "current", docs: [{ id: d.id, number: d.so_no, date: d.order_date, status: d.status }] },
    { key: "do", label: "Pengiriman", glyph: "pengiriman", docs: [], state: after(["DELIVERED", "INVOICED", "PARTIALLY_PAID", "PAID"]) ? "unlinked" : "missing" },
    { key: "inv", label: "Faktur", glyph: "faktur", docs: linkedInv.map((i) => ({ id: i.id, number: i.invoice_no, date: i.invoice_date, status: i.status, to: `/accounting/invoices/${i.id}`, room: roomName("inv", i.id) })),
      state: linkedInv.length ? "done" : after(["INVOICED", "PARTIALLY_PAID", "PAID"]) ? "unlinked" : "missing" },
    { key: "ret", label: "Retur", glyph: "retur", docs: mine.map((r) => ({ id: r.id, number: r.return_no, date: r.return_date, to: `/sales/returns/${r.id}`, room: roomName("ret", r.id) })),
      state: mine.length ? "done" : "missing", action: !mine.length && returnable(d.status) && canReturn(can) ? { label: "Buat retur", to: `/sales/orders/${d.id}/return` } : undefined },
  ];
  const branch = branches.find((b) => b.id === d.branch_id)?.name;

  return (
    <>
      <DocPaper kind="Pesanan penjualan" number={d.so_no} room={roomName("so", d.id)} status={d.status} backTo="/sales/orders" branch={branch}
        line={<>{d.customer_name} · dipesan {date(d.order_date)}</>}
        actions={<RowActions row={d} steps={SO_STEPS} run={run} size="md" extra={returnable(d.status) ? <ReturnLink id={d.id} size="md" /> : undefined} />}
        chain={<DocChain steps={chain} />}
        facts={[["Pelanggan", d.customer_name], ["Tanggal pesanan", date(d.order_date)], ["Total pesanan", <span key="t" className="font-num">{rupiah(d.total_amount)}</span>], ["Retur", mine.length ? `${mine.length} retur` : "Belum ada"],
          ["Aksi di tahap ini", <span key="a" className="font-normal text-muted">{d.status === "QUOTATION" ? "Konfirmasi memeriksa batas kredit dan mencadangkan stok." : d.status === "CONFIRMED_SO" ? "Kirim memotong stok secara FIFO dan mencatat harga pokok." : d.status === "DELIVERED" ? "Buat faktur untuk menagih pelanggan." : returnable(d.status) ? "Catat retur, atau bayar dari halaman fakturnya." : "Tidak ada aksi yang tersedia."}</span>]]}>
        <SectionTitle>Item</SectionTitle>
        <ItemsTable rows={d.items} />
      </DocPaper>
      <div className="mx-auto max-w-read">
        <FolderTabs tabs={[{ key: "Item", label: "Faktur pelanggan", glyph: "faktur" }, { key: "Jurnal", label: "Jurnal", glyph: "tinta", count: mine.length }, { key: "Riwayat", label: "Riwayat", glyph: "audit" }]} active={tab} onChange={setTab} label="Isi dokumen">
          {tab === "Item" && <CustomerInvoices customerId={d.customer_id} name={d.customer_name} />}
          {tab === "Jurnal" && <JournalTab ids={mine.map((r) => r.journal_entry_id).filter(Boolean)} note="API hanya menautkan jurnal retur ke pesanan (lewat id). Jurnal pengiriman, faktur, dan pembayaran ada di Jurnal umum, dan setiap aksi menampilkan nomornya di struk." />}
          {tab === "Riwayat" && <HistoryTab entity="sales_order" id={d.id} />}
        </FolderTabs>
      </div>
    </>
  );
}

/**
 * Faktur milik pelanggan ini (relasi id: customer_id). Bukan "faktur pesanan ini": API tidak menautkan pesanan ke fakturnya.
 * Pembayaran penuh tetap bisa dilakukan dari sini, seperti di v2, tanpa menebak faktur yang mana.
 */
function CustomerInvoices({ customerId, name }: { customerId: number; name: string }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: ["invoices", { customer: customerId }], enabled: can("accounting.read"), queryFn: async () => (await api<Page<Row>>("/invoices", { params: { type: "AR", page_size: 200 } })).items.filter((i) => i.customer_id === customerId) });
  const pay = usePayInvoice();
  if (!can("accounting.read")) return <p className="text-muted">Faktur hanya tampil untuk pengguna dengan izin akuntansi.</p>;
  if (q.isLoading) return <div className="grid gap-3"><Pencil w={60} /><Pencil w={40} /></div>;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-muted">Belum ada faktur untuk {name}.</p>;
  return (
    <>
      <p className="mb-2 text-table text-muted">Semua faktur {name}. API tidak menautkan pesanan ke fakturnya, jadi pilih fakturnya sendiri.</p>
      <ScrollX><table className="tbl">
        <thead><tr><th>Faktur</th><th>Tanggal</th><th>Jatuh tempo</th><th className="text-right">Sisa</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((i) => (
          <tr key={i.id}><td className="code">{i.invoice_no}</td><td>{date(i.invoice_date)}</td><td>{date(i.due_date)}</td><td className="num">{rupiah(i.outstanding)}</td><td><Cap small value={i.status} seed={i.invoice_no} /></td>
            <td className="text-right">{can("payments.write") && i.status !== "PAID" && <Key size="sm" tone="primary" glyph="simpan" m={pay.variables?.id === i.id ? pay : undefined} onClick={() => pay.mutate(i)}>Bayar penuh</Key>}</td></tr>
        ))}</tbody>
      </table></ScrollX>
    </>
  );
}

export function PurchaseOrderDetail() {
  const { id } = useParams();
  const { branches } = useSession();
  const q = useQuery({ queryKey: ["po", id], queryFn: () => api<Row>(`/procurement/purchase-orders/${id}`) });
  const run = useTransition(["po", "pos"], "/procurement/purchase-orders");
  const grns = useReceipts(q.data?.id);
  const [tab, setTab] = useState<DocTab>("Item");
  useCrumb(q.data?.po_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <DetailSkeleton />;
  const after = (s: string[]) => s.includes(d.status);
  const chain: ChainStep[] = [
    { key: "po", label: "Pesanan", glyph: "pesanan-pembelian", state: "current", docs: [{ id: d.id, number: d.po_no, date: d.order_date, status: d.status }] },
    { key: "grn", label: "Penerimaan", glyph: "penerimaan-barang", docs: (grns.data ?? []).map((g) => ({ id: g.id, number: g.grn_no, date: g.received_date })), state: grns.data?.length ? "done" : "missing" },
    { key: "bill", label: "Tagihan", glyph: "faktur", docs: [], state: after(["BILLED", "PAID"]) ? "unlinked" : "missing" },
  ];
  return (
    <>
      <DocPaper kind="Pesanan pembelian" number={d.po_no} room={roomName("po", d.id)} status={d.status} backTo="/procurement/orders" branch={branches.find((b) => b.id === d.branch_id)?.name}
        line={<>{d.supplier_name} · dipesan {date(d.order_date)}</>}
        actions={<RowActions row={d} steps={PO_STEPS} run={run} size="md" />}
        chain={<DocChain steps={chain} />}
        facts={[["Pemasok", d.supplier_name], ["Tanggal pesanan", date(d.order_date)], ["Total pesanan", <span key="t" className="font-num">{rupiah(d.total_amount)}</span>], ["Disetujui oleh", d.approved_by ? `Pengguna #${d.approved_by}` : "Belum"], ["Penerimaan", grns.data ? `${grns.data.length} dokumen` : "…"]]}>
        <SectionTitle>Item</SectionTitle>
        <ItemsTable rows={d.items} receivedCol />
      </DocPaper>
      <div className="mx-auto max-w-read">
        <FolderTabs tabs={[{ key: "Item", label: "Penerimaan", glyph: "penerimaan-barang", count: grns.data?.length ?? 0 }, { key: "Jurnal", label: "Jurnal", glyph: "tinta", count: 0 }, { key: "Riwayat", label: "Riwayat", glyph: "audit" }]} active={tab} onChange={setTab} label="Isi dokumen">
          {tab === "Item" && ((grns.data ?? []).length ? (
            <ScrollX><table className="tbl"><thead><tr><th>Penerimaan</th><th>Tanggal</th><th className="text-right">Nilai</th></tr></thead>
              <tbody>{grns.data!.map((g) => <tr key={g.id}><td className="code">{g.grn_no}</td><td>{date(g.received_date)}</td><td className="num">{rupiah(g.total_value)}</td></tr>)}</tbody></table></ScrollX>
          ) : <p className="text-muted">Belum ada barang yang diterima untuk pesanan ini.</p>)}
          {tab === "Jurnal" && <JournalTab ids={[]} note="API tidak menautkan jurnal penerimaan atau tagihan ke pesanan pembelian (lewat id). Nomor jurnalnya tampil di struk saat aksi dilakukan dan ada di Jurnal umum." />}
          {tab === "Riwayat" && <HistoryTab entity="purchase_order" id={d.id} />}
        </FolderTabs>
      </div>
    </>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useSession();
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => api<Row>(`/invoices/${id}`) });
  const returns = useReturns();
  const pay = usePayInvoice();
  const [tab, setTab] = useState<DocTab>("Item");
  useCrumb(q.data?.invoice_no);
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return <DetailSkeleton />;
  const ar = d.type === "AR";
  const mine = (returns.data ?? []).filter((r) => r.invoice_id === d.id);
  const soId = mine[0]?.so_id as number | undefined;
  const chain: ChainStep[] = [
    { key: "src", label: ar ? "Pesanan" : "Pesanan pembelian", glyph: ar ? "pesanan-penjualan" : "pesanan-pembelian",
      docs: soId ? [{ id: soId, number: d.reference ?? `#${soId}`, to: `/sales/orders/${soId}`, room: roomName("so", soId) }] : [], state: soId ? "done" : d.reference ? "unlinked" : "missing" },
    { key: "inv", label: ar ? "Faktur" : "Tagihan", glyph: "faktur", state: "current", docs: [{ id: d.id, number: d.invoice_no, date: d.invoice_date, status: d.status }] },
    { key: "pay", label: "Pembayaran", glyph: "simpan", docs: d.payments.map((p: Row) => ({ id: p.payment_no, number: p.payment_no, date: p.payment_date })), state: d.payments.length ? "done" : "missing" },
    ...(ar ? [{ key: "ret", label: "Retur", glyph: "retur" as const, docs: mine.map((r) => ({ id: r.id, number: r.return_no, date: r.return_date, to: `/sales/returns/${r.id}`, room: roomName("ret", r.id) })), state: (mine.length ? "done" : "missing") as ChainStep["state"] }] : []),
  ];
  return (
    <>
      <DocPaper kind={ar ? "Faktur piutang" : "Tagihan pemasok"} number={d.invoice_no} room={roomName("inv", d.id)} status={d.status} backTo="/accounting/invoices" branch={d.branch_name ?? undefined}
        line={<>{d.party?.name ?? ""} · tanggal {date(d.invoice_date)} · jatuh tempo {date(d.due_date)}</>}
        actions={<>
          <button className="btn btn-text" onClick={() => window.print()}><Glyph name="cetak" size={18} />Cetak faktur</button>
          {can("payments.write") && d.status !== "PAID" && <Key tone="primary" glyph="simpan" m={pay} onClick={() => pay.mutate(d)}>Bayar penuh</Key>}
        </>}
        chain={<DocChain steps={chain} />}
        facts={[[ar ? "Pelanggan" : "Pemasok", d.party?.name ?? "–"], ...(d.party?.tax_id ? ([["NPWP", <span key="n" className="code">{d.party.tax_id}</span>]] as [string, ReactNode][]) : []),
          [ar ? "Referensi pesanan" : "Referensi pesanan pembelian", d.reference ? <Code key="r">{d.reference}</Code> : "–"], ["Jatuh tempo", date(d.due_date)],
          ["Total", <span key="t" className="font-num">{rupiah(d.total_amount, true)}</span>], ["Dibayar", <span key="p" className="font-num">{rupiah(d.paid_amount, true)}</span>], ["Sisa tagihan", <b key="o" className="font-num">{rupiah(d.outstanding, true)}</b>]]}>
        <SectionTitle>Item</SectionTitle>
        <ScrollX><table className="tbl ledger"><thead><tr><th>SKU</th><th>Produk</th><th className="text-right">Jumlah</th><th className="text-right">Harga satuan</th><th className="text-right">Jumlah harga</th></tr></thead>
          <tbody>{d.lines.map((l: Row, i: number) => (<tr key={i}><td className="code">{l.sku}</td><td>{l.name}</td><td className="num">{qty(l.quantity)}</td><td className="num">{rupiah(l.unit_price, true)}</td><td className="num">{rupiah(l.amount, true)}</td></tr>))}
            <tr className="total"><td colSpan={4} className="num font-medium">Total faktur</td><td className="num font-semibold">{rupiah(d.total_amount, true)}</td></tr></tbody></table></ScrollX>
        {d.payments.length > 0 && (<>
          <h2 className="mb-2 mt-8 text-table font-semibold">Pembayaran</h2>
          <ScrollX><table className="tbl dense"><tbody>{d.payments.map((p: Row) => (<tr key={p.payment_no}><td>{date(p.payment_date)}</td><td className="code">{p.payment_no}</td><td>{p.method === "BANK_TRANSFER" ? "Transfer bank" : p.method}</td><td className="num">{rupiah(p.amount, true)}</td></tr>))}</tbody></table></ScrollX>
        </>)}
      </DocPaper>
      <div className="mx-auto max-w-read print:hidden">
        <FolderTabs tabs={[{ key: "Item", label: "Retur", glyph: "retur", count: mine.length }, { key: "Jurnal", label: "Jurnal", glyph: "tinta", count: mine.length }, { key: "Riwayat", label: "Riwayat", glyph: "audit" }]} active={tab} onChange={setTab} label="Isi dokumen">
          {tab === "Item" && (mine.length ? (
            <ScrollX><table className="tbl"><thead><tr><th>Retur</th><th>Tanggal</th><th className="text-right">Kredit</th><th className="text-right">Biaya kembali</th></tr></thead>
              <tbody>{mine.map((r) => <tr key={r.id}><td className="code">{r.return_no}</td><td>{date(r.return_date)}</td><td className="num">{rupiah(r.total_amount, true)}</td><td className="num">{rupiah(r.cogs_reversed, true)}</td></tr>)}</tbody></table></ScrollX>
          ) : <p className="text-muted">Belum ada retur untuk faktur ini.</p>)}
          {tab === "Jurnal" && <JournalTab ids={mine.map((r) => r.journal_entry_id).filter(Boolean)} note="API menautkan jurnal retur ke faktur (lewat id). Jurnal faktur dan pembayaran tidak membawa id dokumen; nomornya tampil di struk saat aksi dilakukan dan ada di Jurnal umum." />}
          {tab === "Riwayat" && <HistoryTab entity="invoice" id={d.id} />}
        </FolderTabs>
      </div>
    </>
  );
}
