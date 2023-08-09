import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import utwm from 'unplugin-tailwindcss-mangle/vite'
export default defineConfig({
  plugins: [
    solidPlugin(),
    utwm({
      classMapOutput: true
    })
  ],
  server: {
    port: 3000
  },
  build: {
    target: 'esnext'
  }
})
