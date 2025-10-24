import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  transformer: {
    preserve: {
      functions: ['twMerge'],
    },
  },
})
