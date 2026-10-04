import type { NormalizedExtendLengthUnitsOptions } from '../../options/types'
import { patchLengthUnitsNative } from '@tailwindcss-mangle/native'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../logger'

export function applyExtendLengthUnitsPatchV3(rootDir: string, options: NormalizedExtendLengthUnitsOptions) {
  if (!options.enabled) {
    return { changed: false, code: undefined }
  }

  const file = path.resolve(rootDir, options.lengthUnitsFilePath ?? 'lib/util/dataTypes.js')
  if (!fs.existsSync(file)) {
    return { changed: false, code: undefined }
  }

  const result = patchLengthUnitsNative(
    fs.readFileSync(file, 'utf8'),
    options.units,
    options.variableName ?? 'lengthUnits',
  )
  if (!result.changed) {
    return { changed: false, code: undefined }
  }

  if (options.overwrite) {
    fs.writeFileSync(options.destPath ? path.resolve(options.destPath) : file, result.code, 'utf8')
    logger.success('Patched Tailwind CSS length unit list (v3).')
  }
  return { changed: true, code: result.code }
}

interface V4FilePatch {
  file: string
  code: string
  hasPatched: boolean
}

export function applyExtendLengthUnitsPatchV4(rootDir: string, options: NormalizedExtendLengthUnitsOptions) {
  if (!options.enabled) {
    return { files: [], changed: false }
  }

  const distDir = path.resolve(rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    return { files: [], changed: false }
  }

  const files: V4FilePatch[] = []
  for (const entry of fs.readdirSync(distDir)) {
    if (!entry.endsWith('.js') && !entry.endsWith('.mjs')) {
      continue
    }
    const file = path.join(distDir, entry)
    const result = patchLengthUnitsNative(fs.readFileSync(file, 'utf8'), options.units)
    if (!result.matched) {
      continue
    }
    files.push({ file, code: result.code, hasPatched: !result.changed })
    if (result.changed && options.overwrite) {
      fs.writeFileSync(file, result.code, 'utf8')
    }
  }

  const changed = files.some(file => !file.hasPatched)
  if (changed) {
    logger.success('Patched Tailwind CSS length unit list (v4).')
  }
  return { changed, files }
}
