import path from 'node:path'
import fs from 'node:fs'
import { gte } from 'semver'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './inspector'
import type { PatchOptions, InternalPatchOptions } from '@/types'
import type { PackageJson } from 'pkg-types'
import { defu } from 'defu'
import { defaultOptions } from '@/defaults'
import { ensureFileContent, requireResolve } from '@/utils'

export function getInstalledPkgJsonPath(options: PatchOptions = {}) {
  try {
    // const cwd = process.cwd()
    const tmpJsonPath = requireResolve(`tailwindcss/package.json`, {
      paths: options.paths
    })

    return tmpJsonPath
    // https://github.com/sonofmagic/weapp-tailwindcss-webpack-plugin
    // only tailwindcss version > 3.0.0
  } catch (error) {
    if ((<Error & { code: string }>error).code === 'MODULE_NOT_FOUND') {
      console.warn("Can't find npm pkg: `tailwindcss`, Please ensure it has been installed!")
    }
  }
}

export function getPatchOptions(options: PatchOptions = {}) {
  return defu(
    options,
    {
      basedir: process.cwd()
    },
    defaultOptions
  ) as InternalPatchOptions
}

export function createPatch(opt: InternalPatchOptions) {
  return () => {
    try {
      const pkgJsonPath = getInstalledPkgJsonPath(opt)
      return internalPatch(pkgJsonPath, opt)
    } catch (error) {
      console.warn(`patch tailwindcss failed:` + (<Error>error).message)
    }
  }
}

export function monkeyPatchForExposingContext(twDir: string, opt: InternalPatchOptions) {
  const processTailwindFeaturesFilePath = path.resolve(twDir, 'lib/processTailwindFeatures.js')

  const processTailwindFeaturesContent = ensureFileContent(processTailwindFeaturesFilePath)
  const result: { processTailwindFeatures?: string; plugin?: string } & Record<string, any> = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf8'
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
        encoding: 'utf8'
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
    const pkgJson = require(pkgJsonPath) as PackageJson
    const twDir = path.dirname(pkgJsonPath)
    if (gte(pkgJson.version!, '3.0.0')) {
      options.version = pkgJson.version
      const result = monkeyPatchForExposingContext(twDir, options)
      return result
    }
    // no sth
  }
}
