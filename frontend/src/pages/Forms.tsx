import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActionBar, Field, FormGroup, Impact } from "../components/Form";
import { toast } from "../components/Toaster";
import { PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { num, rupiah, today } from "../lib/format";
import { useSession } from "../lib/session";
import { Key } from "../components/Key";

type Row = Record<string, any>;
interface Line { product_id: string; quantity: string; unit_price: string }
const blank = (): Line => ({ product_id: "", quantity: "1", unit_price: "" });

function useCreate(path: string, back: string, keys: string[]) {
  const nav = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api(path, { method: "POST", body }),
    onSuccess: () => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); toast("Tersimpan."); nav(back); },
    onError: (e) => toast(e instanceof Error ? e.message : "Tidak bisa menyimpan. Coba lagi.", "error"),
  });
}

function LineEditor({ lines, setLines, products, priceKey }: { lines: Line[]; setLines: (l: Line[]) => void; products: Row[]; priceKey: "standard_cost" | "sale_price" }) {
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 items-end gap-x-3 gap-y-2 border-b border-line py-3 first:border-t first:border-ink md:grid-cols-[minmax(0,1fr)_96px_144px_72px]">
          <Field label={i === 0 || true ? "Produk" : ""} className="col-span-2 md:col-span-1">
            <select className="field" name={`product-${i}`} required value={l.product_id} aria-label={`Produk, baris ${i + 1}`}
              onChange={(e) => set(i, { product_id: e.target.value, unit_price: String(products.find((p) => String(p.id) === e.target.value)?.[priceKey] ?? "") })}>
              <option value="">Pilih produk</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
            </select>
          </Field>
          <Field label="Jumlah"><input className="field num" name={`quantity-${i}`} inputMode="decimal" type="number" min="0.0001" step="any" required value={l.quantity} aria-label={`Jumlah, baris ${i + 1}`} onChange={(e) => set(i, { quantity: e.target.value })} /></Field>
          <Field label="Harga satuan"><input className="field num" name={`unit-price-${i}`} inputMode="decimal" type="number" min="0" step="any" required value={l.unit_price} aria-label={`Harga satuan, baris ${i + 1}`} onChange={(e) => set(i, { unit_price: e.target.value })} /></Field>
          <button type="button" className="btn btn-text col-span-2 md:col-span-1" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={`Hapus baris ${i + 1}`}>Hapus</button>
        </div>
      ))}
      <button type="button" className="btn btn-text mt-2" onClick={() => setLines([...lines, blank()])}>Tambah baris</button>
    </div>
  );
}

