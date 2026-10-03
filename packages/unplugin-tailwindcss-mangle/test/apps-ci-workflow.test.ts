import fs from 'node:fs/promises'
import path from 'pathe'
import { parse } from 'yaml'
import { repoRoot } from '../../../e2e/apps.e2e.shared'

interface WorkflowStep {
  run?: string
  uses?: string
  with?: Record<string, unknown>
}

interface WorkflowJob {
  strategy?: {
    matrix?: {
      'os'?: string[]
      'node-version'?: string[]
    }
  }
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

async function readWorkflow(filename = 'ci.yml') {
  const workflowFile = path.resolve(repoRoot, '.github/workflows', filename)
  return parse(await fs.readFile(workflowFile, 'utf8')) as Workflow
}

const expectedOsMatrix = ['macos-latest', 'ubuntu-latest', 'windows-latest']

describe('apps e2e ci workflow', () => {
  it('runs every apps e2e suite on Linux, Windows, and macOS', async () => {
    const workflow = await readWorkflow()
    const jobs = workflow.jobs ?? {}
    const expectedJobs = [
      ['apps-e2e', 'pnpm test:e2e'],
      ['apps-playwright-e2e', 'pnpm test:e2e:pw'],
      ['apps-hmr-e2e', 'pnpm test:e2e:apps:hmr'],
    ] as const

    for (const [jobId, command] of expectedJobs) {
      const job = jobs[jobId]
      expect(job, `Missing CI job ${jobId}`).toBeDefined()
      expect([...(job?.strategy?.matrix?.os ?? [])].sort()).toEqual(expectedOsMatrix)
      expect(job?.steps?.some(step => step.run === command)).toBe(true)
    }
  })

  it('installs Chromium for browser-backed apps e2e suites', async () => {
    const workflow = await readWorkflow()
    const jobs = workflow.jobs ?? {}

    for (const jobId of ['apps-playwright-e2e', 'apps-hmr-e2e']) {
      const steps = jobs[jobId]?.steps ?? []

      expect(steps.some(step => step.run === 'pnpm exec playwright install-deps chromium')).toBe(true)
      expect(steps.some(step => step.run === 'pnpm exec playwright install chromium')).toBe(true)
    }
  })

  it('checks the supported development runtimes without raising the engine runtime floor', async () => {
    const ci = await readWorkflow()
    expect(ci.jobs?.['build']?.strategy?.matrix?.['node-version']).toEqual(['22.22.1', '24'])

    const engine = await readWorkflow('engine-cross-platform.yml')
    const steps = engine.jobs?.['engine']?.steps ?? []
    expect(steps.some(step => step.with?.['node-version'] === '22.22.1')).toBe(true)
    expect(steps.some(step => step.with?.['node-version'] === '18.20.8')).toBe(true)
    expect(steps.some(step => step.run === 'node packages/engine/scripts/node18-smoke.mjs')).toBe(true)
  })

  it('validates public types and inspects releases without invoking release automation in CI', async () => {
    const ci = await readWorkflow()
    const steps = ci.jobs?.['build']?.steps ?? []
    for (const command of ['pnpm lint:style', 'pnpm typecheck', 'pnpm test:types', 'pnpm release:plan']) {
      expect(steps.some(step => step.run === command)).toBe(true)
    }
    expect(steps.some(step => step.run?.includes('repo release ci'))).toBe(false)

    const release = await readWorkflow('release.yml')
    const releaseSteps = release.jobs?.['release']?.steps ?? []
    expect(releaseSteps.some(step => step.run === 'pnpm exec playwright install --with-deps chromium')).toBe(true)
    expect(releaseSteps.some(step => step.run === 'pnpm exec repo release ci')).toBe(true)
    expect(releaseSteps.some(step => step.uses?.startsWith('changesets/action@'))).toBe(false)
  })
})
