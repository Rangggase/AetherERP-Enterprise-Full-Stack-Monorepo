import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { today } from "../lib/format";
import { crumbsFor, FLAT_NAV, mobileTabs, NAV, permFor } from "../lib/nav";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { Glyph } from "./glyphs";
import { Menu } from "./Menu";
import { NoAccess } from "./NoAccess";
import { Palette } from "./Palette";
import { InkFilter } from "./ui";

type Row = Record<string, any>;

const CrumbContext = createContext<(label: string | null) => void>(() => {});
/** A detail page names its own last breadcrumb (e.g. the document number). */
export function useCrumb(label: string | null | undefined): void {
  const set = useContext(CrumbContext);
  useEffect(() => {
    if (label) set(label);
    return () => set(null);
  }, [label, set]);
}

const readRail = () => { try { return localStorage.getItem("aether.rail") === "1"; } catch { return false; } };

/** Same query keys as the dashboard's lists, so the counts reuse its cache instead of fetching twice. */
function useCount(key: string, path: string, enabled: boolean, params: Record<string, unknown>, paged = true) {
  return useQuery({
    queryKey: ["dash", key, params],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const r = await api<Page<Row> | Row[]>(path, { params: paged ? { page_size: 200, ...params } : params });
      return Array.isArray(r) ? r : r.items;
    },
  });
}

/** Pending work per menu item, only where an existing list endpoint already says it. */
function useNavCounts(can: (p: string) => boolean, branchId: number | null): Record<string, number> {
  const br = { branch_id: branchId };
  const pos = useCount("pos", "/procurement/purchase-orders", can("procurement.approve"), br);
  const inv = useCount("inv", "/invoices", can("payments.write") && can("accounting.read"), br);
  const stock = useCount("stock", "/inventory/balances", can("inventory.write") || can("procurement.write"), br, false);
  const t = today();
  // The cache is shared with the dashboard, so a list may hold data for a role that does not act on it: gate by permission here too.
  return {
    "/procurement/orders": can("procurement.approve") ? (pos.data ?? []).filter((r) => r.status === "PENDING_APPROVAL").length : 0,
    "/accounting/invoices": can("payments.write") && can("accounting.read") ? (inv.data ?? []).filter((i) => i.type === "AR" && i.status !== "PAID" && i.status !== "VOID" && i.due_date < t).length : 0,
    "/inventory/reorder": can("inventory.write") || can("procurement.write") ? (stock.data ?? []).filter((r) => r.is_low).length : 0,
  };
}

