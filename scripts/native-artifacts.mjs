import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))

export const targetFiles = {
  'aarch64-apple-darwin': ['mangle.darwin-arm64.node'],
  'x86_64-apple-darwin': ['mangle.darwin-x64.node'],
  'x86_64-pc-windows-msvc': ['mangle.win32-x64-msvc.node'],
  'aarch64-pc-windows-msvc': ['mangle.win32-arm64-msvc.node'],
  'x86_64-unknown-linux-gnu': ['mangle.linux-x64-gnu.node'],
  'aarch64-unknown-linux-gnu': ['mangle.linux-arm64-gnu.node'],
  'x86_64-unknown-linux-musl': ['mangle.linux-x64-musl.node'],
  'aarch64-unknown-linux-musl': ['mangle.linux-arm64-musl.node'],
  'wasm32-wasip1-threads': ['mangle.wasm32-wasi.wasm', 'mangle.wasi.cjs', 'wasi-worker.mjs', 'index.cjs', 'index.d.ts'],
}

function recordName(target) {
  return `native-artifact.${target}.json`
}

function gitHead(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
}

export async function nativeManifest(root) {
  try {
    return JSON.parse(await readFile(path.join(root, 'packages/native/package.json'), 'utf8'))
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

function configuredTargets(manifest) {
  const targets = manifest?.napi?.targets
  if (!Array.isArray(targets) || targets.length === 0 || new Set(targets).size !== targets.length) {
    throw new Error('Native package must declare distinct napi.targets')
  }
  for (const target of targets) {
    if (!Object.hasOwn(targetFiles, target)) {
      throw new Error(`Unsupported native artifact target: ${target}`)
    }
  }
  return [...targets].sort()
}

export async function sourceFingerprint(root) {
  const files = ['Cargo.lock', 'Cargo.toml', 'rust-toolchain.toml', 'packages/native/build.mjs']
  async function visit(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(relative)
      }
      else if (entry.isFile()) {
        files.push(relative)
      }
      else {
        throw new Error(`Unsupported native source entry: ${relative}`)
      }
    }
  }
  await visit('crates')
  const hash = createHash('sha256')
  for (const file of files.sort()) {
    // Windows checkouts may materialize CRLF for the same Git source.
    const content = Buffer.from((await readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n'))
    hash.update(`${file}\0${content.length}\0`).update(content)
  }
  function ordered(value) {
    if (Array.isArray(value)) {
      return value.map(ordered)
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]))
    }
    return value
  }
  // pnpm may increment the package version after verification. Every other
  // package setting, including runtime peers and code generation, stays bound
  // to the binaries that CI tested.
  const manifest = await nativeManifest(root)
  const { version: _version, ...inputs } = manifest
  hash.update('packages/native/package.json\0').update(JSON.stringify(ordered(inputs)))
  return hash.digest('hex')
}

async function fileDigest(directory, name) {
  const file = path.join(directory, name)
  const info = await stat(file).catch(() => undefined)
  if (!info?.isFile() || info.size < (name.endsWith('.node') || name.endsWith('.wasm') ? 1024 : 1)) {
    throw new Error(`Missing or empty native artifact: ${name}`)
  }
  const content = await readFile(file)
  return { name, size: content.length, sha256: createHash('sha256').update(content).digest('hex') }
}

export async function recordNativeArtifact({ root = repositoryRoot, directory = path.join(root, 'packages/native'), target }) {
  const targets = configuredTargets(await nativeManifest(root))
  if (!targets.includes(target)) {
    throw new Error(`Native build target is not configured: ${target}`)
  }
  const record = {
    schema: 1,
    sourceSha: gitHead(root),
    sourceFingerprint: await sourceFingerprint(root),
    targets,
    target,
    files: await Promise.all(targetFiles[target].map(name => fileDigest(directory, name))),
  }
  await writeFile(path.join(directory, recordName(target)), `${JSON.stringify(record, null, 2)}\n`)
  return record
}

export async function validateNativeArtifacts({
  root = repositoryRoot,
  directory = path.join(root, 'packages/native'),
  recordsDirectory = directory,
  sourceSha = gitHead(root),
  checkSource = true,
  sourceTargets,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error('Native artifacts require a full source commit SHA')
  }
  const targets = configuredTargets(sourceTargets ? { napi: { targets: sourceTargets } } : await nativeManifest(root))
  const expectedFiles = new Set(targets.flatMap(target => targetFiles[target]))
  for (const name of await readdir(directory)) {
    if (name.endsWith('.node') && !expectedFiles.has(name)) {
      throw new Error(`Unexpected native artifact would be packed: ${name}`)
    }
  }
  const fingerprint = checkSource ? await sourceFingerprint(root) : undefined
  const records = []
  for (const target of targets) {
    if (!Object.hasOwn(targetFiles, target)) {
      throw new Error(`Unsupported native artifact target: ${target}`)
    }
    const filename = recordName(target)
    const record = await readFile(path.join(recordsDirectory, filename), 'utf8')
      .then(JSON.parse)
      .catch((error) => { throw new Error(`Missing or invalid native artifact record: ${filename}`, { cause: error }) })
    if (record.schema !== 1 || record.target !== target || record.sourceSha !== sourceSha) {
      throw new Error(`Native artifact source mismatch: ${target}; expected ${sourceSha}`)
    }
    if (JSON.stringify(record.targets) !== JSON.stringify(targets)) {
      throw new Error(`Native artifact target set mismatch: ${target}`)
    }
    if (!/^[a-f0-9]{64}$/.test(record.sourceFingerprint)
      || (fingerprint !== undefined && record.sourceFingerprint !== fingerprint)
      || (records[0] && record.sourceFingerprint !== records[0].sourceFingerprint)) {
      throw new Error(`Native artifact source fingerprint mismatch: ${target}`)
    }
    const files = await Promise.all(targetFiles[target].map(name => fileDigest(directory, name)))
    if (JSON.stringify(record.files) !== JSON.stringify(files)) {
      throw new Error(`Native artifact checksum mismatch: ${target}`)
    }
    records.push(record)
  }
  return records
}

export async function hydrateNativeArtifacts({
  root = repositoryRoot,
  directory = process.env.TWM_NATIVE_ARTIFACTS_DIR,
  sourceSha = process.env.TWM_NATIVE_ARTIFACTS_SOURCE_SHA,
} = {}) {
  if (!await nativeManifest(root)) {
    return false
  }
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error('Prebuilt native artifacts require an absolute TWM_NATIVE_ARTIFACTS_DIR')
  }
  const head = gitHead(root)
  if (sourceSha !== head) {
    throw new Error(`Prebuilt native source mismatch: checkout ${head}, artifacts ${sourceSha ?? '(unspecified)'}`)
  }
  const records = await validateNativeArtifacts({ root, directory, sourceSha })
  const destination = path.join(root, 'packages/native')
  await mkdir(destination, { recursive: true })
  for (const record of records) {
    for (const name of record.files.map(file => file.name)) {
      if (path.resolve(directory, name) !== path.resolve(destination, name)) {
        await copyFile(path.join(directory, name), path.join(destination, name))
      }
    }
  }
  await validateNativeArtifacts({ root, sourceSha, recordsDirectory: directory })
  return true
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'record' && process.argv[3]) {
    await recordNativeArtifact({ target: process.argv[3] })
  }
  else {
    throw new Error('Usage: node scripts/native-artifacts.mjs record <target>')
  }
}
