import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite config for the renderer (React) process only.
// The Electron main process is compiled separately by tsc.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "@" maps to the src folder for clean imports
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tell Vite that Electron will load from this base URL in dev
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
