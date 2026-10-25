import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    proxy: {
      "/api": {
        // Override to run a second copy beside the default one, e.g. EXOSCOPE_API=http://127.0.0.1:8020.
        target: process.env.EXOSCOPE_API ?? "http://127.0.0.1:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
