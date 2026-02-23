import { defineConfig } from 'astro/config'
import utwm from 'unplugin-tailwindcss-mangle/vite'

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      utwm({
        registry: {
          mapping: true,
        },
      }),
    ],
  },
})
