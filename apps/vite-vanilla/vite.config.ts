import { defineConfig } from 'vite'
import utwm from 'unplugin-tailwindcss-mangle/vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    utwm({
      classMapOutput: true
    })
  ]
})
