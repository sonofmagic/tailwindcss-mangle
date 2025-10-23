import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../logger'
import { transformPostcssPlugin, transformProcessTailwindFeaturesReturnContext } from './postcss-v3'
import { transformPostcssPluginV2, transformProcessTailwindFeaturesReturnContextV2 } from './postcss-v2'

export interface ExposeContextPatchParams {
  rootDir: string
  refProperty: string
  overwrite: boolean
  majorVersion: 2 | 3
}

export interface ExposeContextPatchResult {
  applied: boolean
  files: Record<string, string>
}

function writeFileIfRequired(filePath: string, code: string, overwrite: boolean, successMessage: string) {
  if (!overwrite) {
    return
  }

  fs.writeFileSync(filePath, code, {
    encoding: 'utf8',
  })
  logger.success(successMessage)
}

export function applyExposeContextPatch(params: ExposeContextPatchParams): ExposeContextPatchResult {
  const { rootDir, refProperty, overwrite, majorVersion } = params
  const result: ExposeContextPatchResult = {
    applied: false,
    files: {},
  }

  if (majorVersion === 3) {
    const processFileRelative = 'lib/processTailwindFeatures.js'
    const processFilePath = path.resolve(rootDir, processFileRelative)
    if (fs.existsSync(processFilePath)) {
      const content = fs.readFileSync(processFilePath, 'utf8')
      const { code, hasPatched } = transformProcessTailwindFeaturesReturnContext(content)
      result.files[processFileRelative] = code
      if (!hasPatched) {
        writeFileIfRequired(
          processFilePath,
          code,
          overwrite,
          'Patched Tailwind CSS processTailwindFeatures to expose runtime context.',
        )
        result.applied = true
      }
    }

    const pluginCandidates = ['lib/plugin.js', 'lib/index.js']
    const pluginRelative = pluginCandidates.find(candidate => fs.existsSync(path.resolve(rootDir, candidate)))
    if (pluginRelative) {
      const pluginPath = path.resolve(rootDir, pluginRelative)
      const content = fs.readFileSync(pluginPath, 'utf8')
      const { code, hasPatched } = transformPostcssPlugin(content, { refProperty })
      result.files[pluginRelative] = code
      if (!hasPatched) {
        writeFileIfRequired(
          pluginPath,
          code,
          overwrite,
          'Patched Tailwind CSS plugin entry to collect runtime contexts.',
        )
        result.applied = true
      }
    }
  }
  else if (majorVersion === 2) {
    const processFileRelative = 'lib/jit/processTailwindFeatures.js'
    const processFilePath = path.resolve(rootDir, processFileRelative)
    if (fs.existsSync(processFilePath)) {
      const content = fs.readFileSync(processFilePath, 'utf8')
      const { code, hasPatched } = transformProcessTailwindFeaturesReturnContextV2(content)
      result.files[processFileRelative] = code
      if (!hasPatched) {
        writeFileIfRequired(
          processFilePath,
          code,
          overwrite,
          'Patched Tailwind CSS JIT processTailwindFeatures to expose runtime context.',
        )
        result.applied = true
      }
    }

    const pluginRelative = 'lib/jit/index.js'
    const pluginPath = path.resolve(rootDir, pluginRelative)
    if (fs.existsSync(pluginPath)) {
      const content = fs.readFileSync(pluginPath, 'utf8')
      const { code, hasPatched } = transformPostcssPluginV2(content, { refProperty })
      result.files[pluginRelative] = code
      if (!hasPatched) {
        writeFileIfRequired(
          pluginPath,
          code,
          overwrite,
          'Patched Tailwind CSS JIT entry to collect runtime contexts.',
        )
        result.applied = true
      }
    }
  }

  return result
}
