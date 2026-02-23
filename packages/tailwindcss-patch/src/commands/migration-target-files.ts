import type { Dirent } from 'node:fs'

import fs from 'fs-extra'
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

const DEFAULT_CONFIG_FILENAME_SET = new Set<string>(DEFAULT_CONFIG_FILENAMES)
const DEFAULT_WORKSPACE_IGNORED_DIRS = new Set([
  '.git',
  '.idea',
  '.turbo',
  '.vscode',
  '.yarn',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
])
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
  const files = new Set<string>()
  const queue: Array<{ dir: string, depth: number }> = [{ dir: cwd, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }
    const { dir, depth } = current
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    }
    catch {
      continue
    }

    for (const entry of entries) {
      const absolutePath = path.resolve(dir, entry.name)

      if (entry.isFile() && DEFAULT_CONFIG_FILENAME_SET.has(entry.name)) {
        files.add(absolutePath)
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }
      if (DEFAULT_WORKSPACE_IGNORED_DIRS.has(entry.name)) {
        continue
      }
      if (depth >= maxDepth) {
        continue
      }
      queue.push({ dir: absolutePath, depth: depth + 1 })
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b))
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

function normalizePattern(pattern: string) {
  return pattern.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '')
}

function globToRegExp(globPattern: string) {
  const normalized = normalizePattern(globPattern)
  let pattern = ''

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]!
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        pattern += '.*'
        i += 1
      }
      else {
        pattern += '[^/]*'
      }
      continue
    }
    if (char === '?') {
      pattern += '[^/]'
      continue
    }
    if ('\\^$+?.()|{}[]'.includes(char)) {
      pattern += `\\${char}`
      continue
    }
    pattern += char
  }

  return new RegExp(`^${pattern}$`)
}

function toPatternList(patterns?: string[]) {
  if (!patterns || patterns.length === 0) {
    return []
  }
  return patterns
    .map(pattern => pattern.trim())
    .filter(Boolean)
    .map(globToRegExp)
}

function normalizeFileForPattern(file: string, cwd: string) {
  const relative = path.relative(cwd, file)
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, '/')
  }
  return file.replace(/\\/g, '/')
}

export function filterTargetFiles(targetFiles: string[], cwd: string, include?: string[], exclude?: string[]) {
  const includePatterns = toPatternList(include)
  const excludePatterns = toPatternList(exclude)

  if (includePatterns.length === 0 && excludePatterns.length === 0) {
    return targetFiles
  }

  return targetFiles.filter((file) => {
    const normalized = normalizeFileForPattern(file, cwd)
    const inInclude = includePatterns.length === 0 || includePatterns.some(pattern => pattern.test(normalized))
    if (!inInclude) {
      return false
    }
    const inExclude = excludePatterns.some(pattern => pattern.test(normalized))
    return !inExclude
  })
}
