import type { PackageInfo } from 'local-pkg'
import type {
  NormalizedExtendLengthUnitsOptions,
  NormalizedTailwindcssPatchOptions,
} from '../options/types'
import type { PatchStatusEntry, PatchStatusReport } from '../types'
import * as t from '@babel/types'
import fs from 'fs-extra'
import path from 'pathe'

import { parse, traverse } from '../babel'
import { transformPostcssPluginV2, transformProcessTailwindFeaturesReturnContextV2 } from './operations/export-context/postcss-v2'
import { transformPostcssPlugin, transformProcessTailwindFeaturesReturnContext } from './operations/export-context/postcss-v3'
import { applyExtendLengthUnitsPatchV4 } from './operations/extend-length-units'

interface PatchStatusContext {
  packageInfo: PackageInfo
  options: NormalizedTailwindcssPatchOptions
  majorVersion: 2 | 3 | 4
}

function inspectLengthUnitsArray(
  content: string,
  variableName: string,
  units: string[],
) {
  const ast = parse(content)
  let found = false
  let missingUnits: string[] = []

  traverse(ast, {
    Identifier(path) {
      if (
        path.node.name === variableName
        && t.isVariableDeclarator(path.parent)
        && t.isArrayExpression(path.parent.init)
      ) {
        found = true
        const existing = new Set(
          path.parent.init.elements
            .map(element => (t.isStringLiteral(element) ? element.value : undefined))
            .filter(Boolean) as string[],
        )
        missingUnits = units.filter(unit => !existing.has(unit))
        path.stop()
      }
    },
  })

  return {
    found,
    missingUnits,
  }
}

function checkExposeContextPatch(context: PatchStatusContext): PatchStatusEntry {
  const { packageInfo, options, majorVersion } = context
  const refProperty = options.features.exposeContext.refProperty

  if (!options.features.exposeContext.enabled) {
    return {
      name: 'exposeContext',
      status: 'skipped',
      reason: 'exposeContext feature disabled',
      files: [],
    }
  }

  if (majorVersion === 4) {
    return {
      name: 'exposeContext',
      status: 'unsupported',
      reason: 'Context export patch is only required for Tailwind v2/v3',
      files: [],
    }
  }

  const checks: Array<{ relative: string, exists: boolean, patched: boolean }> = []

  function inspectFile(
    relative: string,
    transform: (content: string) => { hasPatched: boolean },
  ) {
    const filePath = path.resolve(packageInfo.rootPath, relative)
    if (!fs.existsSync(filePath)) {
      checks.push({ relative, exists: false, patched: false })
      return
    }
    const content = fs.readFileSync(filePath, 'utf8')
    const { hasPatched } = transform(content)
    checks.push({
      relative,
      exists: true,
      patched: hasPatched,
    })
  }

  if (majorVersion === 3) {
    inspectFile('lib/processTailwindFeatures.js', transformProcessTailwindFeaturesReturnContext)
    const pluginCandidates = ['lib/plugin.js', 'lib/index.js']
    const pluginRelative = pluginCandidates.find(candidate => fs.existsSync(path.resolve(packageInfo.rootPath, candidate)))
    if (pluginRelative) {
      inspectFile(pluginRelative, content => transformPostcssPlugin(content, { refProperty }))
    }
    else {
      checks.push({ relative: 'lib/plugin.js', exists: false, patched: false })
    }
  }
  else {
    inspectFile('lib/jit/processTailwindFeatures.js', transformProcessTailwindFeaturesReturnContextV2)
    inspectFile('lib/jit/index.js', content => transformPostcssPluginV2(content, { refProperty }))
  }

  const files = checks.filter(check => check.exists).map(check => check.relative)
  const missingFiles = checks.filter(check => !check.exists)
  const unpatchedFiles = checks.filter(check => check.exists && !check.patched)

  const reasons: string[] = []
  if (missingFiles.length) {
    reasons.push(`missing files: ${missingFiles.map(item => item.relative).join(', ')}`)
  }
  if (unpatchedFiles.length) {
    reasons.push(`unpatched files: ${unpatchedFiles.map(item => item.relative).join(', ')}`)
  }

  return {
    name: 'exposeContext',
    status: reasons.length ? 'not-applied' : 'applied',
    reason: reasons.length ? reasons.join('; ') : undefined,
    files,
  }
}

function checkExtendLengthUnitsV3(rootDir: string, options: NormalizedExtendLengthUnitsOptions): PatchStatusEntry {
  const lengthUnitsFilePath = options.lengthUnitsFilePath ?? 'lib/util/dataTypes.js'
  const variableName = options.variableName ?? 'lengthUnits'
  const target = path.resolve(rootDir, lengthUnitsFilePath)
  const files = fs.existsSync(target) ? [path.relative(rootDir, target)] : []

  if (!fs.existsSync(target)) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: `missing ${lengthUnitsFilePath}`,
      files,
    }
  }

  const content = fs.readFileSync(target, 'utf8')
  const { found, missingUnits } = inspectLengthUnitsArray(content, variableName, options.units)

  if (!found) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: `could not locate ${variableName} array in ${lengthUnitsFilePath}`,
      files,
    }
  }

  if (missingUnits.length) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: `missing units: ${missingUnits.join(', ')}`,
      files,
    }
  }

  return {
    name: 'extendLengthUnits',
    status: 'applied',
    files,
  }
}

function checkExtendLengthUnitsV4(rootDir: string, options: NormalizedExtendLengthUnitsOptions): PatchStatusEntry {
  const distDir = path.resolve(rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: 'dist directory not found for Tailwind v4 package',
      files: [],
    }
  }

  const result = applyExtendLengthUnitsPatchV4(rootDir, {
    ...options,
    enabled: true,
    overwrite: false,
  })

  if (result.files.length === 0) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: 'no bundle chunks matched the length unit pattern',
      files: [],
    }
  }

  const files = result.files.map(file => path.relative(rootDir, file.file))
  const pending = result.files.filter(file => !file.hasPatched)
  if (pending.length) {
    return {
      name: 'extendLengthUnits',
      status: 'not-applied',
      reason: `missing units in ${pending.length} bundle${pending.length > 1 ? 's' : ''}`,
      files: pending.map(file => path.relative(rootDir, file.file)),
    }
  }

  return {
    name: 'extendLengthUnits',
    status: 'applied',
    files,
  }
}

function checkExtendLengthUnitsPatch(context: PatchStatusContext): PatchStatusEntry {
  const { packageInfo, options, majorVersion } = context

  if (!options.features.extendLengthUnits) {
    return {
      name: 'extendLengthUnits',
      status: 'skipped',
      reason: 'extendLengthUnits feature disabled',
      files: [],
    }
  }

  if (majorVersion === 2) {
    return {
      name: 'extendLengthUnits',
      status: 'unsupported',
      reason: 'length unit extension is only applied for Tailwind v3/v4',
      files: [],
    }
  }

  if (majorVersion === 3) {
    return checkExtendLengthUnitsV3(packageInfo.rootPath, options.features.extendLengthUnits)
  }

  return checkExtendLengthUnitsV4(packageInfo.rootPath, options.features.extendLengthUnits)
}

export function getPatchStatusReport(context: PatchStatusContext): PatchStatusReport {
  return {
    package: {
      name: context.packageInfo.name ?? context.packageInfo.packageJson?.name,
      version: context.packageInfo.version,
      root: context.packageInfo.rootPath,
    },
    majorVersion: context.majorVersion,
    entries: [
      checkExposeContextPatch(context),
      checkExtendLengthUnitsPatch(context),
    ],
  }
}
