import path from 'node:path'
import fs from 'fs-extra'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './postcss-v3'
import { inspectPostcssPlugin as inspectPostcssPluginCompat, inspectProcessTailwindFeaturesReturnContext as inspectProcessTailwindFeaturesReturnContextCompat } from './postcss-v2'
import type { InternalPatchOptions } from '@/types'
import { ensureFileContent } from '@/utils'
import logger from '@/logger'

export function monkeyPatchForExposingContextV3(twDir: string, opt: InternalPatchOptions) {
  const processTailwindFeaturesFilePath = path.resolve(twDir, 'lib/processTailwindFeatures.js')

  const processTailwindFeaturesContent = ensureFileContent(processTailwindFeaturesFilePath)
  const result: { processTailwindFeatures?: string, plugin?: string } & Record<string, any> = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss processTailwindFeatures for return content successfully!')
    }
    result.processTailwindFeatures = code
  }

  const pluginFilePath = path.resolve(twDir, 'lib/plugin.js')
  const indexFilePath = path.resolve(twDir, 'lib/index.js')
  const pluginContent = ensureFileContent([pluginFilePath, indexFilePath])
  if (pluginContent) {
    const { code, hasPatched } = inspectPostcssPlugin(pluginContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(pluginFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss for expose runtime context successfully!')
    }
    result.plugin = code
  }

  return result
}

export function monkeyPatchForExposingContextV2(twDir: string, opt: InternalPatchOptions) {
  const processTailwindFeaturesFilePath = path.resolve(twDir, 'lib/jit/processTailwindFeatures.js')

  const processTailwindFeaturesContent = ensureFileContent(processTailwindFeaturesFilePath)
  const result: { processTailwindFeatures?: string, plugin?: string } & Record<string, any> = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContextCompat(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss processTailwindFeatures for return content successfully!')
    }
    result.processTailwindFeatures = code
  }

  const indexFilePath = path.resolve(twDir, 'lib/jit/index.js')
  const pluginContent = ensureFileContent([indexFilePath])
  if (pluginContent) {
    const { code, hasPatched } = inspectPostcssPluginCompat(pluginContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(indexFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss for expose runtime content successfully!')
    }
    result.plugin = code
  }

  return result
}
