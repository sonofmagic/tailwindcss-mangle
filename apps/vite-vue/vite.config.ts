import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import utwm from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), utwm.vite()]
})
