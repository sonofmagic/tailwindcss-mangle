import path from 'node:path'
import { defineProject } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineProject({
  plugins: [tsconfigPaths()],
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
  },

  // build: {
  //   commonjsOptions: {
  //     transformMixedEsModules: true
  //   }
  // }
})
