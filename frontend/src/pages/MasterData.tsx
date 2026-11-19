import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup, MoneyInput } from "../components/Form";
import { Key, KeyLink } from "../components/Key";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { code, col, money, quantity, type Row } from "../lib/columns";
import { useSession } from "../lib/session";
import { ProductDrawer } from "./StockLevel";

function MasterList({ title, sub, path, queryKey, columns, newTo, newLabel, empty, onOpen }: { title: string; sub: string; path: string; queryKey: string; columns: ColumnDef<Row, any>[]; newTo: string; newLabel: string; empty: string; onOpen?: (r: Row) => void }) {
  const { can } = useSession();
  const q = useQuery({ queryKey: [queryKey], queryFn: () => api<Row[]>(path) });
  const add = can("master.write") ? <KeyLink tone="primary" glyph="buat" to={newTo}>{newLabel}</KeyLink> : undefined;
  return (
    <>
      <PageHeader title={title} sub={q.data ? `${q.data.length} data. ${sub}` : sub} actions={add} cta />
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : <DataTable<Row> selectable label={title} data={q.data ?? []} columns={columns} loading={q.isLoading} empty={empty} onOpen={onOpen} emptyAction={add && <Link className="btn btn-sm" to={newTo}>{newLabel}</Link>} />}
    </>
  );
}

const TYPES: [string, string][] = [["RAW_MATERIAL", "Bahan baku"], ["FINISHED_GOOD", "Barang jadi"], ["SERVICE", "Jasa"]];
const PRODUCT_TYPE: Record<string, string> = Object.fromEntries(TYPES);

/** Produk; ?buka=<id> (dari palet perintah) membuka laci produk. */
export function Products() {
  const [sp, setSp] = useSearchParams();
  const open = sp.get("buka");
  const set = (id: number | null) => setSp((p) => { const n = new URLSearchParams(p); if (id) n.set("buka", String(id)); else n.delete("buka"); return n; }, { replace: true });
  return (
    <>
      <MasterList title="Produk" sub="Bahan baku, barang jadi, dan jasa. Titik pesan ulang menentukan peringatan stok rendah." path="/master/products" queryKey="products" newTo="/master/products/new" newLabel="Tambah produk" empty="Belum ada produk."
        onOpen={(r) => set(r.id)}
        columns={[code("SKU", "sku"), col("Nama", "name", { m: "s" }), col("Kategori", "category", { m: "x", cell: (c) => c.getValue()?.name ?? "–", enableColumnFilter: false }), col("Jenis", "product_type", { cell: (c) => PRODUCT_TYPE[String(c.getValue())] ?? String(c.getValue()), m: "x" }), col("Satuan", "uom", { m: "x" }),
          money("Biaya standar", "standard_cost", "x"), money("Harga jual", "sale_price", "v"), quantity("Titik pesan ulang", "reorder_point", "x")]} />
      <ProductDrawer productId={open ? Number(open) : null} onClose={() => set(null)} />
    </>
  );
}
export const Suppliers = () => (
  <MasterList title="Pemasok" sub="Termin pembayaran menentukan jatuh tempo tagihan pemasok." path="/master/suppliers" queryKey="suppliers" newTo="/master/suppliers/new" newLabel="Tambah pemasok" empty="Belum ada pemasok."
    columns={[code("Kode", "code"), col("Nama", "name", { m: "s" }), col("NPWP", "tax_id", { m: "x", code: true }), col("Email", "email", { m: "x" }), col("Termin (hari)", "payment_term_days", { right: true, m: "v" })]} />
);
export const Customers = () => (
  <MasterList title="Pelanggan" sub="Batas kredit diperiksa setiap kali pesanan penjualan dikonfirmasi." path="/master/customers" queryKey="customers" newTo="/sales/customers/new" newLabel="Tambah pelanggan" empty="Belum ada pelanggan."
    columns={[code("Kode", "code"), col("Nama", "name", { m: "s" }), col("Segmen", "segment", { m: "x" }), money("Batas kredit", "credit_limit", "v"), col("Termin (hari)", "payment_term_days", { right: true, m: "x" })]} />
);

interface FieldDef { name: string; label: string; type?: "text" | "number" | "email" | "select" | "money" | "code"; options?: [string, string][]; required?: boolean; hint?: string }
interface Group { title: string; hint?: string; fields: FieldDef[] }

