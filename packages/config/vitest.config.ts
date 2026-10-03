import path from 'pathe'
import { defineVitestProjectConfig } from 'repoctl/tooling'
import { defineProject } from 'vitest/config'

export default defineProject(async () => {
  const project = await defineVitestProjectConfig({
    cwd: path.resolve(import.meta.dirname, '../..'),
    options: {
      alias: [
        {
          find: '@',
          replacement: path.resolve(import.meta.dirname, './src'),
        },
      ],
    },
  })

  return {
    ...project,
    test: {
      ...project.test,
      coverage: {
        exclude: [
          'src/types.ts',
          'dist/**',
          'tsdown.config.ts',
          'vitest.config.ts',
          'test/fixtures/**',
        ],
      },
    },
  }
})
