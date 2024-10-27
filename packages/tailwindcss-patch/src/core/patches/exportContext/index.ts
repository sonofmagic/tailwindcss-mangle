import type { InternalPatchOptions } from '../../../types'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../logger'
import { inspectPostcssPlugin as inspectPostcssPluginCompat, inspectProcessTailwindFeaturesReturnContext as inspectProcessTailwindFeaturesReturnContextCompat } from './postcss-v2'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './postcss-v3'

export function monkeyPatchForExposingContextV3(twDir: string, opt: InternalPatchOptions) {
  const k0 = 'lib/processTailwindFeatures.js'
  const processTailwindFeaturesFilePath = path.resolve(twDir, k0)

  const processTailwindFeaturesContent = fs.readFileSync(processTailwindFeaturesFilePath, 'utf8')
  const result: Record<string, any> = {}

  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss processTailwindFeatures for return context successfully!')
    }
    result[k0] = code
  }
  let injectFilepath
  let k1
  const try0 = 'lib/plugin.js'
  const try1 = 'lib/index.js'
  const pluginFilePath = path.resolve(twDir, try0)
  const indexFilePath = path.resolve(twDir, try1)
  if (fs.existsSync(pluginFilePath)) {
    k1 = try0
    injectFilepath = pluginFilePath
  }
  else if (fs.existsSync(indexFilePath)) {
    k1 = try1
    injectFilepath = indexFilePath
  }

  if (injectFilepath && k1) {
    const pluginContent = fs.readFileSync(injectFilepath, 'utf8')
    if (pluginContent) {
      const { code, hasPatched } = inspectPostcssPlugin(pluginContent)
      if (!hasPatched && opt.overwrite) {
        fs.writeFileSync(injectFilepath, code, {
          encoding: 'utf8',
        })
        logger.success('patch tailwindcss for expose runtime context successfully!')
      }
      result[k1] = code
    }

    return result
  }
}

export function monkeyPatchForExposingContextV2(twDir: string, opt: InternalPatchOptions) {
  const k0 = 'lib/jit/processTailwindFeatures.js'
  const processTailwindFeaturesFilePath = path.resolve(twDir, k0)

  const processTailwindFeaturesContent = fs.readFileSync(processTailwindFeaturesFilePath, 'utf8')
  const result: Record<string, any> = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContextCompat(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss processTailwindFeatures for return content successfully!')
    }
    result[k0] = code
  }
  const k1 = 'lib/jit/index.js'
  const indexFilePath = path.resolve(twDir, k1)
  const pluginContent = fs.readFileSync(indexFilePath, 'utf8')
  if (pluginContent) {
    const { code, hasPatched } = inspectPostcssPluginCompat(pluginContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(indexFilePath, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss for expose runtime content successfully!')
    }
    result[k1] = code
  }

  return result
}
