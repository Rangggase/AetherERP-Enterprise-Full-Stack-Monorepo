import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev proxy target can be overridden (VITE_API_TARGET) so a test backend can run on another port.
const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  // Tabel (@tanstack/react-table) dipisah dari vendor: hanya dimuat halaman daftar, bukan JS awal Dasbor.
  build: { rollupOptions: { output: { manualChunks: { vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"], table: ["@tanstack/react-table"] } } } },
  server: { port: 5173, proxy: { "/api": apiTarget } },
});
