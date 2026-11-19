import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { play } from "../motion/animate";
import { chime } from "../motion/sound";
import { takeRoom } from "../motion/viewTransition";
import { spring } from "../motion/spring";
import { Glyph, type GlyphName } from "./glyphs";

type Tone = "ok" | "warn" | "bad" | "info" | "idle";

const TONE: Record<string, { tone: Tone; text: string }> = {
  DRAFT: { tone: "idle", text: "Draf" },
  QUOTATION: { tone: "idle", text: "Penawaran" },
  REQUESTED: { tone: "idle", text: "Diminta" },
  PENDING_APPROVAL: { tone: "warn", text: "Perlu persetujuan" },
  APPROVED: { tone: "info", text: "Disetujui" },
  CONFIRMED_SO: { tone: "info", text: "Terkonfirmasi" },
  IN_TRANSIT: { tone: "info", text: "Dalam perjalanan" },
  PARTIALLY_RECEIVED: { tone: "warn", text: "Diterima sebagian" },
  RECEIVED: { tone: "ok", text: "Diterima" },
  DELIVERED: { tone: "info", text: "Terkirim" },
  BILLED: { tone: "info", text: "Ditagih" },
  INVOICED: { tone: "info", text: "Terfaktur" },
  OPEN: { tone: "info", text: "Terbuka" },
  PARTIALLY_PAID: { tone: "warn", text: "Dibayar sebagian" },
  PAID: { tone: "ok", text: "Lunas" },
  POSTED: { tone: "ok", text: "Terposting" },
  COMPLETED: { tone: "ok", text: "Selesai" },
  CLOSED: { tone: "idle", text: "Ditutup" },
  REVERSED: { tone: "bad", text: "Dibalik" },
  CANCELLED: { tone: "bad", text: "Dibatalkan" },
  VOID: { tone: "bad", text: "Batal" },
};
const GLYPH: Record<Tone, GlyphName> = { ok: "berhasil", warn: "peringatan", bad: "tutup", info: "kirim", idle: "edit" };

export const statusText = (value: string): string => TONE[value]?.text ?? value;
export const toneOf = (value: string): { tone: Tone; text: string } => TONE[value] ?? { tone: "idle", text: value };

/** Status di tabel atau daftar: glyph dan kata di atas tint warna status. Warna tidak pernah sendirian. */
export function Status({ value }: { value: string }) {
  const t = toneOf(value);
  return <span className={clsx("badge", t.tone)}><Glyph name={GLYPH[t.tone]} size={14} />{t.text}</span>;
}

/** Hash kecil yang stabil (FNV-1a) untuk "ketidaksempurnaan yang konsisten" (brief 4.2.8). */
export function hash(seed: string | number): number {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Kemiringan cap antara −5° dan −2°, selalu sama untuk dokumen yang sama. */
export const capTilt = (seed: string | number): string => `${(-5 + (hash(seed) % 301) / 100).toFixed(2)}deg`;

/**
 * Cap status dokumen (5.2). Mendarat (skala 1,15 → 1 dengan pegas cap) hanya saat status berubah selama halaman terbuka (M2).
 * Halaman yang dibuka biasa menampilkan cap dalam keadaan diam.
 */
export function Cap({ value, seed, label, glyph, small, className, land }: { value: string; seed: string | number; label?: string; glyph?: GlyphName; small?: boolean; className?: string; land?: boolean }) {
  const t = toneOf(value);
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(land ? null : value);
  const tilt = capTilt(seed);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const s = spring("spring-stamp");
    play(ref.current, [{ opacity: 0, transform: `rotate(${tilt}) scale(1.15)` }, { opacity: 1, transform: `rotate(${tilt}) scale(1)` }], { duration: s.duration, easing: s.easing });
    chime("cap");
    // Dokumen yang baru diposting: hapus tanda dari riwayat agar memuat ulang tidak memutar cap lagi.
    if (land) try { window.history.replaceState({ ...window.history.state, usr: null }, ""); } catch { /* abaikan */ }
  }, [value, tilt, land]);
  const text = label ?? t.text;
  return (
    <span ref={ref} className={clsx("cap", t.tone, small && "cap-sm", className)} style={{ ["--cap-tilt" as string]: tilt }} role="status" aria-label={`Status: ${text}`}>
      {glyph && <Glyph name={glyph} size={small ? 12 : 15} />}{text}
    </span>
  );
}
/** Nama lama v2. */
export const Stamp = ({ value, seed = value }: { value: string; seed?: string | number }) => <Cap value={value} seed={seed} />;

/** Nomor dokumen, SKU, dan kode akun memakai Plex Mono dan tidak diterjemahkan. */
export const Code = ({ children, className }: { children: ReactNode; className?: string }) => <span className={clsx("code", className)} translate="no">{children}</span>;

/**
 * Kepala halaman (9): judul Source Serif, satu kalimat fakta, satu aksi utama di kanan.
 * h1 bisa difokus (tabIndex -1) karena fokus pindah ke sana setelah navigasi.
 */
