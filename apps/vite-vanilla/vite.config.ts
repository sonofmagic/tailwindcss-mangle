import { register } from 'tsx/esm/api'
import { defineConfig } from 'vite'

register()
const { default: utwm } = await import('unplugin-tailwindcss-mangle/vite')
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    utwm({
      registry: {
        mapping: true,
      },
    }),
  ],
})
