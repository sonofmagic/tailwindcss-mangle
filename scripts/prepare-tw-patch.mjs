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

const binPath = path.resolve(repoRoot, 'packages/tailwindcss-patch/bin/tw-patch.js')

try {
  execFileSync(process.execPath, [binPath, '--help'], {
    stdio: 'ignore',
  })
}
catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.log(`Skip tw-patch prepare because the local tw-patch CLI is not ready: ${reason}`)
  process.exit(0)
}

execFileSync(process.execPath, [binPath, 'install'], {
  stdio: 'inherit',
})
