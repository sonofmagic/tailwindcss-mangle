import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import utwm from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), utwm.vite()]
})
