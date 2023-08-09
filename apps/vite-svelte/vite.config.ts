import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import utwm from 'unplugin-tailwindcss-mangle/vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    utwm({
      classMapOutput: true
    })
  ]
})