export function PageHeader({ title, sub, note, actions, cta, room, children }: { title: ReactNode; sub?: ReactNode; note?: ReactNode; actions?: ReactNode; cta?: boolean; room?: string; children?: ReactNode }) {
  const line = sub ?? note;
  // Nama transisi ruang hanya dipasang selama transisi menuju halaman ini (brief 7, M4).
  const target = room ? takeRoom(room) : undefined;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-ink pb-4">
      <div className="min-w-0">
        <h1 tabIndex={-1} data-room-target={target ? "" : undefined} style={target ? { viewTransitionName: target } : undefined} className="font-serif text-xl font-medium tracking-[-0.005em] outline-none max-md:text-[26px] max-md:leading-8">{title}</h1>
        {line && <p className="mt-1 max-w-prose text-table text-muted">{line}</p>}
        {children}
      </div>
      {actions && <div className={clsx("flex flex-wrap items-center gap-2", cta && "page-cta")}>{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="mb-2 text-table font-semibold">{children}</h2>;
}

/* ---- Ilustrasi keadaan (8): isometrik garis satu warna --ink-muted, 1,25 px, sudut 30°, sekitar 120 px. ---- */
type V3 = [number, number, number];
const U = 13;
const iso = ([x, y, z]: V3): string => `${(75 + (x - y) * 0.866 * U).toFixed(1)} ${(64 + (x + y) * 0.5 * U - z * U).toFixed(1)}`;
const line = (...pts: V3[]) => `M${pts.map(iso).join("L")}`;
const loop = (...pts: V3[]) => `${line(...pts)}Z`;
/** Rusuk kotak yang terlihat dari depan kanan atas. */
function box(x: number, y: number, z: number, w: number, d: number, h: number): string {
  const [x1, y1, z1] = [x + w, y + d, z + h];
  return [loop([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]), line([x1, y, z1], [x1, y, z]), line([x1, y1, z1], [x1, y1, z]), line([x, y1, z1], [x, y1, z]), line([x, y1, z], [x1, y1, z], [x1, y, z])].join(" ");
}

const ART: Record<string, { d: string; dashed?: string }> = {
  "rak-kosong": {
    d: [line([0, 0, 0], [0, 0, 5]), line([4, 0, 0], [4, 0, 5]), line([4, 1.6, 0], [4, 1.6, 5]), line([0, 1.6, 0], [0, 1.6, 5]),
      loop([0, 0, 0], [4, 0, 0], [4, 1.6, 0], [0, 1.6, 0]), loop([0, 0, 2.5], [4, 0, 2.5], [4, 1.6, 2.5], [0, 1.6, 2.5]), loop([0, 0, 5], [4, 0, 5], [4, 1.6, 5], [0, 1.6, 5])].join(" "),
    dashed: box(1.2, 0.3, 2.5, 1.4, 1, 1),
  },
  "map-kosong": {
    d: [loop([0, 0, 0], [4.4, 0, 0], [4.4, 3, 0], [0, 3, 0]), line([0, 0, 0], [0, 0, 2.6], [1.4, 0, 2.6], [1.8, 0, 3], [3, 0, 3], [3, 0, 2.6], [4.4, 0, 2.6], [4.4, 0, 0]),
      line([0, 3, 0], [0, 1.2, 1.8], [4.4, 1.2, 1.8], [4.4, 3, 0])].join(" "),
  },
  "struk-kosong": {
    d: line([0, 0, 0], [0, 0, 5.2], [2.6, 0, 5.2], [2.6, 0, 0], [2.3, 0, 0.3], [2, 0, 0], [1.7, 0, 0.3], [1.4, 0, 0], [1.1, 0, 0.3], [0.8, 0, 0], [0.5, 0, 0.3], [0.2, 0, 0], [0, 0, 0.2]),
    dashed: [line([0.4, 0, 4.4], [2.2, 0, 4.4]), line([0.4, 0, 3.6], [2.2, 0, 3.6]), line([0.4, 0, 2.8], [1.6, 0, 2.8]), line([0.4, 0, 1.4], [2.2, 0, 1.4])].join(" "),
  },
  "buku-tertutup": {
    d: [box(0, 0, 0, 4, 3, 0.7), line([0.4, 3, 0.7], [0.4, 3, 0]), line([3, 0, 0.7], [3, 0, 1.5], [3.4, 0, 1.2], [3.8, 0, 1.5], [3.8, 0, 0.7])].join(" "),
    dashed: line([0.6, 0.5, 0.7], [3.4, 0.5, 0.7]),
  },
  "kaca-pembesar": {
    d: `M75 30a20 20 0 1 0 0.01 0Z ${line([1.6, -1.6, 0], [3.6, -3.6, -2.4])}`,
    dashed: "M63 48a13 13 0 0 1 12-9",
  },
  "kertas-sobek": {
    d: [line([0, 0, 0], [2.2, 0, 0], [1.8, 0.8, 0], [2.4, 1.6, 0], [1.9, 2.4, 0], [2.3, 3.2, 0], [0, 3.2, 0], [0, 0, 0]),
      line([2.8, -0.2, 0], [4.8, -0.2, 0], [4.8, 3, 0], [2.8, 3, 0], [2.4, 2.2, 0], [2.9, 1.4, 0], [2.3, 0.6, 0], [2.8, -0.2, 0])].join(" "),
    dashed: [line([0.4, 0.6, 0], [1.4, 0.6, 0]), line([0.4, 1.4, 0], [1.2, 1.4, 0]), line([3.2, 1.8, 0], [4.4, 1.8, 0])].join(" "),
  },
  gembok: {
    d: `${box(0, 0, 0, 2.6, 1.2, 2)} ${line([0.5, 0.6, 2], [0.5, 0.6, 3])} M${iso([0.5, 0.6, 3])}C${iso([0.5, 0.6, 4.4])} ${iso([2.1, 0.6, 4.4])} ${iso([2.1, 0.6, 3])} ${line([2.1, 0.6, 3], [2.1, 0.6, 2])}`,
    dashed: line([1.3, 1.2, 1.2], [1.3, 1.2, 0.6]),
  },
  grafik: { d: [line([0, 0, 0], [5, 0, 0]), line([0, 0, 0], [0, 0, 4])].join(" "), dashed: [line([0.6, 0, 1], [1.6, 0, 1.6]), line([2, 0, 1.4], [3, 0, 2]), line([3.4, 0, 1.8], [4.4, 0, 2.6])].join(" ") },
};
const ALIAS: Record<string, keyof typeof ART> = { rak: "rak-kosong", map: "map-kosong", struk: "struk-kosong", sobek: "kertas-sobek", buku: "buku-tertutup", cari: "kaca-pembesar" };
export type Art = "rak-kosong" | "map-kosong" | "struk-kosong" | "buku-tertutup" | "kaca-pembesar" | "kertas-sobek" | "gembok" | "grafik" | "rak" | "map" | "struk" | "sobek" | "buku" | "cari";

export function Illustration({ art, className = "h-[120px] w-auto" }: { art: Art; className?: string }) {
  const a = ART[ALIAS[art] ?? art] ?? ART["map-kosong"]!;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 150 120" className={clsx("mx-auto text-muted", className)} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round">
      <path d={a.d} />
      {a.dashed && <path d={a.dashed} strokeDasharray="2 3" />}
    </svg>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const denied = status === 403;
  const retryable = !denied && (status === 0 || status >= 500);
  return (
    <div role="alert" className="sheet grid justify-items-center gap-2 px-4 py-8 text-center text-sm">
      <Illustration art={denied ? "gembok" : "kertas-sobek"} className="h-[96px] w-auto" />
      <p className="font-medium text-ink">{denied ? "Anda tidak punya izin untuk data ini" : "Data tidak bisa dimuat"}</p>
      <p className="max-w-md text-muted">
        {denied ? "Minta administrator menambahkan izin jika Anda memerlukannya." : `${error instanceof Error ? error.message : "Terjadi kesalahan tak terduga."}${retryable ? " Periksa koneksi, lalu coba lagi." : ""}`}
      </p>
      {retry && retryable && <button className="btn btn-sm mt-1" onClick={retry}>Muat ulang data</button>}
    </div>
  );
}

/** Keadaan kosong: satu gambar, satu kalimat, satu aksi. */
export function EmptyState({ children, action, art = "map-kosong" }: { children: ReactNode; action?: ReactNode; art?: Art }) {
  return (
    <div className="sheet grid justify-items-center gap-3 px-4 py-9 text-center">
      <Illustration art={art} />
      <p className="mx-auto max-w-md text-muted">{children}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ---- Kerangka garis pensil: panjang bervariasi tetapi deterministik. ---- */
const WIDTHS = [72, 46, 88, 60, 38, 80, 54, 66];
export const Pencil = ({ w, i = 0, className }: { w?: number; i?: number; className?: string }) => (
  <span className={clsx("pencil", className)} style={{ width: `${w ?? WIDTHS[i % WIDTHS.length]}%` }} />
);

/** Lembar dokumen yang sedang dimuat: blok judul, lalu baris bergaris. Ritmenya sama dengan halaman jadi. */
export function DetailSkeleton() {
  return (
    <div aria-hidden className="sheet px-5 py-6 md:px-8">
      <div className="mb-6 grid gap-3 border-b border-ink pb-5"><Pencil w={22} /><Pencil w={38} className="h-3" /><Pencil w={56} /></div>
      <div className="grid gap-4">{Array.from({ length: 5 }, (_, i) => <Pencil key={i} i={i + 2} />)}</div>
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="sheet px-4">
      <div className="flex gap-6 border-b border-ink py-3.5"><Pencil w={14} /><Pencil w={22} /><Pencil w={10} className="ml-auto" /></div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-line py-[17px] last:border-b-0">
          <Pencil w={16} i={i} /><Pencil i={i + 3} className="flex-1" /><Pencil w={12} i={i + 1} />
        </div>
      ))}
    </div>
  );
}
