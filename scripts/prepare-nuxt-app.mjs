import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.CI || process.env.TWM_SKIP_NUXT_PREPARE) {
  console.log('Skip nuxt prepare in CI or scripted installs')
  process.exit(0)
}

const requiredArtifacts = [
  'packages/unplugin-tailwindcss-mangle/dist/nuxt.cjs',
  'packages/unplugin-tailwindcss-mangle/dist/nuxt.js',
]

const missingArtifact = requiredArtifacts.find(file => !existsSync(path.resolve(repoRoot, file)))

if (missingArtifact) {
  console.log(`Skip nuxt prepare because ${missingArtifact} has not been built yet`)
  process.exit(0)
}

execFileSync('nuxt', ['prepare'], {
  cwd: path.resolve(repoRoot, 'apps/nuxt-app'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
