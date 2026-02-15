import type { PackageInfo } from 'local-pkg'
import type { NormalizedTailwindcssPatchOptions } from '../options/types'
import type { CacheContextDescriptor, CacheContextMetadata } from './types'
import { createHash } from 'node:crypto'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { pkgVersion } from '../constants'
import { CACHE_FINGERPRINT_VERSION } from './types'

const DEFAULT_TAILWIND_CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.cts',
  'tailwind.config.mts',
]

function normalizePathname(value: string) {
  return path.normalize(value).replaceAll('\\', '/')
}

function resolveRealpathSyncSafe(value: string): string {
  const resolved = path.resolve(value)
  try {
    return normalizePathname(fs.realpathSync(resolved))
  }
  catch {
    return normalizePathname(resolved)
  }
}

function resolveFileMtimeMsSync(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  try {
    const stat = fs.statSync(value)
    if (!stat.isFile()) {
      return undefined
    }
    return stat.mtimeMs
  }
  catch {
    return undefined
  }
}

function resolveTailwindConfigPath(
  options: NormalizedTailwindcssPatchOptions,
  majorVersion: 2 | 3 | 4,
): string | undefined {
  const tailwind = options.tailwind
  const baseDir = tailwind.cwd ?? options.projectRoot

  const configured = (() => {
    if (majorVersion === 2 && tailwind.v2?.config) {
      return tailwind.v2.config
    }
    if (majorVersion === 3 && tailwind.v3?.config) {
      return tailwind.v3.config
    }
    return tailwind.config
  })()

  if (configured) {
    const absolute = path.isAbsolute(configured) ? configured : path.resolve(baseDir, configured)
    if (fs.pathExistsSync(absolute)) {
      return resolveRealpathSyncSafe(absolute)
    }
  }

  for (const candidate of DEFAULT_TAILWIND_CONFIG_FILES) {
    const absolute = path.resolve(baseDir, candidate)
    if (fs.pathExistsSync(absolute)) {
      return resolveRealpathSyncSafe(absolute)
    }
  }

  return undefined
}

function stableSerialize(input: unknown): string {
  if (input === null) {
    return 'null'
  }

  if (typeof input === 'string') {
    return JSON.stringify(input)
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return JSON.stringify(input)
  }

  if (Array.isArray(input)) {
    return `[${input.map(item => stableSerialize(item)).join(',')}]`
  }

  if (typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${JSON.stringify(key)}:${stableSerialize(value)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(input))
}

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function toFingerprintOptions(normalized: NormalizedTailwindcssPatchOptions) {
  return {
    overwrite: normalized.overwrite,
    output: {
      removeUniversalSelector: normalized.output.removeUniversalSelector,
      format: normalized.output.format,
    },
    features: normalized.features,
    tailwind: {
      packageName: normalized.tailwind.packageName,
      cwd: normalized.tailwind.cwd,
      config: normalized.tailwind.config,
      postcssPlugin: normalized.tailwind.postcssPlugin,
      versionHint: normalized.tailwind.versionHint,
      v2: normalized.tailwind.v2,
      v3: normalized.tailwind.v3,
      v4: normalized.tailwind.v4,
    },
  }
}

export function createCacheContextDescriptor(
  options: NormalizedTailwindcssPatchOptions,
  packageInfo: PackageInfo,
  majorVersion: 2 | 3 | 4,
): CacheContextDescriptor {
  const projectRootRealpath = resolveRealpathSyncSafe(options.projectRoot)
  const processCwdRealpath = resolveRealpathSyncSafe(process.cwd())
  const cacheCwdRealpath = resolveRealpathSyncSafe(options.cache.cwd)
  const tailwindPackageRootRealpath = resolveRealpathSyncSafe(packageInfo.rootPath)
  const tailwindConfigPath = resolveTailwindConfigPath(options, majorVersion)
  const tailwindConfigMtimeMs = resolveFileMtimeMsSync(tailwindConfigPath)

  const optionsHash = hash(stableSerialize(toFingerprintOptions(options)))

  const metadata: CacheContextMetadata = {
    fingerprintVersion: CACHE_FINGERPRINT_VERSION,
    projectRootRealpath,
    processCwdRealpath,
    cacheCwdRealpath,
    ...(tailwindConfigPath === undefined ? {} : { tailwindConfigPath }),
    ...(tailwindConfigMtimeMs === undefined ? {} : { tailwindConfigMtimeMs }),
    tailwindPackageRootRealpath,
    tailwindPackageVersion: packageInfo.version ?? 'unknown',
    patcherVersion: pkgVersion,
    majorVersion,
    optionsHash,
  }

  const fingerprint = hash(stableSerialize(metadata))

  return {
    fingerprint,
    metadata,
  }
}

export function explainContextMismatch(
  current: CacheContextMetadata,
  cached: CacheContextMetadata,
): string[] {
  const reasons: string[] = []

  if (current.projectRootRealpath !== cached.projectRootRealpath) {
    reasons.push(`project-root changed: ${cached.projectRootRealpath} -> ${current.projectRootRealpath}`)
  }
  if (current.processCwdRealpath !== cached.processCwdRealpath) {
    reasons.push(`process-cwd changed: ${cached.processCwdRealpath} -> ${current.processCwdRealpath}`)
  }
  if (current.cacheCwdRealpath !== cached.cacheCwdRealpath) {
    reasons.push(`cache-cwd changed: ${cached.cacheCwdRealpath} -> ${current.cacheCwdRealpath}`)
  }
  if ((current.tailwindConfigPath ?? '') !== (cached.tailwindConfigPath ?? '')) {
    reasons.push(`tailwind-config path changed: ${cached.tailwindConfigPath ?? '<none>'} -> ${current.tailwindConfigPath ?? '<none>'}`)
  }
  if ((current.tailwindConfigMtimeMs ?? -1) !== (cached.tailwindConfigMtimeMs ?? -1)) {
    reasons.push('tailwind-config mtime changed')
  }
  if (current.tailwindPackageRootRealpath !== cached.tailwindPackageRootRealpath) {
    reasons.push(`tailwind-package root changed: ${cached.tailwindPackageRootRealpath} -> ${current.tailwindPackageRootRealpath}`)
  }
  if (current.tailwindPackageVersion !== cached.tailwindPackageVersion) {
    reasons.push(`tailwind-package version changed: ${cached.tailwindPackageVersion} -> ${current.tailwindPackageVersion}`)
  }
  if (current.patcherVersion !== cached.patcherVersion) {
    reasons.push(`patcher version changed: ${cached.patcherVersion} -> ${current.patcherVersion}`)
  }
  if (current.majorVersion !== cached.majorVersion) {
    reasons.push(`major version changed: ${cached.majorVersion} -> ${current.majorVersion}`)
  }
  if (current.optionsHash !== cached.optionsHash) {
    reasons.push(`patch options hash changed: ${cached.optionsHash.slice(0, 12)} -> ${current.optionsHash.slice(0, 12)}`)
  }

  return reasons
}
