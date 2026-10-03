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
    define: {
      __DEV__: true,
    },
    test: {
      ...project.test,
      setupFiles: ['./vitest.setup.ts'],
    },
  }
})
