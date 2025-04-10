import type { UserConfig } from './types'
import { createDefineConfig, loadConfig } from 'c12'
import fs from 'fs-extra'
import path from 'pathe'
import { CONFIG_NAME } from './constants'
import { getDefaultUserConfig } from './defaults'

export function getConfig(cwd?: string) {
  return loadConfig<UserConfig>({
    name: CONFIG_NAME,
    defaults: {
      ...getDefaultUserConfig(),
    },
    cwd,
  })
}

export const defineConfig = createDefineConfig<UserConfig>()

export function initConfig(cwd: string) {
  return fs.outputFile(
    path.resolve(cwd, `${CONFIG_NAME}.config.ts`),
    `import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({})
`,
    'utf8',
  )
}
