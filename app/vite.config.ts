import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// production builds serve from https://<user>.github.io/Blockprint/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/Blockprint/" : "/",
  plugins: [react()],
}));
