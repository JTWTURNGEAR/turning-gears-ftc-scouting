import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project from /<repository-name>/.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? "/turning-gears-ftc-scouting/" : "/"
});
