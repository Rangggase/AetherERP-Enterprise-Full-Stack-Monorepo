/** Navigation model shared by the sidebar, breadcrumbs and the command palette. */
export interface NavItem { to: string; label: string; perm: string }
export interface NavGroup { group: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { group: "", items: [{ to: "/", label: "Dasbor", perm: "dashboard.read" }] },
  {
    group: "Pengadaan",
    items: [
      { to: "/procurement/orders", label: "Pesanan pembelian", perm: "procurement.read" },
      { to: "/procurement/receipts", label: "Penerimaan barang", perm: "procurement.read" },
      { to: "/master/suppliers", label: "Pemasok", perm: "master.read" },
    ],
  },
  {
    group: "Gudang",
    items: [
      { to: "/master/products", label: "Produk", perm: "master.read" },
      { to: "/inventory/stock", label: "Level stok", perm: "inventory.read" },
      { to: "/inventory/movements", label: "Kartu stok", perm: "inventory.read" },
      { to: "/inventory/transfers", label: "Transfer antar gudang", perm: "inventory.read" },
      { to: "/inventory/work-orders", label: "Perakitan", perm: "inventory.read" },
      { to: "/inventory/reorder", label: "Saran pesan ulang", perm: "inventory.read" },
    ],
  },
  {
    group: "Penjualan",
    items: [
      { to: "/sales/orders", label: "Pesanan penjualan", perm: "sales.read" },
      { to: "/sales/returns", label: "Retur", perm: "sales.read" },
      { to: "/sales/customers", label: "Pelanggan", perm: "master.read" },
    ],
  },
  {
    group: "Akuntansi",
    items: [
      { to: "/accounting/journals", label: "Jurnal umum", perm: "accounting.read" },
      { to: "/accounting/invoices", label: "Faktur & tagihan", perm: "accounting.read" },
      { to: "/accounting/reports", label: "Laporan keuangan", perm: "accounting.read" },
      { to: "/accounting/periods", label: "Periode fiskal", perm: "accounting.read" },
    ],
  },
  {
    group: "Sistem",
    items: [
      { to: "/system/audit", label: "Log audit", perm: "audit.read" },
      { to: "/system/users", label: "Pengguna & peran", perm: "users.manage" },
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
