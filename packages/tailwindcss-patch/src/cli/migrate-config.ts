import type { ObjectExpression, ObjectMethod, ObjectProperty } from '@babel/types'
import type { Dirent } from 'node:fs'
import generate from '@babel/generator'
import { parse } from '@babel/parser'
import * as t from '@babel/types'
import fs from 'fs-extra'
import path from 'pathe'
import { pkgName, pkgVersion } from '../constants'

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
const DEFAULT_WORKSPACE_MAX_DEPTH = 6
export const MIGRATION_REPORT_KIND = 'tw-patch-migrate-report'
export const MIGRATION_REPORT_SCHEMA_VERSION = 1

const ROOT_LEGACY_KEYS = ['cwd', 'overwrite', 'tailwind', 'features', 'output', 'applyPatches'] as const

type OptionObjectScope = 'root' | 'registry' | 'patch'

export interface ConfigSourceMigrationResult {
  changed: boolean
  code: string
  changes: string[]
}

export interface ConfigFileMigrationEntry {
  file: string
  changed: boolean
  written: boolean
  rolledBack: boolean
  backupFile?: string
  changes: string[]
}

export interface ConfigFileMigrationReport {
  reportKind: typeof MIGRATION_REPORT_KIND
  schemaVersion: typeof MIGRATION_REPORT_SCHEMA_VERSION
  generatedAt: string
  tool: {
    name: string
    version: string
  }
  cwd: string
  dryRun: boolean
  rollbackOnError: boolean
  backupDirectory?: string
  scannedFiles: number
  changedFiles: number
  writtenFiles: number
  backupsWritten: number
  unchangedFiles: number
  missingFiles: number
  entries: ConfigFileMigrationEntry[]
}

export interface MigrateConfigFilesOptions {
  cwd: string
  files?: string[]
  dryRun?: boolean
  workspace?: boolean
  maxDepth?: number
  rollbackOnError?: boolean
  backupDir?: string
  include?: string[]
  exclude?: string[]
}

export interface RestoreConfigFilesOptions {
  cwd: string
  reportFile: string
  dryRun?: boolean
  strict?: boolean
}

export interface RestoreConfigFilesResult {
  cwd: string
  reportFile: string
  reportKind?: string
  reportSchemaVersion?: number
  dryRun: boolean
  strict: boolean
  scannedEntries: number
  restorableEntries: number
  restoredFiles: number
  missingBackups: number
  skippedEntries: number
  restored: string[]
}

function getPropertyKeyName(property: ObjectProperty | ObjectMethod): string | undefined {
  if (!property.computed && t.isIdentifier(property.key)) {
    return property.key.name
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value
  }
  return undefined
}

function findObjectProperty(objectExpression: ObjectExpression, name: string): ObjectProperty | undefined {
  for (const property of objectExpression.properties) {
    if (!t.isObjectProperty(property)) {
      continue
    }
    if (getPropertyKeyName(property) === name) {
      return property
    }
  }
  return undefined
}

function findObjectExpressionProperty(objectExpression: ObjectExpression, name: string): ObjectExpression | undefined {
  const property = findObjectProperty(objectExpression, name)
  if (!property) {
    return undefined
  }
  if (t.isObjectExpression(property.value)) {
    return property.value
  }
  return undefined
}

function removeObjectProperty(objectExpression: ObjectExpression, property: ObjectProperty) {
  const index = objectExpression.properties.indexOf(property)
  if (index >= 0) {
    objectExpression.properties.splice(index, 1)
  }
}

function hasObjectProperty(objectExpression: ObjectExpression, name: string) {
  return findObjectProperty(objectExpression, name) !== undefined
}

function keyAsIdentifier(name: string) {
  return t.identifier(name)
}

function mergeObjectProperties(target: ObjectExpression, source: ObjectExpression) {
  let changed = false
  for (const sourceProperty of source.properties) {
    if (t.isSpreadElement(sourceProperty)) {
      target.properties.push(sourceProperty)
      changed = true
      continue
    }
    const sourceKey = getPropertyKeyName(sourceProperty)
    if (!sourceKey) {
      target.properties.push(sourceProperty)
      changed = true
      continue
    }
    if (hasObjectProperty(target, sourceKey)) {
      continue
    }
    target.properties.push(sourceProperty)
    changed = true
  }
  return changed
}

