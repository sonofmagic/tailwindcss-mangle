import vue from '@vitejs/plugin-vue'
import { register } from 'tsx/esm/api'
import { defineConfig } from 'vite'

register()
const { default: utwm } = await import('unplugin-tailwindcss-mangle/vite')
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    utwm({
      registry: {
        mapping: true,
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
})
