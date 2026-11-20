import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { Glyph } from "../components/glyphs";
import { Drawer } from "../components/Layers";
import { LEVEL_GLYPH, LEVEL_TEXT, LEVEL_TONE, levelOf, WarehouseIso, type Level, type StockRow } from "../components/signature/WarehouseIso";
import { Code, ErrorNote, PageHeader, Pencil, SectionTitle } from "../components/ui";
import { FEATURES } from "../config/features";
import { api } from "../lib/api";
import { code, col, money, quantity, type Row } from "../lib/columns";
import { compactRupiah, num, qty, rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import { useList } from "./Lists";
import "../styles/tables.css";

const TYPES: Record<string, string> = { RAW_MATERIAL: "Bahan baku", FINISHED_GOOD: "Barang jadi", SERVICE: "Jasa" };
const SWATCH: Record<Level, string> = { aman: "text-ok", menipis: "text-warn-mark", habis: "text-bad" };

/** Laci produk: fakta produk, saldo per gudang, tautan kartu stok. Lapisan FIFO (M6) ditunda karena API tidak menyediakannya. */
export function ProductDrawer({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  const { branches, can } = useSession();
  const products = useQuery({ queryKey: ["products"], enabled: can("master.read"), queryFn: () => api<Row[]>("/master/products") });
  const bal = useList("stock", "/inventory/balances", {}, false);
  const p = (products.data ?? []).find((x) => x.id === productId);
  const rows = (bal.data ?? []).filter((b) => b.product_id === productId);
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  return (
    <Drawer open={productId !== null} onClose={onClose} title={p ? <Code>{p.sku}</Code> : "Produk"} subtitle={p?.name}
      footer={p && can("inventory.read") && rows[0] ? <Link className="btn" to={`/inventory/movements?produk=${p.id}&gudang=${rows[0].branch_id}`}><Glyph name="kartu-stok" size={18} />Buka kartu stok</Link> : undefined}>
      {!p ? <div className="grid gap-3"><Pencil w={60} /><Pencil w={40} /></div> : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-table">
            <dt className="text-muted">Jenis</dt><dd>{TYPES[p.product_type] ?? p.product_type}</dd>
            <dt className="text-muted">Kategori</dt><dd>{p.category?.name ?? "–"}</dd>
            <dt className="text-muted">Biaya standar</dt><dd className="font-num">{rupiah(p.standard_cost)}</dd>
            <dt className="text-muted">Harga jual</dt><dd className="font-num">{rupiah(p.sale_price)}</dd>
            <dt className="text-muted">Titik pesan ulang</dt><dd className="font-num">{qty(p.reorder_point)} {p.uom}</dd>
            <dt className="text-muted">Stok pengaman</dt><dd className="font-num">{qty(p.safety_stock)} {p.uom}</dd>
          </dl>
          <div className="mt-6 border-t border-line pt-4"><SectionTitle>Stok per gudang</SectionTitle></div>
          {rows.length === 0 ? <p className="text-table text-muted">{p.product_type === "SERVICE" ? "Jasa tidak punya stok." : "Belum ada stok di gudang mana pun."}</p> : (
            <table className="tbl dense">
              <thead><tr><th>Gudang</th><th className="text-right">Tersedia</th><th className="text-right">Fisik</th><th className="text-right">Nilai FIFO</th></tr></thead>
              <tbody>{rows.map((b) => {
                const l = levelOf(b as StockRow);
                return <tr key={b.branch_id}><td>{name(b.branch_id)} <span className={`badge ${LEVEL_TONE[l]} ml-1`}><Glyph name={LEVEL_GLYPH[l]} size={12} />{LEVEL_TEXT[l]}</span></td><td className="num">{qty(b.available)}</td><td className="num">{qty(b.on_hand)}</td><td className="num">{rupiah(b.value)}</td></tr>;
              })}</tbody>
              <tfoot><tr className="total"><td>Total</td><td className="num">{qty(rows.reduce((s, b) => s + num(b.available), 0))}</td><td className="num">{qty(rows.reduce((s, b) => s + num(b.on_hand), 0))}</td><td className="num">{rupiah(rows.reduce((s, b) => s + num(b.value), 0))}</td></tr></tfoot>
            </table>
          )}
          {!FEATURES.fifoStack && <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Glyph name="lapisan" size={16} />Tumpukan lapisan FIFO belum ditampilkan: API belum menyediakan sisa per lapisan. Nilai FIFO di atas berasal dari API.</p>}
        </>
      )}
    </Drawer>
  );
}

/**
 * Level stok (10) dengan M8 Gudang Hidup: sakelar Denah | Daftar (ponsel hanya daftar), filter status yang meredupkan
 * kotak lain menjadi 30%, dan laci produk.
 */
export function Stock() {
  const { branchId, branches, can } = useSession();
  const q = useList("stock", "/inventory/balances", { branch_id: branchId }, false);
  const products = useQuery({ queryKey: ["products"], enabled: can("master.read"), queryFn: () => api<Row[]>("/master/products") });
  // Tampilan dan saringan ada di URL (?tampilan=daftar&status=menipis) agar bisa dibagikan dan dibuka ulang.
  const [sp, setSp] = useSearchParams();
  const view: "denah" | "daftar" = sp.get("tampilan") === "daftar" ? "daftar" : "denah";
  const show: Level | "semua" = (["aman", "menipis", "habis"] as const).find((l) => l === sp.get("status")) ?? "semua";
  const setParam = (k: string, v: string | null) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const setView = (v: "denah" | "daftar") => setParam("tampilan", v === "denah" ? null : v);
  const setShow = (v: Level | "semua") => setParam("status", v === "semua" ? null : v);
  const [open, setOpen] = useState<number | null>(null);
  const cat = useMemo(() => {
    const m = new Map((products.data ?? []).map((p) => [p.id as number, (p.category?.name as string | undefined) ?? "Tanpa kategori"]));
    return (id: number) => m.get(id) ?? "Tanpa kategori";
  }, [products.data]);
  const rows = (q.data ?? []) as StockRow[];
  const counts = rows.reduce<Record<Level, number>>((m, r) => ({ ...m, [levelOf(r)]: m[levelOf(r)] + 1 }), { aman: 0, menipis: 0, habis: 0 });
  const value = rows.reduce((s, r) => s + num(r.value), 0);
  const name = (id: number) => branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const byBranch = [...rows.reduce((m, r) => m.set(r.branch_id, [...(m.get(r.branch_id) ?? []), r]), new Map<number, StockRow[]>()).entries()];
  const listRows = show === "semua" ? rows : rows.filter((r) => levelOf(r) === show);

  return (
    <>
      <PageHeader title="Level stok" sub={q.data ? `${rows.length} baris stok di ${byBranch.length} gudang · ${counts.menipis + counts.habis} perlu perhatian · nilai FIFO ${compactRupiah(value)}. Tersedia = stok fisik dikurangi yang dicadangkan.` : "Memuat stok…"}
        actions={FEATURES.warehouseIso ? <div role="group" aria-label="Tampilan" className="seg max-md:hidden">{(["denah", "daftar"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "denah" ? "Denah" : "Daftar"}</button>)}</div> : undefined} />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : (
        <>
          <div role="group" aria-label="Saring menurut status stok" className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" className="chip-toggle" aria-pressed={show === "semua"} onClick={() => setShow("semua")}>Semua <span className="font-num opacity-70">{rows.length}</span></button>
            {(["aman", "menipis", "habis"] as const).map((l) => (
              <button key={l} type="button" className="chip-toggle" aria-pressed={show === l} onClick={() => setShow(show === l ? "semua" : l)}>
                <Glyph name={LEVEL_GLYPH[l]} size={14} />{LEVEL_TEXT[l]} <span className="font-num opacity-70">{counts[l]}</span>
              </button>
            ))}
          </div>
          {FEATURES.warehouseIso && view === "denah" && (
            <section aria-label="Denah stok" className="mb-6 hidden md:block">
              <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-table text-muted">
                {(["aman", "menipis", "habis"] as const).map((l) => <span key={l} className={`inline-flex items-center gap-1.5 ${SWATCH[l]}`}><span aria-hidden className="inline-block h-2.5 w-2.5 bg-current" /><Glyph name={LEVEL_GLYPH[l]} size={14} /><span className="text-ink">{LEVEL_TEXT[l]}</span></span>)}
                <span>Isi penuh = 2 × titik pesan ulang. Disusun per kategori, bukan denah fisik. Panah berpindah antar kotak, Enter membuka produk.</span>
              </p>
              {q.isLoading ? <div className="sheet h-64 p-6"><Pencil w={30} /></div> : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {byBranch.map(([id, r]) => (
                    <figure key={id} className="sheet min-w-0 px-4 py-4">
                      <figcaption className="mb-1 flex items-baseline justify-between text-table"><span className="font-medium">{name(id)}</span><span className="text-muted">{r.length} produk · {r.filter((x) => levelOf(x) !== "aman").length} perlu perhatian</span></figcaption>
                      <WarehouseIso rows={r} categoryOf={cat} title={`Denah ${name(id)}`} show={show} onOpen={(x) => setOpen(x.product_id)} />
                    </figure>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className={FEATURES.warehouseIso && view === "denah" ? "md:hidden" : undefined}>
            <DataTable<Row> key={show} label="Level stok" data={listRows as Row[]} loading={q.isLoading} onOpen={(r) => setOpen(r.product_id)} emptyArt="rak-kosong"
              empty={show === "semua" ? "Belum ada stok. Stok muncul setelah barang diterima atau dirakit." : `Tidak ada stok berstatus ${LEVEL_TEXT[show as Level].toLowerCase()}.`}
              columns={[code("SKU", "sku"), col("Produk", "name", { m: "s" }), col("Gudang", "branch_id", { cell: (c) => name(c.getValue()), filterFn: (r, id, v) => name(r.getValue(id)).toLowerCase().includes(String(v).toLowerCase()), m: "d" }),
                quantity("Stok fisik", "on_hand", "x"), quantity("Dicadangkan", "reserved", "x"),
                col("Tersedia", "available", { right: true, m: "v", cell: (c) => { const l = levelOf(c.row.original as StockRow); return <span className={l === "aman" ? "font-num" : "font-num font-medium text-warn"}>{qty(c.getValue())}{l !== "aman" && <span className={`badge ${LEVEL_TONE[l]} ml-2`}><Glyph name={LEVEL_GLYPH[l]} size={12} />{LEVEL_TEXT[l]}</span>}</span>; } }),
                money("Nilai FIFO", "value", "x")]} />
          </div>
        </>
      )}
      <ProductDrawer productId={open} onClose={() => setOpen(null)} />
    </>
  );
}
