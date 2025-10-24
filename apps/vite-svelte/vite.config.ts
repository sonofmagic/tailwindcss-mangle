import { svelte } from '@sveltejs/vite-plugin-svelte'
import utwm from 'unplugin-tailwindcss-mangle/vite'
import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    utwm({
      registry: {
        mapping: true,
      },
    }),
  ],
})
