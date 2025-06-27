// vitest.config.mts

import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"
import vue from "@vitejs/plugin-vue"
import { quasar, transformAssetUrls } from "@quasar/vite-plugin"




export default defineConfig({
  plugins: [
    tsconfigPaths({ loose: true }),
    vue({ template: { transformAssetUrls } }),
    quasar({ sassVariables: "src/quasar-variables.scss" })
  ],

  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "test/vitest/setup-file.ts",
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "test/vitest/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"
    ],
    coverage: { provider: "istanbul", include: ["src/**/*.{ts,vue}"] }
  },

})
