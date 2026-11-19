/** Navigation model shared by the sidebar, breadcrumbs and the command palette. */
import type { GlyphName } from "../components/glyphs/paths";

export interface NavItem { to: string; label: string; perm: string; glyph: GlyphName; short: string }
export interface NavGroup { group: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { group: "", items: [{ to: "/", label: "Dasbor", perm: "dashboard.read" , glyph: "dasbor", short: "Dasbor" }] },
  {
    group: "Pengadaan",
    items: [
      { to: "/procurement/orders", label: "Pesanan pembelian", perm: "procurement.read" , glyph: "pesanan-pembelian", short: "Pembelian" },
      { to: "/procurement/receipts", label: "Penerimaan barang", perm: "procurement.read" , glyph: "penerimaan-barang", short: "Penerimaan" },
      { to: "/master/suppliers", label: "Pemasok", perm: "master.read" , glyph: "pemasok", short: "Pemasok" },
    ],
  },
  {
    group: "Gudang",
    items: [
      { to: "/master/products", label: "Produk", perm: "master.read" , glyph: "produk", short: "Produk" },
      { to: "/inventory/stock", label: "Level stok", perm: "inventory.read" , glyph: "level-stok", short: "Stok" },
      { to: "/inventory/movements", label: "Kartu stok", perm: "inventory.read" , glyph: "kartu-stok", short: "Kartu stok" },
      { to: "/inventory/transfers", label: "Transfer antar gudang", perm: "inventory.read" , glyph: "transfer", short: "Transfer" },
      { to: "/inventory/work-orders", label: "Perakitan", perm: "inventory.read" , glyph: "perakitan", short: "Perakitan" },
      { to: "/inventory/reorder", label: "Saran pesan ulang", perm: "inventory.read" , glyph: "pesan-ulang", short: "Pesan ulang" },
    ],
  },
  {
    group: "Penjualan",
    items: [
      { to: "/sales/orders", label: "Pesanan penjualan", perm: "sales.read" , glyph: "pesanan-penjualan", short: "Penjualan" },
      { to: "/sales/returns", label: "Retur", perm: "sales.read" , glyph: "retur", short: "Retur" },
      { to: "/sales/customers", label: "Pelanggan", perm: "master.read" , glyph: "pelanggan", short: "Pelanggan" },
    ],
  },
  {
    group: "Akuntansi",
    items: [
      { to: "/accounting/journals", label: "Jurnal umum", perm: "accounting.read" , glyph: "jurnal", short: "Jurnal" },
      { to: "/accounting/invoices", label: "Faktur & tagihan", perm: "accounting.read" , glyph: "faktur", short: "Faktur" },
      { to: "/accounting/reports", label: "Laporan keuangan", perm: "accounting.read" , glyph: "laporan", short: "Laporan" },
      { to: "/accounting/periods", label: "Periode fiskal", perm: "accounting.read" , glyph: "periode", short: "Periode" },
    ],
  },
  {
    group: "Sistem",
    items: [
      { to: "/system/audit", label: "Log audit", perm: "audit.read" , glyph: "audit", short: "Audit" },
      { to: "/system/users", label: "Pengguna & peran", perm: "users.manage" , glyph: "pengguna", short: "Pengguna" },
    ],
  },
];

const FLAT = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

/** Breadcrumb trail for a pathname: [group?, list page, detail/new...]. */
export function crumbsFor(pathname: string): { label: string; to?: string }[] {
  if (pathname === "/") return [{ label: "Dasbor" }];
  const parts = pathname.split("/").filter(Boolean);
  // longest matching nav item
  const hit = [...FLAT].sort((a, b) => b.to.length - a.to.length).find((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
  const out: { label: string; to?: string }[] = [];
  if (hit) {
    if (hit.group) out.push({ label: hit.group });
    const rest = pathname.slice(hit.to.length).split("/").filter(Boolean);
    out.push({ label: hit.label, to: rest.length ? hit.to : undefined });
    if (rest[0] === "new") out.push({ label: "Baru" });
    else if (rest.length) {
      const last = rest[rest.length - 1]!;
      if (last === "return") out.push({ label: `#${rest[0]}`, to: `${hit.to}/${rest[0]}` }, { label: "Retur" });
      else out.push({ label: `#${rest[0]}` });
    }
    return out;
  }
  if (parts[0] === "account") return [{ label: "Akun saya" }];
  return [{ label: parts[parts.length - 1] ?? "" }];
}

export { FLAT as FLAT_NAV };

/** Pages that write need a write permission; everything else follows the read permission of its menu entry. */
const WRITE_ROUTES: [RegExp, string][] = [
  [/^\/procurement\/orders\/new$/, "procurement.write"],
  [/^\/sales\/orders\/new$/, "sales.write"],
  [/^\/sales\/orders\/[^/]+\/return$/, "sales.write"],
  [/^\/(sales\/customers|master\/products|master\/suppliers)\/new$/, "master.write"],
  [/^\/accounting\/journals\/new$/, "accounting.post"],
  [/^\/system\/users\/new$/, "users.manage"],
];

/** Permission a pathname requires, or null when any signed-in user may open it (account page, unknown paths). */
export function permFor(pathname: string): string | null {
  const w = WRITE_ROUTES.find(([re]) => re.test(pathname));
  if (w) return w[1];
  const hit = [...FLAT].sort((a, b) => b.to.length - a.to.length).find((i) => pathname === i.to || (i.to !== "/" && pathname.startsWith(i.to + "/")));
  return hit?.perm ?? null;
}

/** Four bottom-tab modules for narrow screens, chosen from the role's permissions; everything else sits under "Lainnya". */
export function mobileTabs(can: (perm: string) => boolean): NavItem[] {
  let pref: string[];
  if (can("payments.write") || can("accounting.close")) pref = ["/accounting/invoices", "/accounting/journals", "/accounting/reports"];
  else if (can("procurement.approve") || can("procurement.write")) pref = ["/procurement/orders", "/procurement/receipts", "/master/suppliers"];
  else if (can("inventory.write")) pref = ["/inventory/stock", "/inventory/transfers", "/procurement/receipts"];
  else if (can("sales.write")) pref = ["/sales/orders", "/sales/returns", "/sales/customers"];
  else pref = ["/system/audit", "/accounting/reports", "/accounting/journals"];
  const out: NavItem[] = [];
  for (const to of ["/", ...pref]) {
    const i = FLAT.find((x) => x.to === to);
    if (i && can(i.perm) && !out.includes(i)) out.push(i);
  }
  for (const i of FLAT) {
    if (out.length >= 4) break;
    if (can(i.perm) && !out.includes(i)) out.push(i);
  }
  return out.slice(0, 4);
}
