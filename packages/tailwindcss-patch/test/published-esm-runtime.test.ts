import { execFileSync } from 'node:child_process'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const packageDir = path.resolve(__dirname, '..')
const distEntry = path.join(packageDir, 'dist/index.js')

function runEsm(script: string) {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: packageDir,
    encoding: 'utf8',
  }).trim()
}

describe('published ESM runtime entry', () => {
  it('imports non-CLI runtime APIs', () => {
    const output = runEsm(`
      ;(async () => {
        const patch = await import(${JSON.stringify(distEntry)})
        const normalized = patch.normalizeOptions({ cache: false })
        const extracted = await patch.extractRawCandidatesWithPositions('<div class="text-red-500"></div>', 'html')
        const splitTokens = patch.splitCandidateTokens('before:content-["x"] text-red-500')
        console.log(JSON.stringify({
          normalizedCacheEnabled: normalized.cache.enabled,
          containsUtilityCandidate: extracted.some(entry => entry.rawCandidate === 'text-red-500'),
          hasPatcher: typeof patch.TailwindcssPatcher,
          hasExtractValidCandidates: typeof patch.extractValidCandidates,
          hasSplitCandidateTokens: typeof patch.splitCandidateTokens,
          splitTokens,
        }))
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
    `)

    expect(JSON.parse(output)).toEqual({
      normalizedCacheEnabled: false,
      containsUtilityCandidate: true,
      hasPatcher: 'function',
      hasExtractValidCandidates: 'function',
      hasSplitCandidateTokens: 'function',
      splitTokens: ['before:content-["x"]', 'text-red-500'],
    })
  })

  it('creates the CLI from the ESM entry', () => {
    const output = runEsm(`
      ;(async () => {
      const patch = await import(${JSON.stringify(distEntry)})
      const cli = patch.createTailwindcssPatchCli({
        name: 'embedded',
        mountOptions: {
          commands: ['status'],
        },
      })
      console.log(JSON.stringify({
        name: cli.name,
          commands: cli.commands.map(command => command.name),
        }))
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
    `)

    expect(JSON.parse(output)).toEqual({
      name: 'embedded',
      commands: ['status'],
    })
  })
})