function moveProperty(
  objectExpression: ObjectExpression,
  from: string,
  to: string,
  changes: Set<string>,
  scope: OptionObjectScope,
) {
  const source = findObjectProperty(objectExpression, from)
  if (!source) {
    return false
  }
  const target = findObjectProperty(objectExpression, to)
  if (!target) {
    source.key = keyAsIdentifier(to)
    source.computed = false
    source.shorthand = false
    changes.add(`${scope}.${from} -> ${scope}.${to}`)
    return true
  }

  if (t.isObjectExpression(source.value) && t.isObjectExpression(target.value)) {
    const merged = mergeObjectProperties(target.value, source.value)
    if (merged) {
      changes.add(`${scope}.${from} merged into ${scope}.${to}`)
    }
  }
  removeObjectProperty(objectExpression, source)
  changes.add(`${scope}.${from} removed (preferred ${scope}.${to})`)
  return true
}

function migrateExtractOptions(extract: ObjectExpression, changes: Set<string>, scope: OptionObjectScope) {
  let changed = false
  changed = moveProperty(extract, 'enabled', 'write', changes, scope) || changed
  changed = moveProperty(extract, 'stripUniversalSelector', 'removeUniversalSelector', changes, scope) || changed
  return changed
}

function migrateTailwindOptions(tailwindcss: ObjectExpression, changes: Set<string>, scope: OptionObjectScope) {
  let changed = false
  changed = moveProperty(tailwindcss, 'package', 'packageName', changes, scope) || changed
  changed = moveProperty(tailwindcss, 'legacy', 'v2', changes, scope) || changed
  changed = moveProperty(tailwindcss, 'classic', 'v3', changes, scope) || changed
  changed = moveProperty(tailwindcss, 'next', 'v4', changes, scope) || changed
  return changed
}

function migrateApplyOptions(apply: ObjectExpression, changes: Set<string>, scope: OptionObjectScope) {
  return moveProperty(apply, 'exportContext', 'exposeContext', changes, scope)
}

function ensureObjectExpressionProperty(
  objectExpression: ObjectExpression,
  name: string,
  changes: Set<string>,
  scope: OptionObjectScope,
) {
  const existing = findObjectProperty(objectExpression, name)
  if (existing) {
    return t.isObjectExpression(existing.value) ? existing.value : undefined
  }
  const value = t.objectExpression([])
  objectExpression.properties.push(t.objectProperty(keyAsIdentifier(name), value))
  changes.add(`${scope}.${name} created`)
  return value
}

function moveOverwriteToApply(objectExpression: ObjectExpression, changes: Set<string>, scope: OptionObjectScope) {
  const overwrite = findObjectProperty(objectExpression, 'overwrite')
  if (!overwrite) {
    return false
  }
  const apply = ensureObjectExpressionProperty(objectExpression, 'apply', changes, scope)
  if (!apply) {
    return false
  }
  const hasApplyOverwrite = hasObjectProperty(apply, 'overwrite')
  if (!hasApplyOverwrite) {
    apply.properties.push(
      t.objectProperty(keyAsIdentifier('overwrite'), overwrite.value),
    )
    changes.add(`${scope}.overwrite -> ${scope}.apply.overwrite`)
  }
  removeObjectProperty(objectExpression, overwrite)
  return true
}

function hasAnyRootLegacyKeys(objectExpression: ObjectExpression) {
  return ROOT_LEGACY_KEYS.some(key => hasObjectProperty(objectExpression, key))
}

function migrateOptionObject(objectExpression: ObjectExpression, scope: OptionObjectScope, changes: Set<string>) {
  let changed = false
  changed = moveProperty(objectExpression, 'cwd', 'projectRoot', changes, scope) || changed
  changed = moveProperty(objectExpression, 'tailwind', 'tailwindcss', changes, scope) || changed
  changed = moveProperty(objectExpression, 'features', 'apply', changes, scope) || changed
  changed = moveProperty(objectExpression, 'applyPatches', 'apply', changes, scope) || changed
  changed = moveProperty(objectExpression, 'output', 'extract', changes, scope) || changed
  changed = moveOverwriteToApply(objectExpression, changes, scope) || changed

  const extract = findObjectExpressionProperty(objectExpression, 'extract')
  if (extract) {
    changed = migrateExtractOptions(extract, changes, scope) || changed
  }
  const tailwindcss = findObjectExpressionProperty(objectExpression, 'tailwindcss')
  if (tailwindcss) {
    changed = migrateTailwindOptions(tailwindcss, changes, scope) || changed
  }
  const apply = findObjectExpressionProperty(objectExpression, 'apply')
  if (apply) {
    changed = migrateApplyOptions(apply, changes, scope) || changed
  }

  return changed
}

