import react from '@vitejs/plugin-react'
import { register } from 'tsx/esm/api'
import { defineConfig } from 'vite'

register()
const { default: utwm } = await import('unplugin-tailwindcss-mangle/vite')

export default defineConfig({
  plugins: [
    react(),
    utwm({
      classMapOutput: true,
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
