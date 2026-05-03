import fs from 'node:fs/promises'
import path from 'pathe'
import { parse } from 'yaml'
import { repoRoot } from '../../../e2e/apps.e2e.shared'

interface WorkflowStep {
  run?: string
}

interface WorkflowJob {
  strategy?: {
    matrix?: {
      os?: string[]
    }
  }
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>
}

async function readCiWorkflow() {
  const workflowFile = path.resolve(repoRoot, '.github/workflows/ci.yml')
  return parse(await fs.readFile(workflowFile, 'utf8')) as Workflow
}

const expectedOsMatrix = ['macos-latest', 'ubuntu-latest', 'windows-latest']

describe('apps e2e ci workflow', () => {
  it('runs every apps e2e suite on Linux, Windows, and macOS', async () => {
    const workflow = await readCiWorkflow()
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
    const workflow = await readCiWorkflow()
    const jobs = workflow.jobs ?? {}

    for (const jobId of ['apps-playwright-e2e', 'apps-hmr-e2e']) {
      const steps = jobs[jobId]?.steps ?? []

      expect(steps.some(step => step.run === 'pnpm exec playwright install-deps chromium')).toBe(true)
      expect(steps.some(step => step.run === 'pnpm exec playwright install chromium')).toBe(true)
    }
  })
})
