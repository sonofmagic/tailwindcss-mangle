import { defineConfig } from 'vite'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [utwm()]
})
