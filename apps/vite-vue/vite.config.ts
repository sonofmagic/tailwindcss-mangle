import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePlugin as utwm, defaultMangleClassFilter } from 'unplugin-tailwindcss-mangle'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    utwm({
      mangleClassFilter(className) {
        if (['ease-out', 'ease-linear', 'ease-in', 'ease-in-out'].includes(className)) {
          return false
        }
        return defaultMangleClassFilter(className)
      },
      classSetOutput: true,
      classMapOutput: true,
      jsHandlerOptions: {
        minified: true
      }
    })
  ]
})
