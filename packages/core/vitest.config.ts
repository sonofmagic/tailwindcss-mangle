import path from 'pathe'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: '@tailwindcss-mangle/engine/htmlparser2',
        replacement: path.resolve(__dirname, '../engine/src/htmlparser2.ts'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
  },
})
