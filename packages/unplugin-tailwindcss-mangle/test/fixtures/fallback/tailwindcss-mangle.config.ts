import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  mangle: {
    classListPath: './index.json',
  },
})
