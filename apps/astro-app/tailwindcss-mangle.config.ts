import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  transformer: {
    registry: {
      file: './tw-class-list.json',
    },
  },
})
