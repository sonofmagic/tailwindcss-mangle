import path from 'pathe'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'

let mod: any

beforeAll(async () => {
  const scriptPath = path.resolve(
    __dirname,
    '../examples/github-actions/scripts/resolve-shards.mjs',
  )
  mod = await import(pathToFileURL(scriptPath).href)
})

describe('resolve-shards script', () => {
  it('normalizeShardConfig falls back to defaults on invalid schema', () => {
    const normalized = mod.normalizeShardConfig({
      runAllPatterns: ['apps/**'],
      shards: [{ name: '', reportFile: '', matchPatterns: [] }],
    })

    expect(normalized).toEqual(mod.DEFAULT_SHARD_CONFIG)
    expect(normalized).not.toBe(mod.DEFAULT_SHARD_CONFIG)
  })

  it('computeShardSelection matches runAll patterns first', () => {
    const result = mod.computeShardSelection(
      ['pnpm-lock.yaml'],
      mod.DEFAULT_SHARD_CONFIG,
    )

    expect(result.hasChanges).toBe(true)
    expect(result.shards).toEqual(['root', 'apps', 'packages'])
    expect(result.matrix).toEqual([
      { name: 'root', report_file: '.tw-patch/migrate-report-root.json' },
      { name: 'apps', report_file: '.tw-patch/migrate-report-apps.json' },
      { name: 'packages', report_file: '.tw-patch/migrate-report-packages.json' },
    ])
  })

  it('computeShardSelection returns only matched shards', () => {
    const result = mod.computeShardSelection(
      ['apps/demo/src/main.ts'],
      mod.DEFAULT_SHARD_CONFIG,
    )

    expect(result.hasChanges).toBe(true)
    expect(result.shards).toEqual(['apps'])
    expect(result.matrix).toEqual([
      { name: 'apps', report_file: '.tw-patch/migrate-report-apps.json' },
    ])
  })

  it('computeShardSelection returns no changes when files do not match', () => {
    const result = mod.computeShardSelection(
      ['docs/guide.md'],
      mod.DEFAULT_SHARD_CONFIG,
    )

    expect(result.hasChanges).toBe(false)
    expect(result.shards).toEqual([])
    expect(result.matrix).toEqual([])
  })

  it('resolveShardsFromGit returns all shards on workflow_dispatch', () => {
    const runGit = vi.fn()
    const hasCommit = vi.fn()
    const result = mod.resolveShardsFromGit({
      config: mod.DEFAULT_SHARD_CONFIG,
      eventName: 'workflow_dispatch',
      baseSha: '',
      baseRef: '',
      runGit,
      hasCommit,
      logger: { log: vi.fn() },
    })

    expect(result.shards).toEqual(['root', 'apps', 'packages'])
    expect(runGit).not.toHaveBeenCalled()
    expect(hasCommit).not.toHaveBeenCalled()
  })

  it('resolveShardsFromGit falls back to merge-base when base sha is unavailable', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'merge-base') {
        return 'base-from-merge'
      }
      if (args[0] === 'diff') {
        return 'packages/core/src/index.ts'
      }
      throw new Error(`unexpected git args: ${args.join(' ')}`)
    })
    const hasCommit = vi.fn(() => false)

    const result = mod.resolveShardsFromGit({
      config: mod.DEFAULT_SHARD_CONFIG,
      eventName: 'pull_request',
      baseSha: '',
      baseRef: 'main',
      headSha: 'head-sha',
      runGit,
      hasCommit,
      logger: { log: vi.fn() },
    })

    expect(result.hasChanges).toBe(true)
    expect(result.shards).toEqual(['packages'])
    expect(runGit).toHaveBeenNthCalledWith(1, ['merge-base', 'HEAD', 'origin/main'])
    expect(runGit).toHaveBeenNthCalledWith(2, ['diff', '--name-only', 'base-from-merge', 'head-sha'])
  })

  it('resolveShardsFromGit runs all shards when diff fails', () => {
    const runGit = vi.fn((args: string[]) => {
      if (args[0] === 'diff') {
        throw new Error('diff failed')
      }
      return ''
    })
    const hasCommit = vi.fn(() => true)

    const result = mod.resolveShardsFromGit({
      config: mod.DEFAULT_SHARD_CONFIG,
      eventName: 'pull_request',
      baseSha: 'known-base',
      baseRef: 'main',
      runGit,
      hasCommit,
      logger: { log: vi.fn() },
    })

    expect(result.hasChanges).toBe(true)
    expect(result.shards).toEqual(['root', 'apps', 'packages'])
  })

  it('loadShardConfig reads custom config and github output lines stay stable', () => {
    const io = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => JSON.stringify({
        runAllPatterns: ['docs/**'],
        shards: [
          {
            name: 'docs',
            reportFile: '.tw-patch/migrate-report-docs.json',
            matchPatterns: ['docs/**'],
          },
        ],
      })),
    }
    const logger = { log: vi.fn() }
    const config = mod.loadShardConfig('.tw-patch/ci-shards.json', io, logger)

    expect(config).toEqual({
      runAllPatterns: ['docs/**'],
      shards: [
        {
          name: 'docs',
          reportFile: '.tw-patch/migrate-report-docs.json',
          matchPatterns: ['docs/**'],
        },
      ],
    })

    const lines = mod.toGithubOutputLines({
      hasChanges: true,
      shards: ['docs'],
      matrix: [{ name: 'docs', report_file: '.tw-patch/migrate-report-docs.json' }],
    })

    expect(lines).toContain('has_changes=true')
    expect(lines).toContain('shards=docs')
    expect(lines).toContain('matrix={"shard":[{"name":"docs","report_file":".tw-patch/migrate-report-docs.json"}]}')
  })
})
