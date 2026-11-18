import { useEffect, useState } from "react";

interface T { id: number; text: string; kind: "ok" | "error" }
let seq = 0;

export const toast = (text: string, kind: T["kind"] = "ok"): void => {
  window.dispatchEvent(new CustomEvent<T>("aether:toast", { detail: { id: ++seq, text, kind } }));
};

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<T>).detail;
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.kind === "error" ? 6000 : 3500);
    };
    window.addEventListener("aether:toast", on);
    return () => window.removeEventListener("aether:toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-80 max-md:bottom-24" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`fade-in pointer-events-auto rounded border bg-surface p-3 text-sm ${t.kind === "error" ? "border-bad" : "border-ink"}`}>
          {t.kind === "error" && <span className="font-medium text-bad">Gagal. </span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