function OrderForm({ kind }: { kind: "po" | "so" }) {
  const { branches, branchId } = useSession();
  const partyPath = kind === "po" ? "/master/suppliers" : "/master/customers";
  const parties = useQuery({ queryKey: [partyPath], queryFn: () => api<Row[]>(partyPath) });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api<Row[]>("/master/products") });
  const [party, setParty] = useState("");
  const [branch, setBranch] = useState(String(branchId ?? branches.find((b) => b.branch_type !== "HEAD_OFFICE")?.id ?? ""));
  const [when, setWhen] = useState(today());
  const [lines, setLines] = useState<Line[]>([blank()]);
  const back = kind === "po" ? "/procurement/orders" : "/sales/orders";
  const save = useCreate(kind === "po" ? "/procurement/purchase-orders" : "/sales/orders", back, [kind === "po" ? "pos" : "sos", "overview"]);
  const eligible = (products.data ?? []).filter((p) => (kind === "po" ? p.product_type !== "SERVICE" : true));
  const total = lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_price), 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      [kind === "po" ? "supplier_id" : "customer_id"]: Number(party), branch_id: Number(branch), order_date: when,
      items: lines.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity, unit_price: l.unit_price })),
    });
  }
  return (
    <>
      <PageHeader title={kind === "po" ? "Pesanan pembelian baru" : "Pesanan penjualan baru"}
        sub={kind === "po" ? "Disimpan sebagai draf. Ajukan dari daftar untuk memulai persetujuan." : "Disimpan sebagai penawaran. Saat dikonfirmasi, batas kredit diperiksa dan stok dicadangkan."} />
      <form onSubmit={submit}>
        <FormGroup first title={kind === "po" ? "Pemasok dan tujuan" : "Pelanggan dan asal"} hint={kind === "po" ? "Termin pembayaran pemasok menentukan jatuh tempo tagihan." : "Stok dicadangkan dari gudang yang dipilih."}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={kind === "po" ? "Pemasok" : "Pelanggan"}>
              <select className="field" name="party" required value={party} onChange={(e) => setParty(e.target.value)}>
                <option value="">Pilih</option>{(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={kind === "po" ? "Diterima di" : "Dikirim dari"}>
              <select className="field" name="branch" required value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Pilih</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal pesanan"><input className="field" name="order-date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          </div>
        </FormGroup>
        <FormGroup title="Item" hint="Harga satuan terisi dari data produk dan bisa diubah.">
          <LineEditor lines={lines} setLines={setLines} products={eligible} priceKey={kind === "po" ? "standard_cost" : "sale_price"} />
        </FormGroup>
        <ActionBar summary={<Impact label="Total pesanan" value={rupiah(total, true)} />}>
          <Link className="btn btn-text" to={back}>Batal</Link>
          <Key type="submit" tone="primary" glyph="simpan" m={save}>Simpan draf</Key>
        </ActionBar>
      </form>
    </>
  );
}
export const NewPurchaseOrder = () => <OrderForm kind="po" />;
export const NewSalesOrder = () => <OrderForm kind="so" />;

interface JLine { account_code: string; debit: string; credit: string }
export function NewJournal() {
  const { branches, branchId } = useSession();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Row[]>("/accounting/accounts") });
  const [when, setWhen] = useState(today());
  const [branch, setBranch] = useState(String(branchId ?? branches[0]?.id ?? ""));
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<JLine[]>([{ account_code: "", debit: "", credit: "" }, { account_code: "", debit: "", credit: "" }]);
  const save = useCreate("/accounting/journals", "/accounting/journals", ["journals", "overview"]);
  const d = lines.reduce((s, l) => s + num(l.debit), 0);
  const c = lines.reduce((s, l) => s + num(l.credit), 0);
  const ok = Math.abs(d - c) < 0.005 && d > 0;
  const set = (i: number, p: Partial<JLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ entry_date: when, branch_id: Number(branch), description: desc, lines: lines.filter((l) => l.account_code).map((l) => ({ account_code: l.account_code, debit: l.debit || "0", credit: l.credit || "0" })) });
  }
  return (
    <>
      <PageHeader title="Jurnal baru" sub="Total debit harus sama dengan total kredit. Setelah diposting, jurnal hanya bisa dibalik, tidak bisa diubah." />
      <form onSubmit={submit}>
        <FormGroup first title="Dokumen" hint="Tanggal harus jatuh pada periode yang masih terbuka.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tanggal"><input className="field" name="entry-date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Cabang"><select className="field" name="branch" required value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Keterangan" className="sm:col-span-3"><input className="field" name="description" required minLength={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          </div>
        </FormGroup>
        <FormGroup title="Baris jurnal" hint="Isi debit atau kredit pada setiap baris, tidak keduanya.">
          <div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 border-b border-line py-2 first:border-t first:border-ink md:grid-cols-[minmax(0,1fr)_136px_136px]">
                <select className="field col-span-2 md:col-span-1" name={`account-${i}`} aria-label={`Akun, baris ${i + 1}`} value={l.account_code} onChange={(e) => set(i, { account_code: e.target.value })}>
                  <option value="">Pilih akun</option>{(accounts.data ?? []).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </select>
                <input className="field num" name={`debit-${i}`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="Debit" aria-label={`Debit, baris ${i + 1}`} value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                <input className="field num" name={`credit-${i}`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="Kredit" aria-label={`Kredit, baris ${i + 1}`} value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
              </div>
            ))}
            <button type="button" className="btn btn-text mt-2" onClick={() => setLines([...lines, { account_code: "", debit: "", credit: "" }])}>Tambah baris</button>
          </div>
        </FormGroup>
        <ActionBar summary={<><Impact label="Total debit" value={rupiah(d, true)} /><Impact label="Total kredit" value={rupiah(c, true)} /><div className={ok ? "text-good" : "text-warn"} aria-live="polite">{ok ? "Seimbang" : `Selisih ${rupiah(Math.abs(d - c), true)}`}</div></>}>
          <Link className="btn btn-text" to="/accounting/journals">Batal</Link>
          <Key type="submit" tone="primary" glyph="kirim" m={save} disabled={!ok}>Posting jurnal</Key>
        </ActionBar>
      </form>
    </>
  );
}
