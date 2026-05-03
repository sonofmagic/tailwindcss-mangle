import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.CI || process.env.TWM_SKIP_TW_PATCH_PREPARE) {
  console.log('Skip tw-patch prepare in CI or scripted installs')
  process.exit(0)
}

const requiredArtifacts = [
  'packages/shared/dist/index.js',
  'packages/config/dist/index.js',
]

const missingArtifact = requiredArtifacts.find(file => !existsSync(path.resolve(repoRoot, file)))

if (missingArtifact) {
  console.log(`Skip tw-patch prepare because ${missingArtifact} has not been built yet`)
  process.exit(0)
}

execFileSync('tw-patch', ['install'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