function unwrapExpression(node: t.Node): t.Node {
  let current = node
  while (
    t.isTSAsExpression(current)
    || t.isTSSatisfiesExpression(current)
    || t.isTSTypeAssertion(current)
    || t.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function resolveObjectExpressionFromExpression(expression: t.Node): ObjectExpression | undefined {
  const unwrapped = unwrapExpression(expression)
  if (t.isObjectExpression(unwrapped)) {
    return unwrapped
  }
  if (t.isCallExpression(unwrapped)) {
    const [firstArg] = unwrapped.arguments
    if (!firstArg || !t.isExpression(firstArg)) {
      return undefined
    }
    const firstArgUnwrapped = unwrapExpression(firstArg)
    if (t.isObjectExpression(firstArgUnwrapped)) {
      return firstArgUnwrapped
    }
  }
  return undefined
}

function resolveObjectExpressionFromProgram(program: t.Program, name: string): ObjectExpression | undefined {
  for (const statement of program.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue
    }
    for (const declaration of statement.declarations) {
      if (!t.isIdentifier(declaration.id) || declaration.id.name !== name || !declaration.init) {
        continue
      }
      const objectExpression = resolveObjectExpressionFromExpression(declaration.init)
      if (objectExpression) {
        return objectExpression
      }
    }
  }
  return undefined
}

function resolveRootConfigObjectExpression(program: t.Program): ObjectExpression | undefined {
  for (const statement of program.body) {
    if (!t.isExportDefaultDeclaration(statement)) {
      continue
    }
    const declaration = statement.declaration
    if (t.isIdentifier(declaration)) {
      return resolveObjectExpressionFromProgram(program, declaration.name)
    }
    const objectExpression = resolveObjectExpressionFromExpression(declaration)
    if (objectExpression) {
      return objectExpression
    }
  }
  return undefined
}

export function migrateConfigSource(source: string): ConfigSourceMigrationResult {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  })
  const root = resolveRootConfigObjectExpression(ast.program)
  if (!root) {
    return {
      changed: false,
      code: source,
      changes: [],
    }
  }

  const changes = new Set<string>()
  let changed = false

  const registry = findObjectExpressionProperty(root, 'registry')
  if (registry) {
    changed = migrateOptionObject(registry, 'registry', changes) || changed
  }

  const patch = findObjectExpressionProperty(root, 'patch')
  if (patch) {
    changed = migrateOptionObject(patch, 'patch', changes) || changed
  }

  if (hasAnyRootLegacyKeys(root)) {
    changed = migrateOptionObject(root, 'root', changes) || changed
  }

  if (!changed) {
    return {
      changed: false,
      code: source,
      changes: [],
    }
  }

  const generated = generate(ast, {
    comments: true,
  }).code
  const code = source.endsWith('\n') ? `${generated}\n` : generated
  return {
    changed: true,
    code,
    changes: [...changes],
  }
}

function resolveTargetFiles(cwd: string, files?: string[]) {
  const candidates = files && files.length > 0 ? files : [...DEFAULT_CONFIG_FILENAMES]
  const resolved = new Set<string>()
  for (const file of candidates) {
    resolved.add(path.resolve(cwd, file))
  }
  return [...resolved]
}