function MasterForm({ title, sub, path, back, keys, groups, initial, saveLabel }: { title: string; sub: string; path: string; back: string; keys: string[]; groups: Group[]; initial: Record<string, string>; saveLabel: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Row) => api(path, { method: "POST", body }),
    onSuccess: () => { keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); toast(`${title.replace(/ baru$/, "")} disimpan.`); nav(back); },
    onError: (e) => setError(e instanceof Error ? e.message : "Tidak bisa menyimpan. Periksa isian, lalu coba lagi."),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Row = {};
    for (const g of groups) for (const f of g.fields) {
      const raw = v[f.name] ?? "";
      if (raw === "" && !f.required) continue;
      body[f.name] = raw; // angka tetap string: API mengurai desimal persis
    }
    save.mutate(body);
  }
  return (
    <>
      <PageHeader title={title} sub={sub} />
      <form onSubmit={submit}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        {groups.map((g, gi) => (
          <FormGroup key={g.title} first={gi === 0} title={g.title} hint={g.hint}>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((f) => (
                <Field key={f.name} label={`${f.label}${f.required ? " *" : ""}`} hint={f.hint}>
                  {f.type === "select" ? (
                    <select className="field" name={f.name} required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                      {f.options!.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  ) : f.type === "money" ? (
                    <MoneyInput name={f.name} label={f.label} required={f.required} value={v[f.name] ?? ""} onChange={(x) => setV({ ...v, [f.name]: x })} />
                  ) : (
                    <input className={`field ${f.type === "number" ? "num" : ""} ${f.type === "code" ? "code" : ""}`} name={f.name} autoComplete="off" spellCheck={f.type === "email" || f.type === "code" ? false : undefined} inputMode={f.type === "number" ? "decimal" : undefined} type={f.type === "number" || f.type === "email" ? f.type : "text"}
                      min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined} required={f.required} value={v[f.name] ?? ""} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
          </FormGroup>
        ))}
        <ActionBar>
          <Link className="btn btn-text" to={back}>Batal</Link>
          <Key type="submit" tone="primary" glyph="simpan" m={save}>{saveLabel}</Key>
        </ActionBar>
      </form>
    </>
  );
}

export const NewProduct = () => (
  <MasterForm title="Produk baru" saveLabel="Simpan produk" sub="SKU harus unik dan tidak bisa dipakai ulang." path="/master/products" back="/master/products" keys={["products"]} initial={{ product_type: "FINISHED_GOOD", uom: "PCS" }}
    groups={[
      { title: "Identitas", hint: "Cara produk dikenali di dokumen.", fields: [{ name: "sku", label: "SKU", type: "code", required: true }, { name: "name", label: "Nama", required: true }, { name: "product_type", label: "Jenis", type: "select", options: TYPES, required: true }, { name: "uom", label: "Satuan" }] },
      { title: "Harga", hint: "Biaya standar menjadi harga bawaan di pesanan pembelian.", fields: [{ name: "standard_cost", label: "Biaya standar", type: "money" }, { name: "sale_price", label: "Harga jual", type: "money" }] },
      { title: "Stok", hint: "Stok pada atau di bawah titik pesan ulang ditandai kritis.", fields: [{ name: "reorder_point", label: "Titik pesan ulang", type: "number" }, { name: "safety_stock", label: "Stok pengaman", type: "number" }] },
    ]} />
);
export const NewSupplier = () => (
  <MasterForm title="Pemasok baru" saveLabel="Simpan pemasok" sub="Termin pembayaran menentukan berapa hari setelah tanggal tagihan pembayaran jatuh tempo." path="/master/suppliers" back="/master/suppliers" keys={["suppliers"]} initial={{ payment_term_days: "30" }}
    groups={[
      { title: "Identitas", fields: [{ name: "code", label: "Kode", type: "code", required: true }, { name: "name", label: "Nama", required: true }, { name: "tax_id", label: "NPWP", type: "code" }] },
      { title: "Kontak", fields: [{ name: "email", label: "Email", type: "email" }, { name: "phone", label: "Telepon" }] },
      { title: "Pembayaran", fields: [{ name: "payment_term_days", label: "Termin pembayaran (hari)", type: "number", required: true }] },
    ]} />
);
export const NewCustomer = () => (
  <MasterForm title="Pelanggan baru" saveLabel="Simpan pelanggan" sub="Batas kredit nol berarti setiap pesanan ditolak saat konfirmasi." path="/master/customers" back="/sales/customers" keys={["customers"]} initial={{ segment: "B2B", payment_term_days: "30", credit_limit: "0" }}
    groups={[
      { title: "Identitas", fields: [{ name: "code", label: "Kode", type: "code", required: true }, { name: "name", label: "Nama", required: true }, { name: "segment", label: "Segmen", type: "select", options: [["B2B", "Bisnis (B2B)"], ["B2C", "Konsumen (B2C)"]], required: true }, { name: "tax_id", label: "NPWP", type: "code" }] },
      { title: "Kontak", fields: [{ name: "email", label: "Email", type: "email" }, { name: "phone", label: "Telepon" }] },
      { title: "Kredit", hint: "Dipakai saat pesanan dikonfirmasi.", fields: [{ name: "credit_limit", label: "Batas kredit", type: "money", required: true }, { name: "payment_term_days", label: "Termin pembayaran (hari)", type: "number", required: true }] },
    ]} />
);
