import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  // A Cloudflare quick tunnel gives phones an HTTPS URL, which AR requires (see docs/ar.md).
  preview: { allowedHosts: [".trycloudflare.com"] },
  server: {
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        // Override to run a second copy beside the default one (either name works).
        target: process.env.EXOSCOPE_API ?? process.env.EXO_API_URL ?? "http://127.0.0.1:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
