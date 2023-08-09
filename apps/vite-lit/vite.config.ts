import { defineConfig } from 'vite'
import utwm from 'unplugin-tailwindcss-mangle/vite'
// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: 'src/my-element.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: /^lit/
    }
  },
  plugins: [utwm()]
})
