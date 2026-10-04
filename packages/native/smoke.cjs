const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')

const native = require(process.argv[2] ? path.resolve(process.argv[2]) : './index.cjs')

const expectedTarget = process.env.TWM_EXPECT_BINDING_TARGET
if (expectedTarget) {
  assert.equal(native.__napiBindingTarget, expectedTarget)
}

const context = new native.NativeContext()
context.reset([{ original: 'bg-red-500', replacement: 'tw-a' }], [])
const result = context.transformJs('const x = "bg-red-500"', [], true)
assert.equal(result.valid, true)
assert.equal(result.edits[0].content, 'tw-a')
const unicodeSource = 'const icon = "😀"; const cls = "bg-red-500"'
assert.equal(context.transformJs(unicodeSource, [], true).edits[0].start, unicodeSource.indexOf('bg-red-500'))
assert.deepEqual(context.transformJs('twIgnore`bg-red-500`', [], true).preserved, ['bg-red-500'])
assert.deepEqual(native.splitCandidateTokensNative('bg-red-500 text-white'), ['bg-red-500', 'text-white'])
assert.equal(context.transformHtml('<div class="bg-red-500"></div>').edits[0].content, 'tw-a')
assert.equal(context.transformSelector('.bg-red-500', true).code, '.tw-a')

const patched = native.patchReturnContextNative('function processTailwindFeatures() { return function() { const context = {}; work(context); } }')
assert.equal(patched.hasPatched, false)
assert.equal(native.patchReturnContextNative(patched.code).hasPatched, true)
const units = native.patchLengthUnitsNative('const units = ["cm", "mm", "rpx"];', ['rpx', 'upx'])
assert.equal(units.changed, true)
assert.equal(native.patchLengthUnitsNative(units.code, ['rpx', 'upx']).changed, false)

async function filesystemSmoke() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'twm-native-smoke-'))
  try {
    const file = path.join(directory, 'tailwindcss-mangle.config.ts')
    const backup = path.join(directory, 'backup', 'config.ts')
    await fs.writeFile(file, 'export default {}\n')
    const before = await native.createRawCandidateFileFingerprintNative([file])
    assert.equal(await native.writeMigrationFileNative(file, 'export default {}\n', 'export default { changed: true }\n', backup), true)
    assert.equal(await fs.readFile(backup, 'utf8'), 'export default {}\n')
    assert.notEqual(await native.createRawCandidateFileFingerprintNative([file]), before)
    assert.deepEqual(await native.collectWorkspaceConfigFilesNative(directory, 1, ['tailwindcss-mangle.config.ts']), [file])
    const restored = await native.restoreConfigEntriesNative([{ file, backupFile: backup }], false)
    assert.equal(restored.restoredFiles, 1)
    assert.equal(await fs.readFile(file, 'utf8'), 'export default {}\n')

    // POSIX permissions are meaningful for an unprivileged host user. Windows
    // uses ACLs, and container root deliberately bypasses these mode bits.
    if (typeof process.getuid === 'function' && process.getuid() !== 0) {
      await fs.chmod(file, 0o400)
      try {
        await assert.rejects(native.writeMigrationFileNative(file, 'export default {}\n', 'denied write\n'))
        assert.equal(await fs.readFile(file, 'utf8'), 'export default {}\n')
      }
      finally {
        await fs.chmod(file, 0o600)
      }

      await fs.chmod(backup, 0o000)
      try {
        await assert.rejects(native.restoreConfigEntriesNative([{ file, backupFile: backup }], false))
        assert.equal(await fs.readFile(file, 'utf8'), 'export default {}\n')
      }
      finally {
        await fs.chmod(backup, 0o600)
      }
    }
  }
  finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

filesystemSmoke().then(() => {
  process.stdout.write(`Native kernel smoke passed (${native.__napiBindingTarget}, Node ${process.version})\n`)
}).catch((error) => {
  process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
})
