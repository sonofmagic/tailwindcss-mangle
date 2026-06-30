import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import utwm from 'unplugin-tailwindcss-mangle/vite'

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      utwm({
        registry: {
          mapping: true,
        },
      }),
    ],
  },
})
