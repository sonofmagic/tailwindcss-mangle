import { execFileSync } from 'node:child_process'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const packageDir = path.resolve(__dirname, '..')
const distEntry = path.join(packageDir, 'dist/index.js')

function runCommonJs(script: string) {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: packageDir,
    encoding: 'utf8',
  }).trim()
}

describe('published CommonJS runtime entry', () => {
  it('requires non-CLI runtime APIs without triggering ERR_REQUIRE_ESM', () => {
    const output = runCommonJs(`
      ;(async () => {
        const patch = require(${JSON.stringify(distEntry)})
        const normalized = patch.normalizeOptions({ cache: false })
        const extracted = await patch.extractRawCandidatesWithPositions('<div class="text-red-500"></div>', 'html')
        console.log(JSON.stringify({
          normalizedCacheEnabled: normalized.cache.enabled,
          containsUtilityCandidate: extracted.some(entry => entry.rawCandidate === 'text-red-500'),
          hasPatcher: typeof patch.TailwindcssPatcher,
          hasExtractValidCandidates: typeof patch.extractValidCandidates,
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
    })
  })

  it('creates the CLI on demand from the CommonJS entry', () => {
    const output = runCommonJs(`
      const patch = require(${JSON.stringify(distEntry)})
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
    `)

    expect(JSON.parse(output)).toEqual({
      name: 'embedded',
      commands: ['status'],
    })
  })
})
