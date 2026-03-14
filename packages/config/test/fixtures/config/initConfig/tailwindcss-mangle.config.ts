import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    extract: {
      file: '.tw-patch/tw-class-list.json',
    },
    tailwindcss: {
      version: 3,
    },
  },
  transformer: {
    registry: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
})
