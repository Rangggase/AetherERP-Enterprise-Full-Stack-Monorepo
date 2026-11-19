import { KeyLink } from "../components/Key";
import { Illustration } from "../components/ui";

/** 404: buku tertutup, satu kalimat, satu aksi. */
export function NotFound() {
  return (
    <div className="sheet mx-auto mt-6 grid max-w-lg justify-items-center gap-3 px-6 py-10 text-center">
      <Illustration art="buku-tertutup" />
      <h1 tabIndex={-1} className="font-serif text-xl font-medium outline-none">Halaman tidak ditemukan</h1>
      <p className="text-muted">Alamat ini tidak ada di AetherERP. Periksa tautannya, atau kembali ke dasbor.</p>
      <KeyLink to="/" glyph="dasbor">Buka dasbor</KeyLink>
    </div>
  );
}
