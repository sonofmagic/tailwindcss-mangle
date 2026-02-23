import type { TailwindcssPatchOptions } from '../types'
import type { TailwindcssPatchCommandContext } from './types'
import type { TokenGroupKey, TokenOutputFormat } from './token-output'

import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadWorkspaceConfigModule } from '../config/workspace'
import { groupTokensByFile } from '../extraction/candidate-extractor'
import logger from '../logger'
import {
  DEFAULT_TOKEN_REPORT,
  formatGroupedPreview,
  formatTokenLine,
  TOKEN_FORMATS,
} from './token-output'

const DEFAULT_CONFIG_NAME = 'tailwindcss-mangle'

export async function installCommandDefaultHandler(_ctx: TailwindcssPatchCommandContext<'install'>) {
  const patcher = new TailwindcssPatcher()
  await patcher.patch()
  logger.success('Tailwind CSS runtime patched successfully.')
}

export async function extractCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'extract'>) {
  const { args } = ctx
  const overrides: TailwindcssPatchOptions = {}
  let hasOverrides = false

  if (args.output || args.format) {
    overrides.extract = {
      ...(args.output === undefined ? {} : { file: args.output }),
      ...(args.format === undefined ? {} : { format: args.format }),
    }
    hasOverrides = true
  }

  if (args.css) {
    overrides.tailwindcss = {
      v4: {
        cssEntries: [args.css],
      },
    }
    hasOverrides = true
  }

  const patcher = await ctx.createPatcher(hasOverrides ? overrides : undefined)
  const extractOptions = args.write === undefined ? {} : { write: args.write }
  const result = await patcher.extract(extractOptions)

  if (result.filename) {
    logger.success(`Collected ${result.classList.length} classes → ${result.filename}`)
  }
  else {
    logger.success(`Collected ${result.classList.length} classes.`)
  }

  return result
}

export async function tokensCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'tokens'>) {
  const { args } = ctx
  const patcher = await ctx.createPatcher()
  const report = await patcher.collectContentTokens()

  const shouldWrite = args.write ?? true
  let format: TokenOutputFormat = args.format ?? 'json'
  if (!TOKEN_FORMATS.includes(format)) {
    format = 'json'
  }
  const targetFile = args.output ?? DEFAULT_TOKEN_REPORT
  const groupKey: TokenGroupKey = args.groupKey === 'absolute' ? 'absolute' : 'relative'
  const buildGrouped = () =>
    groupTokensByFile(report, {
      key: groupKey,
      stripAbsolutePaths: groupKey !== 'absolute',
    })
  const grouped = format === 'grouped-json' ? buildGrouped() : null
  const resolveGrouped = () => grouped ?? buildGrouped()

  if (shouldWrite) {
    const target = path.resolve(targetFile)
    await fs.ensureDir(path.dirname(target))
    if (format === 'json') {
      await fs.writeJSON(target, report, { spaces: 2 })
    }
    else if (format === 'grouped-json') {
      await fs.writeJSON(target, resolveGrouped(), { spaces: 2 })
    }
    else {
      const lines = report.entries.map(formatTokenLine)
      await fs.writeFile(target, `${lines.join('\n')}\n`, 'utf8')
    }
    logger.success(`Collected ${report.entries.length} tokens (${format}) → ${target.replace(process.cwd(), '.')}`)
  }
  else {
    logger.success(`Collected ${report.entries.length} tokens from ${report.filesScanned} files.`)
    if (format === 'lines') {
      const preview = report.entries.slice(0, 5).map(formatTokenLine).join('\n')
      if (preview) {
        logger.log('')
        logger.info(preview)
        if (report.entries.length > 5) {
          logger.info(`…and ${report.entries.length - 5} more.`)
        }
      }
    }
    else if (format === 'grouped-json') {
      const map = resolveGrouped()
      const { preview, moreFiles } = formatGroupedPreview(map)
      if (preview) {
        logger.log('')
        logger.info(preview)
        if (moreFiles > 0) {
          logger.info(`…and ${moreFiles} more files.`)
        }
      }
    }
    else {
      const previewEntries = report.entries.slice(0, 3)
      if (previewEntries.length) {
        logger.log('')
        logger.info(JSON.stringify(previewEntries, null, 2))
      }
    }
  }

  if (report.skippedFiles.length) {
    logger.warn('Skipped files:')
    for (const skipped of report.skippedFiles) {
      logger.warn(`  • ${skipped.file} (${skipped.reason})`)
    }
  }

  return report
}

export async function initCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'init'>) {
  const configModule = await loadWorkspaceConfigModule()
  await configModule.initConfig(ctx.cwd)
  const configName = configModule.CONFIG_NAME || DEFAULT_CONFIG_NAME
  logger.success(`✨ ${configName}.config.ts initialized!`)
}