const periodLabel = (start: string) => new Date(start + "T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "numeric" });
const initials = (name?: string) => (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export function Shell() {
  const s = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const [palette, setPalette] = useState(false);
  const [scope, setScope] = useState<"all" | "pages">("all");
  const [byKey, setByKey] = useState(false);
  const [rail, setRail] = useState(readRail);
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const [crumbOverride, setCrumbOverride] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const moreRef = useRef<HTMLDialogElement>(null);
  const counts = useNavCounts(s.can, s.branchId);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    if (moreRef.current?.open) moreRef.current.close();
  }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setScope("all"); setByKey(true); setPalette(true); }
      else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setScope("pages"); setByKey(true); setPalette(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Bookmark ribbon: one marker slides to the active item (transform only). The first placement does not animate.
  useLayoutEffect(() => {
    const m = markerRef.current, n = navRef.current;
    if (!m || !n) return;
    const a = n.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!a) { m.style.opacity = "0"; return; }
    const y = a.getBoundingClientRect().top - n.getBoundingClientRect().top + n.scrollTop;
    if (!placed.current) { m.style.transition = "none"; requestAnimationFrame(() => { m.style.transition = ""; }); placed.current = true; }
    m.style.opacity = "1";
    m.style.height = `${a.offsetHeight}px`;
    m.style.transform = `translateY(${y}px)`;
  }, [loc.pathname, rail, s.me]);

  const toggleRail = () => {
    setRail((r) => {
      try { localStorage.setItem("aether.rail", r ? "0" : "1"); } catch { /* ignore */ }
      return !r;
    });
    setTip(null);
  };

  const crumbs = crumbsFor(loc.pathname).map((c, i, a) => (i === a.length - 1 && crumbOverride ? { ...c, label: crumbOverride } : c));
  const need = permFor(loc.pathname);
  const tabs = mobileTabs(s.can);
  const more = FLAT_NAV.filter((i) => s.can(i.perm) && !tabs.includes(i));
  const tabActive = (to: string) => (to === "/" ? loc.pathname === "/" : loc.pathname === to || loc.pathname.startsWith(to + "/"));
  const userItems = [
    { label: "Akun saya", glyph: "akun" as const, onSelect: () => nav("/account") },
    { label: "Keluar", glyph: "keluar" as const, onSelect: () => { s.signOut(); nav("/login"); } },
  ];
  const branchName = s.branches.find((b) => b.id === s.branchId)?.name ?? "Semua cabang";

  function onNavKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = [...(navRef.current?.querySelectorAll<HTMLElement>("a") ?? [])];
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    links[(i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
  }
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    if (!rail) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, y: r.top + r.height / 2 });
  };

  return (
    <CrumbContext.Provider value={setCrumbOverride}>
      <div className={clsx("min-h-dvh md:grid", rail ? "md:grid-cols-[56px_minmax(0,1fr)]" : "md:grid-cols-[224px_minmax(0,1fr)]")}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:shadow-elev-3">Lewati ke konten</a>

        {/* D1 sidebar: wide (glyph and word) or rail (glyph; word as tooltip and accessible name). */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line md:flex print:hidden">
          <div className={clsx("flex h-[52px] shrink-0 items-center gap-2.5", rail ? "justify-center" : "px-4")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-brand font-serif text-sm font-semibold text-surface shadow-[0_2px_0_rgb(var(--accent-deep))]" aria-hidden="true">A</span>
            {!rail && <span className="font-serif text-[17px] font-semibold">AetherERP</span>}
            {rail && <span className="sr-only">AetherERP</span>}
          </div>
          <nav ref={navRef} aria-label="Menu utama" className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2" onKeyDown={onNavKey} onScroll={() => setTip(null)}>
            <span ref={markerRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 border-y border-line bg-surface shadow-elev-1 transition-transform duration-mid ease-out before:absolute before:inset-y-[-1px] before:left-0 before:w-1 before:bg-brand" />
            {NAV.map((g) => {
              const items = g.items.filter((i) => s.can(i.perm));
              if (!items.length) return null;
              return (
                <div key={g.group || "root"}>
                  {g.group && (rail ? <hr className="mx-3.5 my-2.5 border-line" /> : <h2 className="mb-0.5 mt-3 px-4 text-xs font-medium lowercase text-muted">{g.group}</h2>)}
                  <ul>
                    {items.map((i) => {
                      const n = counts[i.to] ?? 0;
                      const name = n ? `${i.label}, ${n} tertunda` : i.label;
                      return (
                        <li key={i.to}>
                          <NavLink to={i.to} end={i.to === "/"} aria-label={rail ? name : undefined}
                            onMouseEnter={showTip(name)} onMouseLeave={() => setTip(null)} onFocus={showTip(name)} onBlur={() => setTip(null)}
                            className={({ isActive }) => clsx("relative z-[1] flex h-8 items-center gap-2.5 text-table outline-offset-[-2px] transition-colors duration-fast", rail ? "justify-center" : "pl-4 pr-3", isActive ? "font-semibold text-ink" : "text-ink hover:bg-ink/[0.04]")}>
                            <Glyph name={i.glyph} size={20} />
                            {!rail && <span className="min-w-0 flex-1 truncate">{i.label}</span>}
                            {n > 0 && (rail
                              ? <span aria-hidden="true" className="absolute right-3 top-1.5 h-[7px] w-[7px] rounded-full bg-brand" />
                              : <span aria-hidden="true" className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-[18px] text-surface font-num">{n}</span>)}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
          <button type="button" className={clsx("btn btn-text btn-sm m-2 shrink-0 text-muted", rail ? "justify-center px-0" : "justify-start")} onClick={toggleRail} aria-label={rail ? "Lebarkan menu" : "Ciutkan menu"}
            onMouseEnter={showTip("Lebarkan menu")} onMouseLeave={() => setTip(null)}>
            <Glyph name="rel" size={20} className={rail ? "-scale-x-100" : ""} />{!rail && "Ciutkan menu"}
          </button>
        </aside>
        {rail && tip && (
          <div role="tooltip" className="pointer-events-none fixed left-[62px] z-50 -translate-y-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs font-medium text-surface print:hidden" style={{ top: tip.y }}>{tip.label}</div>
        )}

        <div className="min-w-0">
          {/* D2 top bar. */}
          <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-line bg-canvas px-4 md:px-6 print:hidden">
            <nav aria-label="Jejak halaman" className="min-w-0 flex-1 truncate text-table text-muted">
              {crumbs.map((c, i) => (
                <span key={i} className={i < crumbs.length - 1 ? "max-md:hidden" : ""}>
                  {i > 0 && <span className="max-md:hidden"> / </span>}
                  {c.to ? <Link to={c.to} className="inline-block py-1.5 hover:text-ink hover:underline">{c.label}</Link> : <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>{c.label}</span>}
                </span>
              ))}
            </nav>
            <span className="hidden md:inline-flex">
              <Menu label={`Cabang: ${branchName}`} align="right"
                className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-control bg-surface pl-2.5 pr-2 text-table font-medium hover:bg-highlight"
                button={<><Glyph name="cabang" size={16} /><span>{branchName}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></>}
                items={[{ id: null as number | null, name: "Semua cabang" }, ...s.branches].map((b) => ({ label: b.name, checked: s.branchId === b.id, onSelect: () => s.setBranchId(b.id) }))} />
            </span>
            {s.period && <span className="stamp-sm hidden text-good xl:inline-flex" title="Periode akuntansi berjalan">Periode {periodLabel(s.period.start_date)} · Terbuka</span>}
            <button type="button" className="hidden h-8 w-[240px] items-center gap-2 overflow-hidden whitespace-nowrap rounded border border-control bg-highlight px-2.5 text-table text-muted shadow-inset md:flex lg:w-[260px]" onClick={() => { setScope("all"); setByKey(false); setPalette(true); }} aria-label="Cari dokumen, halaman, aksi (Ctrl K atau /)">
              <Glyph name="cari" size={16} /><span className="truncate">Cari dokumen, halaman</span><kbd className="ml-auto rounded-sm border border-b-2 border-line bg-surface px-1.5 font-sans text-[11px] text-ink">Ctrl K</kbd>
            </button>
            <button type="button" className="btn btn-text h-11 w-11 justify-center px-0 md:hidden" onClick={() => { setScope("all"); setByKey(false); setPalette(true); }} aria-label="Cari"><Glyph name="cari" size={20} /></button>
            <Menu label={`Menu pengguna: ${s.me?.full_name ?? ""}`} className="avatar" button={initials(s.me?.full_name)} items={userItems} />
          </header>

          <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1180px] px-4 pb-40 pt-6 outline-none md:px-10 md:pb-24 md:pt-8 print:p-0">
            {/* On narrow screens the branch selector sits at the top of the page, where the top bar has no room. */}
            <div className="mb-4 flex items-center gap-2 text-table text-muted md:hidden print:hidden">
              <label htmlFor="branch-m" className="flex items-center gap-1.5"><Glyph name="cabang" size={16} />Cabang</label>
              <select id="branch-m" name="branch-mobile" className="field flex-1" value={s.branchId ?? ""} onChange={(e) => s.setBranchId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Semua cabang</option>
                {s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {need && !s.can(need) ? <NoAccess perm={need} /> : <Outlet />}
          </main>
        </div>

        {/* D3 bottom tab bar on narrow screens: four modules for this role plus "Lainnya". */}
        <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(60px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_14px_-10px_rgb(30_27_24/0.25)] md:hidden print:hidden">
          {tabs.map((i) => {
            const on = tabActive(i.to);
            return (
              <Link key={i.to} to={i.to} aria-current={on ? "page" : undefined} className={clsx("relative grid min-h-11 content-center justify-items-center gap-0.5 text-[11px] font-medium", on ? "text-brand before:absolute before:inset-x-[30%] before:top-0 before:h-[3px] before:rounded-b-sm before:bg-brand" : "text-muted")}>
                <Glyph name={i.glyph} size={24} />{i.short}
                {(counts[i.to] ?? 0) > 0 && <span aria-hidden="true" className="absolute right-[28%] top-2 h-[7px] w-[7px] rounded-full bg-brand" />}
              </Link>
            );
          })}
          <button type="button" className="grid min-h-11 content-center justify-items-center gap-0.5 text-[11px] font-medium text-muted" aria-haspopup="dialog" onClick={() => moreRef.current?.showModal()}>
            <Glyph name="lainnya" size={24} />Lainnya
          </button>
        </nav>
        <dialog ref={moreRef} aria-label="Menu lainnya" className="sheet-in fixed inset-x-0 bottom-0 top-auto m-0 max-h-[80dvh] w-full max-w-none overflow-y-auto rounded-t-xl border-t border-line bg-surface p-0 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-elev-3 md:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) moreRef.current?.close(); }}>
          <div className="mx-auto mb-2 mt-2 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-center justify-between px-4 pb-1"><h2 className="text-table font-semibold">Lainnya</h2><button type="button" className="btn btn-text h-11 w-11 justify-center px-0" onClick={() => moreRef.current?.close()} aria-label="Tutup menu lainnya"><Glyph name="tutup" size={20} /></button></div>
          <ul className="grid grid-cols-2 gap-1 px-2">
            {more.map((i) => (
              <li key={i.to}><Link to={i.to} className="flex min-h-11 items-center gap-2.5 rounded px-2 text-sm hover:bg-highlight"><Glyph name={i.glyph} size={20} />{i.label}</Link></li>
            ))}
          </ul>
        </dialog>

        <Palette open={palette} scope={scope} instant={byKey} onClose={() => setPalette(false)} />
        <InkFilter />
      </div>
    </CrumbContext.Provider>
  );
}
