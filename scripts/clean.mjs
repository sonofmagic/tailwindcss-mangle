import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dryRun = process.argv.includes('--dry-run')
const targets = ['coverage', '.turbo', 'website/.next', 'website/public/_pagefind']

for (const folder of ['packages', 'apps']) {
  for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
    if (!entry.isDirectory() || !existsSync(path.join(root, folder, entry.name, 'package.json'))) {
      continue
    }
    const outputs = folder === 'packages'
      ? ['dist', 'coverage']
      : ['dist', 'build', '.next', '.nuxt', '.output', '.astro']
    targets.push(...outputs.map(output => path.join(folder, entry.name, output)))
  }
}

for (const target of targets) {
  if (!dryRun) {
    await rm(path.join(root, target), { recursive: true, force: true })
  }
  console.log(`${dryRun ? 'Would remove' : 'Removed'} ${target}`)
}
