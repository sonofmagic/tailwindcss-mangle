import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import { vitePlugin as utwm } from 'unplugin-tailwindcss-mangle'
export default defineConfig({
  plugins: [
    solidPlugin(),
    utwm({
      classSetOutput: true,
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
