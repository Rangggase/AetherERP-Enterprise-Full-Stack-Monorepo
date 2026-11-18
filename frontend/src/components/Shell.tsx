import clsx from "clsx";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { crumbsFor, NAV } from "../lib/nav";
import { useSession } from "../lib/session";
import { Palette } from "./Palette";

const CrumbContext = createContext<(label: string | null) => void>(() => {});
/** A detail page names its own last breadcrumb (e.g. the document number). */
export function useCrumb(label: string | null | undefined): void {
  const set = useContext(CrumbContext);
  useEffect(() => {
    if (label) set(label);
    return () => set(null);
  }, [label, set]);
}

export function Shell() {
  const s = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [crumbOverride, setCrumbOverride] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDrawer(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); }
      else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setPalette(true); }
      else if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = crumbsFor(loc.pathname).map((c, i, a) => (i === a.length - 1 && crumbOverride ? { ...c, label: crumbOverride } : c));

  const menu = (
    <nav aria-label="Menu utama" className="py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => s.can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.group || "root"}>
            {g.group && <h2 className="mb-1 mt-4 px-5 text-xs font-medium text-muted">{g.group}</h2>}
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => clsx("block border-l-2 px-5 py-1.5 text-table transition-colors duration-base ease-out", isActive ? "border-brand bg-brand/5 font-semibold" : "border-transparent hover:bg-ink/5")}>
                {i.label}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <CrumbContext.Provider value={setCrumbOverride}>
      <div className="min-h-dvh md:grid md:grid-cols-[192px_minmax(0,1fr)]">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:border focus:border-ink focus:bg-surface focus:px-3 focus:py-2">Lewati ke konten</a>

        <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-line md:block print:hidden">
          <div className="px-5 pt-4 font-serif text-[17px] font-semibold">AetherERP</div>
          {menu}
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden print:hidden">
            <div className="fade-in absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
            <aside role="dialog" aria-modal="true" aria-label="Menu" className="drawer-in absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-ink bg-canvas">
              <div className="flex items-center justify-between px-5 pt-4"><span className="font-serif text-[17px] font-semibold">AetherERP</span><button className="btn btn-text" onClick={() => setDrawer(false)} aria-label="Tutup menu">Tutup</button></div>
              {menu}
            </aside>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-11 items-center gap-4 border-b border-line bg-canvas px-4 md:px-6 print:hidden">
            <button className="btn btn-text md:hidden" onClick={() => setDrawer(true)}>Menu</button>
            <nav aria-label="Jejak halaman" className="min-w-0 flex-1 truncate text-table text-muted">
              {crumbs.map((c, i) => (
                <span key={i}>
                  {i > 0 && " / "}
                  {c.to ? <Link to={c.to} className="inline-block py-1.5 hover:text-ink hover:underline">{c.label}</Link> : <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>{c.label}</span>}
                </span>
              ))}
            </nav>
            <label className="hidden items-center gap-1.5 text-table text-muted lg:flex">
              Cabang
              <select className="border-0 border-b border-control bg-transparent p-0 pr-4 text-table font-medium text-ink" name="branch" value={s.branchId ?? ""} onChange={(e) => s.setBranchId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Semua cabang</option>
                {s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {s.period && <span className="hidden text-table text-muted xl:inline" title="Periode akuntansi terbuka saat ini">Periode <b className="font-medium text-ink">{s.period.code} · terbuka</b></span>}
            <button className="hidden h-8 min-w-[220px] items-center justify-between gap-3 rounded border border-control bg-surface px-2 text-table text-muted md:flex" onClick={() => setPalette(true)} aria-label="Cari dokumen, produk, pelanggan (tekan /)">
              <span>Cari dokumen, produk, pelanggan</span><kbd className="rounded-sm border border-line px-1.5 font-sans text-xs">/</kbd>
            </button>
            <button className="btn btn-text md:hidden" onClick={() => setPalette(true)}>Cari</button>
            <Link to="/account" className="hidden py-1.5 text-table hover:underline sm:block" title={s.me?.role}>{s.me?.full_name}</Link>
            <button className="btn btn-text" onClick={() => { s.signOut(); nav("/login"); }}>Keluar</button>
          </header>
          <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1180px] px-4 pb-24 pt-6 outline-none md:px-10 md:pt-8 print:p-0">
            {/* The branch selector moves into the page on narrow screens, where the top bar has no room. */}
            <div className="mb-4 flex items-center gap-2 text-table text-muted lg:hidden print:hidden">
              <label htmlFor="branch-m">Cabang</label>
              <select id="branch-m" name="branch-mobile" className="field flex-1" value={s.branchId ?? ""} onChange={(e) => s.setBranchId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Semua cabang</option>
                {s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Outlet />
          </main>
        </div>
        <Palette open={palette} onClose={() => setPalette(false)} />
      </div>
    </CrumbContext.Provider>
  );
}
