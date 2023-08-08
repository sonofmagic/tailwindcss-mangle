import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import utwm from 'unplugin-tailwindcss-mangle/vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    utwm({
      classMapOutput: true
    })
  ]
})
