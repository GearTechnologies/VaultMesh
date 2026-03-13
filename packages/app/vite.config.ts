import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@vaultmesh/core": path.resolve(__dirname, "../../core/src"),
    },
  },
  define: {
    "process.env": "{}",
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "zustand", "ethers"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
