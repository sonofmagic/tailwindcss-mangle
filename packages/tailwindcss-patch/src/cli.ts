import type { LegacyTailwindcssPatcherOptions } from './options/legacy'
import type { TailwindcssPatchOptions } from './types'
import process from 'node:process'

import { CONFIG_NAME, getConfig, initConfig } from '@tailwindcss-mangle/config'
import { defu } from '@tailwindcss-mangle/shared'
import cac from 'cac'

import { TailwindcssPatcher } from './api/tailwindcss-patcher'
import logger from './logger'
import { fromLegacyOptions, fromUnifiedConfig } from './options/legacy'

const cli = cac('tw-patch')

async function loadPatchOptions(cwd: string, overrides?: TailwindcssPatchOptions) {
  const { config } = await getConfig(cwd)
  const legacyConfig = config as (typeof config) & { patch?: LegacyTailwindcssPatcherOptions['patch'] }
  const base = config?.registry
    ? fromUnifiedConfig(config.registry)
    : legacyConfig?.patch
      ? fromLegacyOptions({ patch: legacyConfig.patch })
      : {}
  const merged = defu<TailwindcssPatchOptions, TailwindcssPatchOptions[]>(overrides ?? {}, base)
  return merged
}

cli
  .command('install', 'Apply Tailwind CSS runtime patches')
  .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
  .action(async (args: { cwd: string }) => {
    const options = await loadPatchOptions(args.cwd)
    const patcher = new TailwindcssPatcher(options)
    await patcher.patch()
    logger.success('Tailwind CSS runtime patched successfully.')
  })

cli
  .command('extract', 'Collect generated class names into a cache file')
  .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
  .option('--output <file>', 'Override output file path')
  .option('--format <format>', 'Output format (json|lines)')
  .option('--css <file>', 'Tailwind CSS entry CSS when using v4')
  .option('--no-write', 'Skip writing to disk')
  .action(async (args: { cwd: string, output?: string, format?: 'json' | 'lines', css?: string, write?: boolean }) => {
    const overrides: TailwindcssPatchOptions = {}

    if (args.output || args.format) {
      overrides.output = {
        file: args.output,
        format: args.format,
      }
    }

    if (args.css) {
      overrides.tailwind = {
        v4: {
          cssEntries: [args.css],
        },
      }
    }

    const options = await loadPatchOptions(args.cwd, overrides)
    const patcher = new TailwindcssPatcher(options)
    const result = await patcher.extract({ write: args.write })

    if (result.filename) {
      logger.success(`Collected ${result.classList.length} classes → ${result.filename}`)
    }
    else {
      logger.success(`Collected ${result.classList.length} classes.`)
    }
  })

cli
  .command('init', 'Generate a tailwindcss-patch config file')
  .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
  .action(async (args: { cwd: string }) => {
    await initConfig(args.cwd)
    logger.success(`✨ ${CONFIG_NAME}.config.ts initialized!`)
  })

cli.help()
cli.parse()
