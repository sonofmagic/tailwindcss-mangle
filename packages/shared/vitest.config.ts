import path from 'pathe'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: {
      exclude: [
        'src/types.ts',
        'dist/**',
        'tsup.config.ts',
        'vitest.config.ts',
      ],
    },
  },
})
