import { FLAT_NAV } from "../lib/nav";
import { useSession } from "../lib/session";
import { KeyLink } from "./Key";
import { Illustration } from "./ui";

/** Shown instead of a page the signed-in role may not open. The server enforces the same rule; this only explains it. */
export function NoAccess({ perm }: { perm?: string }) {
  const { can, me } = useSession();
  const first = FLAT_NAV.find((i) => can(i.perm));
  return (
    <div className="sheet mx-auto mt-6 grid max-w-lg justify-items-center gap-3 px-6 py-10 text-center">
      <Illustration art="gembok" className="h-[96px] w-auto" />
      <h1 className="font-serif text-xl font-medium tracking-[-0.005em] max-md:text-[26px] max-md:leading-8">Halaman ini di luar peran Anda</h1>
      <p className="text-muted">
        {perm ? <>Halaman ini butuh izin <code className="rounded-sm bg-highlight px-1 font-sans text-ink">{perm}</code>. </> : null}
        Peran {me?.role ?? "Anda"} tidak memilikinya. Minta administrator menambahkan izin jika memang diperlukan.
      </p>
      {first && <KeyLink to={first.to} glyph={first.glyph}>Buka {first.label}</KeyLink>}
    </div>
  );
}
