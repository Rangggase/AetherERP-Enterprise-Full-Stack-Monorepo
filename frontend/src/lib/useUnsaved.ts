import { useEffect } from "react";

/**
 * Peringatan sebelum meninggalkan halaman dengan isian yang belum disimpan (pedoman antarmuka web: Forms).
 * BrowserRouter tidak punya penghalang navigasi di dalam aplikasi, jadi ini menjaga muat ulang, tutup tab, dan alamat baru.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/** Fokuskan isian galat pertama (atau pesan galat form) setelah validasi saat kirim (pedoman: focus first error on submit). */
export function focusFirstError(root: ParentNode = document): void {
  window.setTimeout(() => (root.querySelector<HTMLElement>('main [aria-invalid="true"]') ?? root.querySelector<HTMLElement>("main [data-form-error]"))?.focus(), 0);
}
