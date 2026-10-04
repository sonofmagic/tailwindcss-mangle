import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  hydrateNativeArtifacts,
  recordNativeArtifact,
  repositoryRoot,
  sourceFingerprint,
  targetFiles,
  validateNativeArtifacts,
} from './native-artifacts.mjs'

const hostTargets = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
}
const target = process.env.TWM_TEST_NATIVE_TARGET ?? hostTargets[`${process.platform}-${process.arch}`]
assert.ok(targetFiles[target], `Supported real test artifact required for ${target}`)

// Run without dev dependencies so the production Node 18 CI can exercise the
// same lifecycle checks after switching away from the repository toolchain.
const checks = []
function test(name, run) {
  checks.push({ name, run })
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function commit(root, message) {
  git(root, 'add', '-A')
  git(root, '-c', 'user.name=Native artifact tests', '-c', 'user.email=native-tests@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message)
}

async function fixture(t, targets = [target]) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'twm-artifacts-test-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const root = path.join(temporary, 'source')
  const directory = path.join(temporary, 'artifacts')
  await mkdir(path.join(root, 'packages/native'), { recursive: true })
  await mkdir(path.join(root, 'crates/example/src'), { recursive: true })
  await mkdir(path.join(root, 'scripts'), { recursive: true })
  await mkdir(path.join(root, '.empty-hooks'), { recursive: true })
  await mkdir(directory)
  await writeFile(path.join(root, '.gitignore'), 'packages/native/*.node\npackages/native/*.wasm\npackages/native/*.wasi.cjs\npackages/native/wasi-worker.mjs\npackages/native/index.cjs\npackages/native/index.d.ts\n')
  await writeFile(path.join(root, 'packages/native/package.json'), JSON.stringify({ version: '0.1.0', napi: { targets } }))
  await writeFile(path.join(root, 'crates/example/src/lib.rs'), 'pub fn fixture() {}\n')
  for (const name of ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml']) {
    await writeFile(path.join(root, name), '# Isolated artifact transport test fixture\n')
  }
  for (const name of ['scripts/native-artifacts.mjs', 'packages/native/build.mjs']) {
    await copyFile(path.join(repositoryRoot, name), path.join(root, name))
  }
  git(root, 'init', '-q')
  git(root, 'config', 'core.hooksPath', path.join(root, '.empty-hooks'))
  commit(root, 'fixture source')
  // Reuse genuine built artifacts under their real target names. This fixture
  // tests transport and identity checks; it never fabricates missing platforms.
  for (const name of targetFiles[target]) {
    await copyFile(path.join(repositoryRoot, 'packages/native', name), path.join(directory, name))
  }
  const record = await recordNativeArtifact({ root, directory, target })
  return { root, directory, sourceSha: record.sourceSha, record }
}

test('prebuilt build hydrates genuine artifacts without a compiler or CLI dependency', async (t) => {
  const f = await fixture(t)
  const result = spawnSync(process.execPath, [path.join(f.root, 'packages/native/build.mjs')], {
    cwd: f.root,
    encoding: 'utf8',
    env: { ...process.env, TWM_NATIVE_ARTIFACTS_DIR: f.directory, TWM_NATIVE_ARTIFACTS_SOURCE_SHA: f.sourceSha },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Using verified native CI artifacts/)
  for (const name of targetFiles[target]) {
    assert.deepEqual(await readFile(path.join(f.root, 'packages/native', name)), await readFile(path.join(f.directory, name)))
  }
  await validateNativeArtifacts({ root: f.root, sourceSha: f.sourceSha, recordsDirectory: f.directory })
})

test('hydration rejects another source commit before copying', async (t) => {
  const f = await fixture(t)
  await assert.rejects(hydrateNativeArtifacts({ ...f, sourceSha: '0'.repeat(40) }), /source mismatch/)
  await assert.rejects(readFile(path.join(f.root, 'packages/native', targetFiles[target][0])), { code: 'ENOENT' })
})

test('distribution rejects an artifact record from another commit', async (t) => {
  const f = await fixture(t)
  f.record.sourceSha = '0'.repeat(40)
  await writeFile(path.join(f.directory, `native-artifact.${target}.json`), JSON.stringify(f.record))
  await assert.rejects(validateNativeArtifacts(f), /source mismatch/)
})

test('distribution rejects a corrupted real binary', async (t) => {
  const f = await fixture(t)
  await appendFile(path.join(f.directory, targetFiles[target][0]), 'corruption')
  await assert.rejects(validateNativeArtifacts(f), /checksum mismatch/)
})

test('distribution rejects missing configured platforms without inventing binaries', async (t) => {
  const missing = Object.keys(targetFiles).find(value => value !== target)
  const f = await fixture(t, [target, missing])
  await assert.rejects(validateNativeArtifacts(f), /Missing or invalid native artifact record/)
})

test('distribution rejects missing binaries even when metadata remains', async (t) => {
  const f = await fixture(t)
  await rm(path.join(f.directory, targetFiles[target][0]))
  await assert.rejects(validateNativeArtifacts(f), /Missing or empty native artifact/)
})

test('distribution rejects unverified extra files matched by the npm native glob', async (t) => {
  const f = await fixture(t)
  await copyFile(path.join(f.directory, targetFiles[target][0]), path.join(f.directory, 'unexpected.node'))
  await assert.rejects(validateNativeArtifacts(f), /Unexpected native artifact would be packed/)
})

test('hydration rejects changed Rust source at the same HEAD', async (t) => {
  const f = await fixture(t)
  await appendFile(path.join(f.root, 'crates/example/src/lib.rs'), 'pub fn changed() {}\n')
  await assert.rejects(hydrateNativeArtifacts(f), /source fingerprint mismatch/)
})

test('Windows CRLF checkouts retain the same Rust source fingerprint', async (t) => {
  const f = await fixture(t)
  const before = await sourceFingerprint(f.root)
  await writeFile(path.join(f.root, 'crates/example/src/lib.rs'), 'pub fn fixture() {}\r\n')
  assert.equal(await sourceFingerprint(f.root), before)
  await validateNativeArtifacts(f)
})

test('distribution rejects changed WASI runtime dependencies at the same HEAD', async (t) => {
  const f = await fixture(t)
  await writeFile(path.join(f.root, 'packages/native/package.json'), JSON.stringify({
    version: '0.1.0',
    napi: { targets: [target] },
    dependencies: { '@napi-rs/wasm-runtime': '1.2.4' },
  }))
  await assert.rejects(validateNativeArtifacts(f), /source fingerprint mismatch/)
})

test('a version-only release commit retains verified compiled inputs', async (t) => {
  const f = await fixture(t)
  await hydrateNativeArtifacts(f)
  await writeFile(path.join(f.root, 'packages/native/package.json'), JSON.stringify({ version: '0.1.1', napi: { targets: [target] } }))
  commit(f.root, 'version only')
  await validateNativeArtifacts({ root: f.root, sourceSha: f.sourceSha, recordsDirectory: f.directory })
  await assert.rejects(hydrateNativeArtifacts(f), /source mismatch/)
})

test('historical projects without native Rust skip hydration', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'twm-no-native-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  assert.equal(await hydrateNativeArtifacts({ root }), false)
})

async function verify() {
  for (const { name, run } of checks) {
    const cleanup = []
    try {
      await run({ after: callback => cleanup.push(callback) })
      process.stdout.write(`PASS ${name}\n`)
    }
    finally {
      for (const callback of cleanup.reverse()) {
        await callback()
      }
    }
  }
  process.stdout.write(`Verified ${checks.length} native artifact lifecycle checks\n`)
}

verify().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
