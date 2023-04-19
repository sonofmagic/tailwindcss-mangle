import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), utwm()]
})
