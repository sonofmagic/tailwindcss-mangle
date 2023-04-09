import path from 'path'
import fs from 'fs'
import { gte as semverGte } from 'semver'

import type { PackageJson } from 'pkg-types'

import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from './inspector'

function noop() {}

export function getInstalledPkgJsonPath(options: any) {
  try {
    // const cwd = process.cwd()
    const tmpJsonPath = require.resolve(`tailwindcss/package.json`, {
      paths: options.paths
    })

    const pkgJson = require(tmpJsonPath) as PackageJson
    // https://github.com/sonofmagic/weapp-tailwindcss-webpack-plugin

    if (semverGte(pkgJson.version!, '3.0.0')) {
      return tmpJsonPath
    }
  } catch (error) {
    if ((<Error & { code: string }>error).code === 'MODULE_NOT_FOUND') {
      console.warn('没有找到`tailwindcss`包，请确认是否安装。')
    }
  }
}

export function createPatch(options: any) {
  if (options === false) {
    return noop
  }
  return () => {
    try {
      return internalPatch(getInstalledPkgJsonPath(options), options)
    } catch (error) {
      console.warn(`patch tailwindcss failed:` + (<Error>error).message)
    }
  }
}

function ensureFileContent(filepaths: string | string[]) {
  if (typeof filepaths === 'string') {
    filepaths = [filepaths]
  }
  let content
  for (let i = 0; i < filepaths.length; i++) {
    const filepath = filepaths[i]
    if (fs.existsSync(filepath)) {
      content = fs.readFileSync(filepath, {
        encoding: 'utf-8'
      })
      break
    }
  }
  return content
}
export function monkeyPatchForExposingContext(rootDir: string, overwrite: boolean) {
  const processTailwindFeaturesFilePath = path.resolve(rootDir, 'lib/processTailwindFeatures.js')

  const processTailwindFeaturesContent = ensureFileContent(processTailwindFeaturesFilePath)
  const result: { processTailwindFeatures?: string; plugin?: string } = {}
  if (processTailwindFeaturesContent) {
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(processTailwindFeaturesContent)
    if (!hasPatched && overwrite) {
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
    const { code: code0, hasPatched: hasPatched0 } = inspectPostcssPlugin(pluginContent)
    if (!hasPatched0 && overwrite) {
      fs.writeFileSync(pluginFilePath, code0, {
        encoding: 'utf-8'
      })
      console.log('patch tailwindcss for expose runtime content successfully!')
    }
    result.plugin = code0
  }
  return result
}

export function internalPatch(pkgJsonPath: string | undefined, options: any, overwrite: boolean = true): any | undefined {
  if (pkgJsonPath) {
    const rootDir = path.dirname(pkgJsonPath)

    const result = monkeyPatchForExposingContext(rootDir, overwrite)
    return result
  }
}
