import path from 'node:path'
import fs from 'node:fs'
import { gte } from 'semver'
import type { PackageJson } from 'pkg-types'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './inspector'
import { inspectPostcssPlugin as inspectPostcssPluginCompat, inspectProcessTailwindFeaturesReturnContext as inspectProcessTailwindFeaturesReturnContextCompat } from './inspector-postcss7-compat'
import type { InternalPatchOptions } from '@/types'
import { ensureFileContent } from '@/utils'

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
      console.log('patch tailwindcss processTailwindFeatures for return content successfully!')
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
      console.log('patch tailwindcss for expose runtime content successfully!')
    }
    result.plugin = code
  }

  opt.custom && typeof opt.custom === 'function' && opt.custom(twDir, result)
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
      console.log('patch tailwindcss processTailwindFeatures for return content successfully!')
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
      console.log('patch tailwindcss for expose runtime content successfully!')
    }
    result.plugin = code
  }

  opt.custom && typeof opt.custom === 'function' && opt.custom(twDir, result)
  return result
}

export function internalPatch(pkgJsonPath: string | undefined, options: InternalPatchOptions): any | undefined {
  if (pkgJsonPath) {
    // eslint-disable-next-line ts/no-var-requires, ts/no-require-imports
    const pkgJson = require(pkgJsonPath) as PackageJson
    const twDir = path.dirname(pkgJsonPath)
    if (gte(pkgJson.version!, '3.0.0')) {
      options.version = pkgJson.version
      const result = monkeyPatchForExposingContextV3(twDir, options)
      return result
    }
    else if (gte(pkgJson.version!, '2.0.0')) {
      options.version = pkgJson.version
      const result = monkeyPatchForExposingContextV2(twDir, options)
      return result
    }
    // no sth
  }
}
