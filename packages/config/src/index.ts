import { loadConfig, createDefineConfig } from 'c12'
import type { UserConfig } from './types'
import { getUserConfig } from './defaults'
import dedent from 'dedent'
import path from 'node:path'
import fs from 'node:fs/promises'
import { configName } from './constants'

export function getConfig(cwd?: string) {
  return loadConfig<UserConfig>({
    name: configName,
    defaults: {
      ...getUserConfig()
    },
    cwd
  })
}

export const defineConfig = createDefineConfig<UserConfig>()

export function initConfig(cwd: string) {
  return fs.writeFile(
    path.resolve(cwd, `${configName}.config.ts`),
    dedent`
      import { defineConfig } from 'tailwindcss-patch'

      export default defineConfig({})
    `,
    'utf8'
  )
}
