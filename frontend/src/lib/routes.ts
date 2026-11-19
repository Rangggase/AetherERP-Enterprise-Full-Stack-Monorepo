/**
 * Pemuat potongan kode per halaman. App.tsx memakai pemuat yang sama untuk React.lazy, jadi prefetch di sini
 * memuat potongan yang persis sama. Prefetch dipicu niat (tautan disorot atau difokus), bukan saat halaman dibuka,
 * agar JS awal Dasbor tetap kecil dan Transisi Ruang (M4) punya halaman tujuan yang siap dirender.
 */
export const load = {
  lists: () => import("../pages/Lists"),
  details: () => import("../pages/Details"),
  forms: () => import("../pages/Forms"),
  master: () => import("../pages/MasterData"),
  admin: () => import("../pages/Admin"),
  returns: () => import("../pages/Returns"),
  journal: () => import("../pages/JournalDetail"),
  stock: () => import("../pages/StockLevel"),
  reports: () => import("../pages/Reports"),
  periods: () => import("../pages/Periods"),
};

const RULES: [RegExp, keyof typeof load][] = [
  [/^\/sales\/returns/, "returns"],
  [/^\/sales\/orders\/\d+\/return/, "returns"],
  [/^\/(sales\/orders|procurement\/orders|accounting\/invoices)\/\d+/, "details"],
  [/^\/accounting\/journals\/\d+/, "journal"],
  [/\/new$/, "forms"],
  [/^\/inventory\/stock/, "stock"],
  [/^\/accounting\/reports/, "reports"],
  [/^\/accounting\/periods/, "periods"],
  [/^\/(master|sales\/customers)/, "master"],
  [/^\/(system\/users|account)/, "admin"],
  [/^\/(procurement|inventory|sales|accounting|system)/, "lists"],
];

const done = new Set<string>();
export function prefetchRoute(path: string): void {
  const p = path.split("?")[0]!;
  const hit = RULES.find(([re]) => re.test(p));
  if (!hit || done.has(hit[1])) return;
  done.add(hit[1]);
  void load[hit[1]]().catch(() => done.delete(hit[1]));
}
