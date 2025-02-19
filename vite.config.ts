import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import vue from "@vitejs/plugin-vue";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), vue(), topLevelAwait],
});
