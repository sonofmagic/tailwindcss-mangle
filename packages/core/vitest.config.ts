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
        {
          find: '@tailwindcss-mangle/engine/htmlparser2',
          replacement: path.resolve(import.meta.dirname, '../engine/src/htmlparser2.ts'),
        },
      ],
    },
  })

  return project
})
