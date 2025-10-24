import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    output: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
  transformer: {
    registry: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
})
