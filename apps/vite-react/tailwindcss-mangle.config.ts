import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  mangle: {
    preserveFunction: ['twMerge', 'cn'],
  },
})
