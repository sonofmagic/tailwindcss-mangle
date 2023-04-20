import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
export default defineConfig({
  plugins: [solidPlugin(), utwm()],
  server: {
    port: 3000
  },
  build: {
    target: 'esnext'
  }
})
