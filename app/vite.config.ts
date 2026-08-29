import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// production builds serve from https://<user>.github.io/Hackathon26/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/Hackathon26/" : "/",
  plugins: [react()],
}));
