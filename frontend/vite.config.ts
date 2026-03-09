import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_PROXY_TARGET permette di sovrascrivere il target del proxy in ambienti Docker
const backendTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
