import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 60_000,
    coverage: {
      enabled: true,
      reportsDirectory: '../../coverage/vitest/unplugin-tailwindcss-mangle'
    }
  }
})
