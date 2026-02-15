import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const RESOLVE_SHARDS_RESULT_SCHEMA_VERSION = 1

export const DEFAULT_SHARD_CONFIG = {
  runAllPatterns: [
    'packages/tailwindcss-patch/**',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'package.json',
    'turbo.json',
    '.npmrc',
    '.nvmrc',
    '.node-version',
    '.github/workflows/**',
  ],
  shards: [
    {
      name: 'root',
      reportFile: '.tw-patch/migrate-report-root.json',
      matchPatterns: ['tailwindcss-patch.config.*', 'tailwindcss-mangle.config.*'],
    },
    {
      name: 'apps',
      reportFile: '.tw-patch/migrate-report-apps.json',
      matchPatterns: ['apps/**'],
    },
    {
      name: 'packages',
      reportFile: '.tw-patch/migrate-report-packages.json',
      matchPatterns: ['packages/**'],
    },
  ],
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_SHARD_CONFIG))
}

export function normalizeShardConfig(value) {
  const fallback = cloneDefaultConfig()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const runAllPatterns = Array.isArray(value.runAllPatterns)
    ? value.runAllPatterns.filter((p) => typeof p === 'string' && p.length > 0)
    : fallback.runAllPatterns

  const shards = Array.isArray(value.shards)
    ? value.shards
        .filter((s) => s && typeof s === 'object')
        .map((s) => ({
          name: typeof s.name === 'string' ? s.name : '',
          reportFile: typeof s.reportFile === 'string' ? s.reportFile : '',
          matchPatterns: Array.isArray(s.matchPatterns)
            ? s.matchPatterns.filter((p) => typeof p === 'string' && p.length > 0)
            : [],
        }))
        .filter((s) => s.name && s.reportFile && s.matchPatterns.length > 0)
    : fallback.shards

  if (shards.length === 0) {
    return fallback
  }

  return {
    runAllPatterns,
    shards,
  }
}

export function loadShardConfig(configPath, io = fs, logger = console) {
  if (!io.existsSync(configPath)) {
    return cloneDefaultConfig()
  }
  try {
    const parsed = JSON.parse(io.readFileSync(configPath, 'utf8'))
    logger.log(`::notice::Loaded shard config from ${configPath}`)
    return normalizeShardConfig(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.log(`::warning::Invalid ${configPath}, fallback to defaults: ${message}`)
    return cloneDefaultConfig()
  }
}

export function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const withGlob = escaped
    .replace(/\*\*/g, '__TW_PATCH_GLOBSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__TW_PATCH_GLOBSTAR__/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${withGlob}$`)
}

export function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath))
}

function toMatrix(config, names) {
  const selected = new Set(names)
  return config.shards
    .filter((shard) => selected.has(shard.name))
    .map((shard) => ({ name: shard.name, report_file: shard.reportFile }))
}

function payload(config, names, hasChanges) {
  return {
    hasChanges,
    shards: names,
    matrix: toMatrix(config, names),
  }
}

export function computeShardSelection(changedFiles, config) {
  const files = changedFiles.map((file) => file.trim()).filter(Boolean)
  if (files.length === 0) {
    return payload(config, [], false)
  }

  const allNames = config.shards.map((s) => s.name)
  if (files.some((file) => matchesAny(file, config.runAllPatterns))) {
    return payload(config, allNames, true)
  }

  const matchedNames = config.shards
    .filter((shard) => files.some((file) => matchesAny(file, shard.matchPatterns)))
    .map((shard) => shard.name)

  if (matchedNames.length === 0) {
    return payload(config, [], false)
  }

  return payload(config, matchedNames, true)
}

export function resolveShardsFromGit(params) {
  const {
    config,
    eventName,
    baseSha,
    baseRef,
    headSha = 'HEAD',
    runGit,
    hasCommit,
    logger = console,
  } = params

  const allNames = config.shards.map((s) => s.name)
  if (eventName === 'workflow_dispatch') {
    logger.log('::notice::workflow_dispatch => run all shards')
    return payload(config, allNames, true)
  }

  let base = baseSha || ''
  if (!hasCommit(base) && baseRef) {
    try {
      base = runGit(['merge-base', 'HEAD', `origin/${baseRef}`])
      logger.log(`::notice::Fallback base resolved by merge-base: ${base}`)
    } catch {
      logger.log('::warning::Unable to resolve PR base by merge-base, run all shards')
      return payload(config, allNames, true)
    }
  }

  if (!base) {
    logger.log('::warning::Missing base sha, run all shards')
    return payload(config, allNames, true)
  }

  let changedFiles = []
  try {
    changedFiles = runGit(['diff', '--name-only', base, headSha])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.log(`::warning::git diff failed (${message}), run all shards`)
    return payload(config, allNames, true)
  }

  const result = computeShardSelection(changedFiles, config)
  if (!result.hasChanges) {
    logger.log('::notice::No affected shards for current diff')
  }
  return result
}

export function toGithubOutputLines(result) {
  return [
    `has_changes=${result.hasChanges ? 'true' : 'false'}`,
    `shards=${result.shards.length > 0 ? result.shards.join(',') : 'none'}`,
    `matrix=${JSON.stringify({ shard: result.matrix })}`,
  ].join('\n')
}

export function toJsonContract(result) {
  return {
    version: RESOLVE_SHARDS_RESULT_SCHEMA_VERSION,
    hasChanges: result.hasChanges,
    shards: [...result.shards],
    matrix: {
      shard: [...result.matrix],
    },
  }
}

function defaultRunGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function defaultHasCommit(sha) {
  if (!sha) {
    return false
  }
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function main(env = process.env, io = fs, logger = console) {
  const outputFormat = env.RESOLVE_SHARDS_OUTPUT === 'json' ? 'json' : 'github-output'
  const resolverLogger = outputFormat === 'json'
    ? { log: () => {} }
    : logger
  const configPath = env.CI_SHARDS_CONFIG_PATH || '.tw-patch/ci-shards.json'
  const config = loadShardConfig(configPath, io, resolverLogger)

  const result = resolveShardsFromGit({
    config,
    eventName: env.EVENT_NAME || '',
    baseSha: env.BASE_SHA || '',
    baseRef: env.BASE_REF || '',
    headSha: env.HEAD_SHA || 'HEAD',
    runGit: defaultRunGit,
    hasCommit: defaultHasCommit,
    logger: resolverLogger,
  })

  if (outputFormat === 'json') {
    logger.log(JSON.stringify(toJsonContract(result), null, 2))
    return result
  }

  const lines = toGithubOutputLines(result)
  if (env.GITHUB_OUTPUT) {
    io.appendFileSync(env.GITHUB_OUTPUT, `${lines}\n`)
  } else {
    logger.log(lines)
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    console.error(`::error::resolve-shards failed: ${message}`)
    process.exit(1)
  }
}
