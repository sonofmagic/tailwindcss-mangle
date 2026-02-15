import type { createDefineConfig, ResolvedConfig } from 'c12'
import type { TailwindcssMangleConfig } from './types'
import fs from 'fs-extra'
import path from 'pathe'
import { CONFIG_NAME } from './constants'
import { getDefaultUserConfig } from './defaults'

type DefineConfig = ReturnType<typeof createDefineConfig<TailwindcssMangleConfig>>

let c12Promise: Promise<typeof import('c12')> | undefined

async function loadC12() {
  if (!c12Promise) {
    c12Promise = import('c12')
  }
  return c12Promise
}

export async function getConfig(cwd?: string): Promise<ResolvedConfig<TailwindcssMangleConfig>> {
  const { loadConfig } = await loadC12()
  return loadConfig<TailwindcssMangleConfig>({
    name: CONFIG_NAME,
    defaults: {
      ...getDefaultUserConfig(),
    },
    ...(cwd === undefined ? {} : { cwd }),
  })
}

export const defineConfig: DefineConfig = config => config

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
