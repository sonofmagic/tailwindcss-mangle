import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from 'repoctl/tooling'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(async () => await defineVitestConfig({
  cwd: rootDir,
  options: { rootDir },
}))
