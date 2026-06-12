import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateTailwindV4Style } from 'tailwindcss-patch'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputFile = resolve(appRoot, 'app/tailwind.generated.css')

const result = await generateTailwindV4Style({
  projectRoot: appRoot,
  cwd: appRoot,
  base: appRoot,
  cssEntries: ['app/tailwind.source.css'],
  scanSources: true,
})

await mkdir(dirname(outputFile), { recursive: true })
await writeFile(outputFile, result.css, 'utf8')
