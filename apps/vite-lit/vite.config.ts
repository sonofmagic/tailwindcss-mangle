import utwm from 'unplugin-tailwindcss-mangle/vite'
import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    utwm({
      registry: {
        mapping: true,
      },
    }),
  ],
})
