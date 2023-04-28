import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    utwm({
      classSetOutput: true,
      classMapOutput: true
    })
  ]
})
