import clsx from "clsx";
import { Link } from "react-router-dom";
import { FEATURES } from "../../config/features";
import { date } from "../../lib/format";
import { Glyph, type GlyphName } from "../glyphs";
import { RoomLink } from "../RoomLink";
import { Cap } from "../ui";
import "./DocChain.css";

export interface ChainDoc { id: number | string; number: string; date?: string; status?: string; to?: string; room?: string }
export interface ChainStep {
  key: string;
  label: string;
  glyph: GlyphName;
  docs: ChainDoc[];
  /** done: dokumen ada dan tertaut lewat id; current: dokumen yang sedang dibuka; missing: belum dibuat;
   *  unlinked: status dokumen menyatakan langkah ini sudah ada, tetapi API tidak memberi id untuk menautkannya. */
  state: "done" | "current" | "missing" | "unlinked";
  action?: { label: string; to: string };
}

/**
 * M5 Rantai Dokumen: posisi dokumen dalam alur bisnis dan dokumen terkaitnya. Hanya relasi id yang dikembalikan API
 * (keputusan D1, 20 Nov 2026); tidak ada relasi yang ditebak dari nomor atau tanggal. Lembar mini dihubungkan benang tinta;
 * dokumen saat ini terangkat dengan pita penanda; langkah yang belum ada tampil putus-putus.
 */
export function DocChain({ steps, mini, label = "Rantai dokumen" }: { steps: ChainStep[]; mini?: boolean; label?: string }) {
  if (!FEATURES.docChain || steps.length === 0) return null;
  return (
    <nav aria-label={label}>
      {!mini && <p className="mb-1 flex items-center gap-1.5 text-xs text-muted md:hidden"><Glyph name="kirim" size={14} />Geser untuk melihat seluruh rantai</p>}
      <ol className={clsx("chain", mini && "mini")}>
        {steps.map((s, i) => {
          const top = s.docs[0];
          const todo = s.state === "missing" || s.state === "unlinked";
          const body = (
            <>
              {s.docs.length > 1 && <><span className="back1" aria-hidden="true" />{s.docs.length > 2 && <span className="back2" aria-hidden="true" />}<span className="stackn">{s.docs.length}</span></>}
              <span className="flex items-center gap-1 text-muted"><Glyph name={s.glyph} size={14} />{s.label}</span>
              {top ? <span className="no" translate="no">{top.number}</span> : <span>{s.state === "unlinked" ? "Sudah ada, tidak tertaut" : "Belum dibuat"}</span>}
              {top?.date && <span className="text-muted">{date(top.date)}</span>}
              {top?.status && !mini && <span className="mt-0.5"><Cap small value={top.status} seed={top.number} /></span>}
            </>
          );
          const title = s.docs.length > 1 ? `${s.label}: ${s.docs.map((d) => d.number).join(", ")}` : undefined;
          return (
            <li key={s.key} className="chain-step" aria-current={s.state === "current" ? "step" : undefined}>
              {i > 0 && <span className={clsx("chain-thread", todo && "todo")} aria-hidden="true" />}
              <div className="grid gap-1">
                {top?.to && s.state !== "current"
                  ? <RoomLink to={top.to} room={top.room} className="chain-sheet" title={title}>{body}</RoomLink>
                  : <div className={clsx("chain-sheet", s.state === "current" && "now", todo && "todo")} title={title}>{body}</div>}
                {s.action && <Link to={s.action.to} className="inline-flex min-h-8 items-center gap-1 px-1 text-xs font-medium text-brand hover:underline"><Glyph name="buat" size={14} />{s.action.label}</Link>}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
