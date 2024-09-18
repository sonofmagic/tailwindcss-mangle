import vue from '@vitejs/plugin-vue'
import utwm from 'unplugin-tailwindcss-mangle/vite'
import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    utwm({
      classMapOutput: true,
    }),
  ],
})
