import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/html.test.ts'],
    coverage: {
      enabled: true,
      reportsDirectory: '../../coverage/vitest/tailwindcss-mangle-core'
    }
    // ...
  }
})
