import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActionBar, Field, FormGroup, Impact, MoneyInput } from "../components/Form";
import { Key } from "../components/Key";
import { Stepper } from "../components/Stepper";
import { receipt, type ReceiptData } from "../components/Toaster";
import { PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { num, rupiah, today } from "../lib/format";
import { useSession } from "../lib/session";
import { focusFirstError, useUnsavedGuard } from "../lib/useUnsaved";

type Row = Record<string, any>;
interface Line { product_id: string; quantity: string; unit_price: string }
const blank = (): Line => ({ product_id: "", quantity: "1", unit_price: "" });

/** Simpan dokumen baru; struk M2 dari respons API, lalu buka dokumen atau daftarnya. */
function useCreate(path: string, keys: string[], toReceipt: (r: Row) => ReceiptData, after: (r: Row) => string) {
  const nav = useNavigate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Row>(path, { method: "POST", body }),
    onSuccess: (r) => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); receipt(toReceipt(r)); nav(after(r)); },
  });
}

function LineEditor({ lines, setLines, products, priceKey, showErrors }: { lines: Line[]; setLines: (l: Line[]) => void; products: Row[]; priceKey: "standard_cost" | "sale_price"; showErrors: boolean }) {
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div>
      {lines.map((l, i) => {
        const noProduct = showErrors && !l.product_id;
        const badQty = showErrors && !(num(l.quantity) > 0);
        return (
          <div key={i} className="grid grid-cols-2 items-start gap-x-3 gap-y-2 border-b border-line py-3 first:border-t first:border-ink md:grid-cols-[minmax(0,1fr)_200px_160px_72px]">
            <Field label="Produk" className="col-span-2 md:col-span-1" error={noProduct ? "Pilih produk untuk baris ini." : null}>
              <select className="field" name={`product-${i}`} required value={l.product_id} aria-label={`Produk, baris ${i + 1}`} aria-invalid={noProduct || undefined}
                onChange={(e) => set(i, { product_id: e.target.value, unit_price: String(products.find((p) => String(p.id) === e.target.value)?.[priceKey] ?? "") })}>
                <option value="">Pilih produk</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
              </select>
            </Field>
            <Field label="Jumlah" error={badQty ? "Jumlah harus lebih dari nol." : null}>
              <Stepper label={`jumlah baris ${i + 1}`} name={`quantity-${i}`} value={l.quantity} min={0} invalid={badQty} onChange={(v) => set(i, { quantity: v })} />
            </Field>
            <Field label="Harga satuan"><MoneyInput name={`unit-price-${i}`} label={`Harga satuan, baris ${i + 1}`} required value={l.unit_price} onChange={(v) => set(i, { unit_price: v })} /></Field>
            <button type="button" className="btn btn-text col-span-2 mt-6 md:col-span-1" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={`Hapus baris ${i + 1}`}>Hapus baris</button>
          </div>
        );
      })}
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
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useCreate(kind === "po" ? "/procurement/purchase-orders" : "/sales/orders", [kind === "po" ? "pos" : "sos", "overview", "dash", "palette"],
    (r) => ({ title: kind === "po" ? "Draf pesanan pembelian disimpan" : "Penawaran disimpan", number: r.po_no ?? r.so_no, lines: [{ label: "Total", value: rupiah(r.total_amount) }, { label: "Item", value: `${r.items?.length ?? 0} baris` }],
      link: { to: kind === "po" ? `/procurement/orders/${r.id}` : `/sales/orders/${r.id}`, label: "Buka dokumen" } }),
    (r) => (kind === "po" ? `/procurement/orders/${r.id}` : `/sales/orders/${r.id}`));
  const eligible = (products.data ?? []).filter((p) => (kind === "po" ? p.product_type !== "SERVICE" : true));
  const total = lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_price), 0);
  const valid = !!party && !!branch && lines.every((l) => l.product_id && num(l.quantity) > 0 && l.unit_price !== "");
  useUnsavedGuard(!save.isSuccess && (!!party || lines.some((l) => l.product_id)));

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!valid) { focusFirstError(); return; }
    save.mutate({
      [kind === "po" ? "supplier_id" : "customer_id"]: Number(party), branch_id: Number(branch), order_date: when,
      items: lines.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity, unit_price: l.unit_price })),
    }, { onError: (err) => setError(err instanceof Error ? err.message : "Tidak bisa menyimpan. Periksa isian, lalu coba lagi.") });
  }
  return (
    <>
      <PageHeader title={kind === "po" ? "Pesanan pembelian baru" : "Pesanan penjualan baru"}
        sub={kind === "po" ? "Disimpan sebagai draf. Ajukan dari dokumennya untuk memulai persetujuan." : "Disimpan sebagai penawaran. Saat dikonfirmasi, batas kredit diperiksa dan stok dicadangkan."} />
      <form onSubmit={submit} noValidate>
        {error && <p role="alert" data-form-error="" tabIndex={-1} className="mb-4 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title={kind === "po" ? "Pemasok dan tujuan" : "Pelanggan dan asal"} hint={kind === "po" ? "Termin pembayaran pemasok menentukan jatuh tempo tagihan." : "Stok dicadangkan dari gudang yang dipilih."}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={kind === "po" ? "Pemasok" : "Pelanggan"} error={tried && !party ? `Pilih ${kind === "po" ? "pemasok" : "pelanggan"}.` : null}>
              <select className="field" name="party" required value={party} onChange={(e) => setParty(e.target.value)} aria-invalid={(tried && !party) || undefined}>
                <option value="">Pilih</option>{(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={kind === "po" ? "Diterima di" : "Dikirim dari"} error={tried && !branch ? "Pilih gudang." : null}>
              <select className="field" name="branch" required value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Pilih</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal pesanan"><input className="field" name="order-date" type="date" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
          </div>
        </FormGroup>
        <FormGroup title="Item" hint="Harga satuan terisi dari data produk dan bisa diubah.">
          <LineEditor lines={lines} setLines={setLines} products={eligible} priceKey={kind === "po" ? "standard_cost" : "sale_price"} showErrors={tried} />
        </FormGroup>
        <ActionBar summary={<><Impact label="Total pesanan" value={total} /><Impact small label="Baris" value={`${lines.length} item`} /></>}>
          <Link className="btn btn-text" to={kind === "po" ? "/procurement/orders" : "/sales/orders"}>Batal</Link>
          <Key type="submit" tone="primary" glyph="simpan" m={save}>{kind === "po" ? "Simpan draf pesanan" : "Simpan penawaran"}</Key>
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
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<JLine[]>([{ account_code: "", debit: "", credit: "" }, { account_code: "", debit: "", credit: "" }]);
  const save = useCreate("/accounting/journals", ["journals", "overview", "dash"],
    (r) => ({ title: "Jurnal diposting", number: r.entry_no, lines: [{ label: "Total", value: rupiah(r.total, true) }, { label: "Baris", value: `${r.lines?.length ?? 0}` }], journalId: r.id, journalDate: r.entry_date }),
    (r) => `/accounting/journals/${r.id}`);
  const d = lines.reduce((s, l) => s + Math.round(num(l.debit) * 100), 0);
  const c = lines.reduce((s, l) => s + Math.round(num(l.credit) * 100), 0);
  const ok = d === c && d > 0;
  const set = (i: number, p: Partial<JLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  useUnsavedGuard(!save.isSuccess && (desc !== "" || lines.some((l) => l.account_code || l.debit || l.credit)));

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ok) {
      setError(d === 0 ? "Isi jumlah debit dan kredit pada baris jurnal." : `Total debit dan kredit berbeda ${rupiah(Math.abs(d - c) / 100, true)}. Samakan keduanya, lalu posting lagi.`);
      focusFirstError();
      return;
    }
    save.mutate({ entry_date: when, branch_id: Number(branch), description: desc, lines: lines.filter((l) => l.account_code).map((l) => ({ account_code: l.account_code, debit: l.debit || "0", credit: l.credit || "0" })) },
      { onError: (err) => setError(err instanceof Error ? err.message : "Jurnal tidak bisa diposting. Periksa periode dan baris, lalu coba lagi.") });
  }
  return (
    <>
      <PageHeader title="Jurnal baru" sub="Total debit harus sama dengan total kredit. Setelah diposting, jurnal hanya bisa dibalik, tidak bisa diubah." />
      <form onSubmit={submit}>
        {error && <p role="alert" data-form-error="" tabIndex={-1} className="mb-4 border-y border-bad py-3 text-sm text-bad">{error}</p>}
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
              <div key={i} className="grid grid-cols-2 gap-2 border-b border-line py-2 first:border-t first:border-ink md:grid-cols-[minmax(0,1fr)_170px_170px]">
                <select className="field col-span-2 md:col-span-1" name={`account-${i}`} aria-label={`Akun, baris ${i + 1}`} value={l.account_code} onChange={(e) => set(i, { account_code: e.target.value })}>
                  <option value="">Pilih akun</option>{(accounts.data ?? []).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                </select>
                <MoneyInput name={`debit-${i}`} label={`Debit, baris ${i + 1}`} value={l.debit} onChange={(v) => set(i, { debit: v, credit: v ? "" : l.credit })} />
                <MoneyInput name={`credit-${i}`} label={`Kredit, baris ${i + 1}`} value={l.credit} onChange={(v) => set(i, { credit: v, debit: v ? "" : l.debit })} />
              </div>
            ))}
            <button type="button" className="btn btn-text mt-2" onClick={() => setLines([...lines, { account_code: "", debit: "", credit: "" }])}>Tambah baris</button>
          </div>
        </FormGroup>
        <ActionBar summary={<>
          <Impact label="Total debit" value={d / 100} /><Impact label="Total kredit" value={c / 100} />
          <div className={ok ? "self-end font-medium text-good" : "self-end font-medium text-warn"} aria-live="polite">{ok ? "Seimbang" : `Selisih ${rupiah(Math.abs(d - c) / 100, true)}`}</div>
        </>}>
          <Link className="btn btn-text" to="/accounting/journals">Batal</Link>
          <Key type="submit" tone="primary" glyph="tinta" m={save}>Posting jurnal</Key>
        </ActionBar>
      </form>
    </>
  );
}
