import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "web/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  build: { outDir: "../dist-web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
});
