import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { hydrateNativeArtifacts } from '../../scripts/native-artifacts.mjs'

async function build() {
  const args = process.argv.slice(2)
  if (process.env.TWM_NATIVE_ARTIFACTS_DIR) {
    if (args.length) {
      throw new Error('Prebuilt release artifacts cannot be combined with native compiler arguments')
    }
    await hydrateNativeArtifacts()
    process.stdout.write('Using verified native CI artifacts for this source commit.\n')
  }
  else {
    const require = createRequire(import.meta.url)
    const cli = path.join(path.dirname(require.resolve('@napi-rs/cli/package.json')), 'dist/cli.js')
    const result = spawnSync(process.execPath, [
      cli,
      'build',
      '--platform',
      '--release',
      '--manifest-path',
      '../../crates/mangle-native/Cargo.toml',
      '--js',
      'index.cjs',
      '--output-dir',
      '.',
      ...args,
    ], { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit' })
    if (result.error) {
      throw result.error
    }
    process.exitCode = result.status ?? 1
  }
}

build().catch((error) => {
  process.stderr.write(`${error.stack ?? String(error)}\n`)
  process.exitCode = 1
})
