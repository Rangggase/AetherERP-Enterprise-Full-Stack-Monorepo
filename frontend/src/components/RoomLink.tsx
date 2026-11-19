import { forwardRef, useImperativeHandle, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { prefetchRoute } from "../lib/routes";
import { routeRendered, takeRoom, transitionTo } from "../motion/viewTransition";

/**
 * Tautan dengan Transisi Ruang (M4): elemen ini berubah bentuk menjadi kepala halaman tujuan yang memakai nama ruang yang sama.
 * Saat kembali, tautan dengan nama yang sama di halaman asal menjadi tujuan perubahan bentuk (arah sebaliknya).
 */
export const RoomLink = forwardRef<HTMLAnchorElement, { to: string; room?: string; children: ReactNode; className?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">>(
  function RoomLink({ to, room, children, className, onClick, ...rest }, fwd) {
    const nav = useNavigate();
    const ref = useRef<HTMLAnchorElement>(null);
    useImperativeHandle(fwd, () => ref.current!);
    const target = room ? takeRoom(room) : undefined;
    return (
      <Link ref={ref} to={to} className={className} data-room-target={target ? "" : undefined} style={target ? { viewTransitionName: target } : undefined}
        onPointerEnter={() => prefetchRoute(to)} onFocus={() => prefetchRoute(to)} {...rest}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          e.stopPropagation();
          transitionTo(() => nav(to), { source: ref.current, name: room });
        }}>
        {children}
      </Link>
    );
  },
);

/** Navigasi terprogram dengan Transisi Ruang (misalnya kartu "Perlu tindakan" atau baris yang dibuka dengan Enter). */
export function useRoomNavigate() {
  const nav = useNavigate();
  return (to: string, opts: { source?: Element | null; room?: string } = {}) => transitionTo(() => nav(to), { source: opts.source, name: opts.room });
}

/** Kembali ke halaman sebelumnya dengan arah sebaliknya; tanpa riwayat di aplikasi, buka `fallback`. */
export function useRoomBack(fallback: string) {
  const nav = useNavigate();
  const loc = useLocation();
  return (opts: { source?: Element | null; room?: string } = {}) => {
    if (loc.key === "default") { transitionTo(() => nav(fallback), { source: opts.source, name: opts.room, dir: "back" }); return; }
    transitionTo(() => nav(-1), { source: opts.source, name: opts.room, dir: "back", wait: () => routeRendered() });
  };
}
