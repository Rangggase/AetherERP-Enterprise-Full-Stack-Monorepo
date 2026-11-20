import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ActionBar, Field, FormGroup } from "../components/Form";
import { Glyph } from "../components/glyphs";
import { Key, KeyLink } from "../components/Key";
import { initials } from "../components/Shell";
import { toast } from "../components/Toaster";
import { ErrorNote, PageHeader, Pencil, SectionTitle } from "../components/ui";
import { FEATURES } from "../config/features";
import { api } from "../lib/api";
import { setPrefs, usePrefs, type MotionPref } from "../lib/preferences";
import { useSession } from "../lib/session";
import "../styles/tables.css";
import "../styles/controls.css";

type Row = Record<string, any>;
const POLICY = "Minimal 10 karakter, dengan huruf dan angka.";

/** Urutan dan arti 16 izin (backend/app/seed.py). Hanya ditampilkan; daftarnya tidak diubah. */
const PERMS: [string, string][] = [
  ["dashboard.read", "Lihat dasbor"], ["master.read", "Lihat data master"], ["master.write", "Kelola data master"],
  ["accounting.read", "Lihat buku besar dan laporan"], ["accounting.post", "Posting dan balik jurnal"], ["accounting.close", "Buka dan tutup periode"],
  ["procurement.read", "Lihat dokumen pengadaan"], ["procurement.write", "Buat pesanan, penerimaan, tagihan"], ["procurement.approve", "Setujui pesanan pembelian"],
  ["inventory.read", "Lihat stok"], ["inventory.write", "Transfer, perakitan, opname"], ["sales.read", "Lihat dokumen penjualan"],
  ["sales.write", "Buat dan proses pesanan penjualan"], ["payments.write", "Catat pembayaran"], ["users.manage", "Kelola pengguna dan peran"], ["audit.read", "Lihat log audit"],
];

