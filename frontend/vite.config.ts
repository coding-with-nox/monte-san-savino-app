import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_PROXY_TARGET permette di sovrascrivere il target del proxy in ambienti Docker
const backendTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(@mui|@emotion)\//.test(id)) return "mui";
          if (/node_modules\/(leaflet|react-leaflet|@react-leaflet)\//.test(id)) return "leaflet";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler)\//.test(id)) return "react";
          return undefined;
        }
      }
    }
  },
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
