import path from 'path'
import fs from 'fs'
import { gte } from 'semver'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './inspector'
import type { PatchOptions, InternalPatchOptions } from './type'
import type { PackageJson } from 'pkg-types'
import { defu } from 'defu'
import { defaultOptions } from './defaults'
import { ensureFileContent, requireResolve } from './utils'

export function getInstalledPkgJsonPath(options: PatchOptions) {
  try {
    // const cwd = process.cwd()
    const tmpJsonPath = requireResolve(`tailwindcss/package.json`, {
      paths: options.paths,
      basedir: options.basedir ?? process.cwd()
    })

    const pkgJson = require(tmpJsonPath) as PackageJson
    // https://github.com/sonofmagic/weapp-tailwindcss-webpack-plugin

    if (gte(pkgJson.version!, '3.0.0')) {
      return tmpJsonPath
    }
  } catch (error) {
    if ((<Error & { code: string }>error).code === 'MODULE_NOT_FOUND') {
      console.warn('Can\'t find npm pkg: `tailwindcss`, Please ensure it has been installed!')
    }
  }
}

export function createPatch(options: PatchOptions) {
  const opt = defu(options, defaultOptions) as InternalPatchOptions
  return () => {
    try {
      return internalPatch(getInstalledPkgJsonPath(options), opt)
    } catch (error) {
      console.warn(`patch tailwindcss failed:` + (<Error>error).message)
    }
  }
}

export function monkeyPatchForExposingContext(rootDir: string, opt: InternalPatchOptions) {
  const processTailwindFeaturesFilePath = path.resolve(rootDir, 'lib/processTailwindFeatures.js')

  const processTailwindFeaturesContent = ensureFileContent(processTailwindFeaturesFilePath)
  const result: { processTailwindFeatures?: string; plugin?: string } = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(processTailwindFeaturesContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(processTailwindFeaturesFilePath, code, {
        encoding: 'utf-8'
      })
      console.log('patch tailwindcss processTailwindFeatures for return content successfully!')
    }
    result.processTailwindFeatures = code
  }

  const pluginFilePath = path.resolve(rootDir, 'lib/plugin.js')
  const indexFilePath = path.resolve(rootDir, 'lib/index.js')
  const pluginContent = ensureFileContent([pluginFilePath, indexFilePath])
  if (pluginContent) {
    const { code, hasPatched } = inspectPostcssPlugin(pluginContent)
    if (!hasPatched && opt.overwrite) {
      fs.writeFileSync(pluginFilePath, code, {
        encoding: 'utf-8'
      })
      console.log('patch tailwindcss for expose runtime content successfully!')
    }
    result.plugin = code
  }
  return result
}

export function internalPatch(pkgJsonPath: string | undefined, options: InternalPatchOptions): any | undefined {
  if (pkgJsonPath) {
    const rootDir = path.dirname(pkgJsonPath)
    const result = monkeyPatchForExposingContext(rootDir, options)
    return result
  }
}
