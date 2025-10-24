import type { TailwindcssMangleConfig } from './types'
import { createDefineConfig, loadConfig } from 'c12'
import fs from 'fs-extra'
import path from 'pathe'
import { CONFIG_NAME } from './constants'
import { getDefaultUserConfig } from './defaults'

export function getConfig(cwd?: string) {
  return loadConfig<TailwindcssMangleConfig>({
    name: CONFIG_NAME,
    defaults: {
      ...getDefaultUserConfig(),
    },
    cwd,
  })
}

export const defineConfig = createDefineConfig<TailwindcssMangleConfig>()

export function initConfig(cwd: string) {
  return fs.outputFile(
    path.resolve(cwd, `${CONFIG_NAME}.config.ts`),
    `import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    output: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
  transformer: {
    registry: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
})
`,
    'utf8',
  )
}
