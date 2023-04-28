import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    utwm({
      classSetOutput: true,
      classMapOutput: true
    })
  ]
})
