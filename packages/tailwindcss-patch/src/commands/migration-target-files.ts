import { collectWorkspaceConfigFilesNative, filterMigrationTargetIndexesNative } from '@tailwindcss-mangle/native'
import path from 'pathe'

export const DEFAULT_CONFIG_FILENAMES = [
  'tailwindcss-patch.config.ts',
  'tailwindcss-patch.config.js',
  'tailwindcss-patch.config.mjs',
  'tailwindcss-patch.config.cjs',
  'tailwindcss-mangle.config.ts',
  'tailwindcss-mangle.config.js',
  'tailwindcss-mangle.config.mjs',
  'tailwindcss-mangle.config.cjs',
] as const

export const DEFAULT_WORKSPACE_MAX_DEPTH = 6

export function resolveTargetFiles(cwd: string, files?: string[]) {
  const candidates = files && files.length > 0 ? files : [...DEFAULT_CONFIG_FILENAMES]
  const resolved = new Set<string>()
  for (const file of candidates) {
    resolved.add(path.resolve(cwd, file))
  }
  return [...resolved]
}

export async function collectWorkspaceConfigFiles(cwd: string, maxDepth: number) {
  const files = await collectWorkspaceConfigFilesNative(path.resolve(cwd), Math.max(0, Math.floor(maxDepth)), [...DEFAULT_CONFIG_FILENAMES])
  return files.map(file => path.normalize(file)).sort((a, b) => a.localeCompare(b))
}

export function resolveBackupRelativePath(cwd: string, file: string) {
  const relative = path.relative(cwd, file)
  const isExternal = relative.startsWith('..') || path.isAbsolute(relative)
  if (isExternal) {
    const sanitized = file.replace(/[:/\\]+/g, '_')
    return path.join('__external__', `${sanitized}.bak`)
  }
  return `${relative}.bak`
}

function normalizeFileForPattern(file: string, cwd: string) {
  const relative = path.relative(cwd, file)
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, '/')
  }
  return file.replace(/\\/g, '/')
}

export function filterTargetFiles(targetFiles: string[], cwd: string, include?: string[], exclude?: string[]) {
  if (!include?.some(value => value.trim()) && !exclude?.some(value => value.trim())) {
    return targetFiles
  }
  const indexes = filterMigrationTargetIndexesNative(targetFiles.map(file => normalizeFileForPattern(file, cwd)), include ?? [], exclude ?? [])
  return indexes.map(index => targetFiles[index]!)
}
