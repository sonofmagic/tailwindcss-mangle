import { defineConfig } from 'vite'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
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