function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="field" type="password" name={autoComplete} autoComplete={autoComplete} required minLength={10} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Matriks peran × 16 izin: centang tinta untuk izin yang dimiliki, tanda pisah untuk yang tidak. */
function PermissionMatrix({ roles }: { roles: Row[] }) {
  return (
    <div className="tbl-sheet overflow-x-auto">
      <table className="tbl dense min-w-[760px]" aria-label="Matriks peran dan izin">
        <thead><tr><th>Izin</th>{roles.map((r) => <th key={r.id} className="text-center">{r.name}</th>)}</tr></thead>
        <tbody>
          {PERMS.map(([code, label]) => (
            <tr key={code}>
              <td><span className="block">{label}</span><span className="code text-xs text-muted">{code}</span></td>
              {roles.map((r) => {
                const on = (r.permissions as string[]).includes(code);
                return <td key={r.id} className="text-center">{on ? <Glyph name="simpan" size={18} className="mx-auto text-ink" /> : <span className="text-muted" aria-hidden="true">–</span>}<span className="sr-only">{on ? "ya" : "tidak"}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="total"><td>Jumlah izin</td>{roles.map((r) => <td key={r.id} className="text-center font-num">{r.permissions.length}</td>)}</tr></tfoot>
      </table>
    </div>
  );
}

/** Sakelar aktif (permintaan yang sama dengan tombol Nonaktifkan/Aktifkan v2). Komponen tingkat modul agar tidak dibuat ulang tiap render. */
function ActiveSwitch({ u, self, busy, onToggle }: { u: Row; self: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={!!u.is_active} className="sw" disabled={self || busy}
      aria-label={`Akun ${u.full_name} aktif`} title={self ? "Anda tidak bisa menonaktifkan diri sendiri" : undefined} onClick={onToggle}>
      <span className="rail"><span className="knob" /></span><span className="text-table text-muted">{u.is_active ? "Aktif" : "Nonaktif"}</span>
    </button>
  );
}

export function Users() {
  const { me, branches } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<Row[]>("/system/users") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<Row[]>("/system/roles") });
  const [view, setView] = useState<"kartu" | "tabel">("kartu");
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [pw, setPw] = useState("");
  const toggle = useMutation({
    mutationFn: (u: Row) => api(`/system/users/${u.id}`, { method: "PATCH", body: { is_active: !u.is_active } }),
    onSuccess: () => { toast("Pengguna diperbarui."); void qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast(e instanceof Error ? e.message : "Pengguna tidak bisa diperbarui. Coba lagi.", "error"),
  });
  const reset = useMutation({
    mutationFn: (u: Row) => api(`/system/users/${u.id}/reset-password`, { method: "POST", body: { new_password: pw } }),
    onSuccess: () => { toast("Kata sandi direset. Pengguna keluar dari semua sesi."); setResetFor(null); setPw(""); },
    onError: (e) => toast(e instanceof Error ? e.message : "Kata sandi tidak bisa direset. Coba lagi.", "error"),
  });
  const branchName = (id: number | null) => (id ? branches.find((b) => b.id === id)?.name ?? `#${id}` : "Tanpa cabang");
  const sw = (u: Row) => <ActiveSwitch u={u} self={u.id === me?.id} busy={toggle.isPending} onToggle={() => toggle.mutate(u)} />;
  const columns: ColumnDef<Row, any>[] = [
    { header: "Nama", accessorKey: "full_name", meta: { m: "t" } }, { header: "Email", accessorKey: "email", meta: { m: "s" } }, { header: "Peran", accessorKey: "role", meta: { m: "d" } },
    { header: "Status", accessorKey: "is_active", meta: { m: "x" }, cell: (c) => sw(c.row.original) },
    { id: "aksi", header: "", enableSorting: false, enableColumnFilter: false, meta: { m: "x" }, cell: (c) => <div className="flex justify-end"><button className="btn btn-sm" onClick={() => { setResetFor(c.row.original); setPw(""); }}>Reset kata sandi</button></div> },
  ];
  const active = (q.data ?? []).filter((u) => u.is_active).length;

  return (
    <>
      <PageHeader title="Pengguna dan peran" sub={q.data ? `${q.data.length} pengguna, ${active} aktif. Perubahan berlaku segera dan mengeluarkan pengguna dari sesi yang ada.` : "Memuat pengguna…"}
        actions={<KeyLink tone="primary" glyph="buat" to="/system/users/new">Tambah pengguna</KeyLink>} />
      {resetFor && (
        <form className="sheet mb-5 flex flex-wrap items-end gap-3 px-5 py-4" onSubmit={(e: FormEvent) => { e.preventDefault(); reset.mutate(resetFor); }}>
          <div className="min-w-64 flex-1"><PasswordField label={`Kata sandi baru untuk ${resetFor.full_name}`} value={pw} onChange={setPw} autoComplete="new-password" hint={POLICY} /></div>
          <button type="button" className="btn btn-text" onClick={() => setResetFor(null)}>Batal</button>
          <Key type="submit" tone="primary" glyph="simpan" m={reset}>Reset kata sandi</Key>
        </form>
      )}
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>Pengguna</SectionTitle>
        <div role="group" aria-label="Tampilan pengguna" className="seg">{(["kartu", "tabel"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "kartu" ? "Kartu" : "Tabel"}</button>)}</div>
      </div>
      {q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : view === "tabel" ? (
        <DataTable<Row> label="Pengguna" data={q.data ?? []} columns={columns} loading={q.isLoading} empty="Belum ada pengguna." />
      ) : q.isLoading ? <div className="sheet p-6"><Pencil w={40} /></div> : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((u) => (
            <li key={u.id} className={clsx("sheet grid gap-3 px-5 py-4", !u.is_active && "opacity-70")}>
              <div className="flex items-center gap-3">
                <span className="avatar h-11 w-11 text-base" aria-hidden="true">{initials(u.full_name)}</span>
                <div className="min-w-0"><p className="truncate font-medium">{u.full_name}</p><p className="truncate text-table text-muted">{u.email}</p></div>
              </div>
              <p className="text-table"><span className="font-medium">{u.role}</span><span className="text-muted"> · {branchName(u.branch_id)}</span></p>
              <div className="flex flex-wrap items-center justify-between gap-2">{sw(u)}<button className="btn btn-sm" onClick={() => { setResetFor(u); setPw(""); }}>Reset kata sandi</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10">
        <SectionTitle>Peran dan izin</SectionTitle>
        <p className="mb-3 max-w-prose text-table text-muted">Izin menentukan menu, dasbor, dan aksi yang tampil. Backend tetap memeriksa setiap permintaan.</p>
        {roles.isError ? <ErrorNote error={roles.error} retry={() => roles.refetch()} /> : roles.data ? <PermissionMatrix roles={roles.data} /> : <Pencil w={60} />}
      </div>
    </>
  );
}

export function NewUser() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { branches } = useSession();
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<Row[]>("/system/roles") });
  const [v, setV] = useState({ full_name: "", email: "", password: "", role_id: "", branch_id: "" });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api("/system/users", { method: "POST", body: { ...v, role_id: Number(v.role_id), branch_id: v.branch_id ? Number(v.branch_id) : null } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["users"] }); toast("Pengguna dibuat."); nav("/system/users"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Pengguna tidak bisa dibuat. Periksa isian, lalu coba lagi."),
  });
  const role = (roles.data ?? []).find((r) => String(r.id) === v.role_id);
  return (
    <>
      <PageHeader title="Pengguna baru" sub="Bagikan kata sandi awal lewat saluran yang aman. Pengguna dapat menggantinya di Akun saya." />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate(); }}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup first title="Akun" hint="Email dipakai untuk masuk.">
          <div className="grid max-w-xl gap-3">
            <Field label="Nama lengkap"><input className="field" name="full_name" required minLength={2} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
            <Field label="Email"><input className="field" name="email" spellCheck={false} type="email" autoComplete="off" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
            <PasswordField label="Kata sandi awal" value={v.password} onChange={(p) => setV({ ...v, password: p })} autoComplete="new-password" hint={POLICY} />
          </div>
        </FormGroup>
        <FormGroup title="Akses" hint="Peran menentukan halaman dan aksi yang tersedia.">
          <div className="grid max-w-xl gap-3">
            <Field label="Peran" hint={role ? `${role.permissions.length} izin: ${role.permissions.join(", ")}` : undefined}>
              <select className="field" name="role_id" required value={v.role_id} onChange={(e) => setV({ ...v, role_id: e.target.value })}>
                <option value="">Pilih peran</option>{(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Cabang utama">
              <select className="field" name="branch_id" value={v.branch_id} onChange={(e) => setV({ ...v, branch_id: e.target.value })}>
                <option value="">Tidak ada</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
        </FormGroup>
        <ActionBar><Link className="btn btn-text" to="/system/users">Batal</Link><Key type="submit" tone="primary" glyph="buat" m={save}>Buat pengguna</Key></ActionBar>
      </form>
    </>
  );
}

/** Pilihan radio dalam grup berlabel. */
function Choice<T extends string>({ legend, hint, value, options, onChange }: { legend: string; hint?: ReactNode; value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1">
      <legend className="text-table font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-1 grid gap-1">
        {options.map(([v, label, note]) => (
          <label key={v} className="rd"><input type="radio" name={legend} value={v} checked={value === v} onChange={() => onChange(v)} /><span>{label}{note && <span className="block text-xs text-muted">{note}</span>}</span></label>
        ))}
      </div>
    </fieldset>
  );
}
function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid gap-1">
      <button type="button" role="switch" aria-checked={on} className="sw" onClick={() => onChange(!on)}><span className="rail"><span className="knob" /></span><span className="text-table font-medium">{label}</span></button>
      {hint && <p className="pl-[50px] text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Preferensi tampilan per perangkat (8): Gerak, Kepadatan, Tekstur kertas; Cahaya meja dan Suara (O2, O3) bawaannya mati. */
function DisplayPrefs() {
  const p = usePrefs();
  const os = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <FormGroup title="Preferensi tampilan" hint="Disimpan di perangkat ini saja.">
      <div className="grid gap-6 sm:grid-cols-2">
        <Choice<MotionPref> legend="Gerak" hint={`Ikuti sistem saat ini berarti ${os ? "Dikurangi" : "Penuh"}.`} value={p.motion} onChange={(v) => setPrefs({ motion: v })}
          options={[["auto", "Ikuti sistem operasi"], ["full", "Penuh", "Semua gerak, termasuk momen khas."], ["reduced", "Dikurangi", "Tanpa gerak posisi, skala, dan rotasi; momen khas langsung di keadaan akhir."], ["minimal", "Minimal", "Tanpa animasi, kecuali indikator memuat."]]} />
        <div className="grid content-start gap-6">
          <Choice legend="Kepadatan" value={p.density} onChange={(v) => setPrefs({ density: v })} options={[["comfortable", "Nyaman"], ["compact", "Rapat", "Baris tabel lebih pendek."]]} />
          <Toggle label="Tekstur kertas" hint="Serat kertas halus di latar. Selalu mati saat cetak dan mode kontras tinggi." on={p.texture} onChange={(v) => setPrefs({ texture: v })} />
          {FEATURES.deskLight && <Toggle label="Cahaya meja" hint="Nada kertas bergeser halus mengikuti jam: pagi lebih dingin, sore dan malam lebih hangat." on={p.deskLight} onChange={(v) => setPrefs({ deskLight: v })} />}
          {FEATURES.sound && <Toggle label="Suara dan getar" hint="Bunyi pelan saat cap, struk, dan tutup buku. Getar singkat di ponsel yang mendukung." on={p.sound} onChange={(v) => setPrefs({ sound: v })} />}
        </div>
      </div>
    </FormGroup>
  );
}

export function Account() {
  const { me, signOut } = useSession();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api("/auth/change-password", { method: "POST", body: { current_password: cur, new_password: next } }),
    onSuccess: () => { toast("Kata sandi diganti. Silakan masuk lagi."); signOut(); nav("/login"); },
    onError: (e) => setError(e instanceof Error ? e.message : "Kata sandi tidak bisa diganti. Periksa kata sandi saat ini, lalu coba lagi."),
  });
  const mismatch = again !== "" && again !== next;
  return (
    <>
      <PageHeader title="Akun saya" sub={`${me?.email} · ${me?.role}`} />
      <div className="mb-6 flex items-center gap-4">
        <span className="avatar h-14 w-14 text-lg" aria-hidden="true">{initials(me?.full_name)}</span>
        <div><p className="font-serif text-lg font-medium">{me?.full_name}</p><p className="text-table text-muted">{me?.role} · {me?.permissions.length} izin</p></div>
      </div>
      <DisplayPrefs />
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (mismatch) { document.querySelector<HTMLInputElement>("input[name=repeat-password]")?.focus(); return; } save.mutate(); }}>
        {error && <p role="alert" className="mb-2 border-y border-bad py-3 text-sm text-bad">{error}</p>}
        <FormGroup title="Ganti kata sandi" hint="Setelah diganti, Anda keluar dari semua sesi.">
          <div className="grid max-w-sm gap-3">
            <PasswordField label="Kata sandi saat ini" value={cur} onChange={setCur} autoComplete="current-password" />
            <PasswordField label="Kata sandi baru" value={next} onChange={setNext} autoComplete="new-password" hint={POLICY} />
            <Field label="Ulangi kata sandi baru" error={mismatch ? "Kata sandi tidak sama. Ketik ulang kata sandi baru." : null}>
              <input className={`field ${mismatch ? "field-error" : ""}`} aria-invalid={mismatch || undefined} type="password" name="repeat-password" autoComplete="new-password" required minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} />
            </Field>
          </div>
        </FormGroup>
        <ActionBar><Key type="submit" tone="primary" glyph="simpan" m={save}>Ganti kata sandi</Key></ActionBar>
      </form>
    </>
  );
}