async function collectWorkspaceConfigFiles(cwd: string, maxDepth: number) {
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

function resolveBackupRelativePath(cwd: string, file: string) {
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

function filterTargetFiles(targetFiles: string[], cwd: string, include?: string[], exclude?: string[]) {
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

export async function migrateConfigFiles(options: MigrateConfigFilesOptions): Promise<ConfigFileMigrationReport> {
  const cwd = path.resolve(options.cwd)
  const dryRun = options.dryRun ?? false
  const rollbackOnError = options.rollbackOnError ?? true
  const backupDirectory = options.backupDir ? path.resolve(cwd, options.backupDir) : undefined
  const maxDepth = options.maxDepth ?? DEFAULT_WORKSPACE_MAX_DEPTH
  const discoveredTargetFiles = options.files && options.files.length > 0
    ? resolveTargetFiles(cwd, options.files)
    : options.workspace
      ? await collectWorkspaceConfigFiles(cwd, maxDepth)
      : resolveTargetFiles(cwd)
  const targetFiles = filterTargetFiles(discoveredTargetFiles, cwd, options.include, options.exclude)
  const entries: ConfigFileMigrationEntry[] = []

  let scannedFiles = 0
  let changedFiles = 0
  let writtenFiles = 0
  let backupsWritten = 0
  let unchangedFiles = 0
  let missingFiles = 0
  const wroteEntries: Array<{ file: string, source: string, entry: ConfigFileMigrationEntry }> = []

  for (const file of targetFiles) {
    const exists = await fs.pathExists(file)
    if (!exists) {
      missingFiles += 1
      continue
    }

    scannedFiles += 1
    const source = await fs.readFile(file, 'utf8')
    const migrated = migrateConfigSource(source)

    const entry: ConfigFileMigrationEntry = {
      file,
      changed: migrated.changed,
      written: false,
      rolledBack: false,
      changes: migrated.changes,
    }
    entries.push(entry)

    if (migrated.changed) {
      changedFiles += 1
      if (!dryRun) {
        try {
          if (backupDirectory) {
            const backupRelativePath = resolveBackupRelativePath(cwd, file)
            const backupFile = path.resolve(backupDirectory, backupRelativePath)
            await fs.ensureDir(path.dirname(backupFile))
            await fs.writeFile(backupFile, source, 'utf8')
            entry.backupFile = backupFile
            backupsWritten += 1
          }
          await fs.writeFile(file, migrated.code, 'utf8')
          entry.written = true
          wroteEntries.push({ file, source, entry })
          writtenFiles += 1
        }
        catch (error) {
          let rollbackCount = 0
          if (rollbackOnError && wroteEntries.length > 0) {
            for (const written of [...wroteEntries].reverse()) {
              try {
                await fs.writeFile(written.file, written.source, 'utf8')
                written.entry.written = false
                written.entry.rolledBack = true
                rollbackCount += 1
              }
              catch {
                // Continue best-effort rollback to avoid leaving even more partial state.
              }
            }
            writtenFiles = Math.max(0, writtenFiles - rollbackCount)
          }
          const reason = error instanceof Error ? error.message : String(error)
          const rollbackHint = rollbackOnError && rollbackCount > 0
            ? ` Rolled back ${rollbackCount} previously written file(s).`
            : ''
          throw new Error(`Failed to write migrated config "${file}": ${reason}.${rollbackHint}`)
        }
      }
    }
    else {
      unchangedFiles += 1
    }
  }

  return {
    reportKind: MIGRATION_REPORT_KIND,
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tool: {
      name: pkgName,
      version: pkgVersion,
    },
    cwd,
    dryRun,
    rollbackOnError,
    ...(backupDirectory ? { backupDirectory } : {}),
    scannedFiles,
    changedFiles,
    writtenFiles,
    backupsWritten,
    unchangedFiles,
    missingFiles,
    entries,
  }
}

export async function restoreConfigFiles(options: RestoreConfigFilesOptions): Promise<RestoreConfigFilesResult> {
  const cwd = path.resolve(options.cwd)
  const dryRun = options.dryRun ?? false
  const strict = options.strict ?? false
  const reportFile = path.resolve(cwd, options.reportFile)

  const report = await fs.readJSON(reportFile) as {
    reportKind?: string
    schemaVersion?: number
    entries?: Array<{ file?: string, backupFile?: string }>
  }
  if (report.reportKind !== undefined && report.reportKind !== MIGRATION_REPORT_KIND) {
    throw new Error(`Unsupported report kind "${report.reportKind}" in ${reportFile}.`)
  }
  if (
    report.schemaVersion !== undefined
    && (!Number.isInteger(report.schemaVersion) || report.schemaVersion > MIGRATION_REPORT_SCHEMA_VERSION)
  ) {
    throw new Error(
      `Unsupported report schema version "${String(report.schemaVersion)}" in ${reportFile}. Current supported version is ${MIGRATION_REPORT_SCHEMA_VERSION}.`,
    )
  }
  const entries = Array.isArray(report.entries) ? report.entries : []

  let scannedEntries = 0
  let restorableEntries = 0
  let restoredFiles = 0
  let missingBackups = 0
  let skippedEntries = 0
  const restored: string[] = []

  for (const entry of entries) {
    scannedEntries += 1
    const targetFile = entry.file ? path.resolve(entry.file) : undefined
    const backupFile = entry.backupFile ? path.resolve(entry.backupFile) : undefined

    if (!targetFile || !backupFile) {
      skippedEntries += 1
      continue
    }

    restorableEntries += 1

    const backupExists = await fs.pathExists(backupFile)
    if (!backupExists) {
      missingBackups += 1
      continue
    }

    if (!dryRun) {
      const backupContent = await fs.readFile(backupFile, 'utf8')
      await fs.ensureDir(path.dirname(targetFile))
      await fs.writeFile(targetFile, backupContent, 'utf8')
    }

    restoredFiles += 1
    restored.push(targetFile)
  }

  if (strict && missingBackups > 0) {
    throw new Error(`Restore failed: ${missingBackups} backup file(s) missing in report ${reportFile}.`)
  }

  return {
    cwd,
    reportFile,
    ...(report.reportKind === undefined ? {} : { reportKind: report.reportKind }),
    ...(report.schemaVersion === undefined ? {} : { reportSchemaVersion: report.schemaVersion }),
    dryRun,
    strict,
    scannedEntries,
    restorableEntries,
    restoredFiles,
    missingBackups,
    skippedEntries,
    restored,
  }
}
