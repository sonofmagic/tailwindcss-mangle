import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nuxtAppRoot = path.resolve(repoRoot, 'apps/nuxt-app')

if (process.env.CI || process.env.TWM_SKIP_NUXT_PREPARE) {
  console.log('Skip nuxt prepare in CI or scripted installs')
  process.exit(0)
}

const requiredArtifacts = [
  'packages/unplugin-tailwindcss-mangle/dist/nuxt.js',
]

const missingArtifact = requiredArtifacts.find(file => !existsSync(path.resolve(repoRoot, file)))

if (missingArtifact) {
  console.log(`Skip nuxt prepare because ${missingArtifact} has not been built yet`)
  process.exit(0)
}

try {
  await import(pathToFileURL(path.resolve(repoRoot, 'packages/unplugin-tailwindcss-mangle/dist/nuxt.js')).href)
}
catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.log(`Skip nuxt prepare because the local Nuxt module is not ready: ${reason}`)
  process.exit(0)
}

const nuxtBin = path.resolve(nuxtAppRoot, 'node_modules/.bin', process.platform === 'win32' ? 'nuxt.cmd' : 'nuxt')

if (!existsSync(nuxtBin)) {
  console.log(`Skip nuxt prepare because ${path.relative(repoRoot, nuxtBin)} has not been linked yet`)
  process.exit(0)
}

execFileSync(nuxtBin, ['prepare'], {
  cwd: nuxtAppRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
