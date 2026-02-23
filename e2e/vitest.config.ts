import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['./**/*.test.ts'],
    testTimeout: 420_000,
    coverage: {
      enabled: false,
    },
  },
})
