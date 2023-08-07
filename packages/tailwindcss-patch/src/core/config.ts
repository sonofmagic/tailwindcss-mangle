import { loadConfig, createDefineConfig } from 'c12'
import { UserConfig } from '@/types'
import { getDefaultUserConfig } from '@/defaults'
import dedent from 'dedent'
import path from 'node:path'
import fs from 'node:fs/promises'

export function getConfig(cwd?: string) {
  return loadConfig<UserConfig>({
    name: 'tailwindcss-patch',
    defaults: {
      ...getDefaultUserConfig()
    },
    cwd
  })
}

export const defineConfig = createDefineConfig<UserConfig>()

export function initConfig(cwd: string) {
  return fs.writeFile(
    path.resolve(cwd, 'tailwindcss-patch.config.ts'),
    dedent`
      import { defineConfig } from 'tailwindcss-patch'

      export default defineConfig({})
    `,
    'utf8'
  )
}
