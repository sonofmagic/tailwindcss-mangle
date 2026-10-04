import process from 'node:process'
import { validateNativeArtifacts } from './native-artifacts.mjs'

const directory = process.argv[2]
const sourceSha = process.argv[3] ?? process.env.TWM_NATIVE_ARTIFACTS_SOURCE_SHA
// Outer recovery validation runs current tooling before repoctl checks out the
// historical source. Hydration checks that source's actual files and HEAD.
const sourceTargets = process.argv[4] ? JSON.parse(process.argv[4]) : undefined
const records = await validateNativeArtifacts({
  ...(directory ? { directory } : {}),
  ...(!directory && process.env.TWM_NATIVE_ARTIFACTS_DIR ? { recordsDirectory: process.env.TWM_NATIVE_ARTIFACTS_DIR } : {}),
  ...(sourceSha ? { sourceSha } : {}),
  ...(sourceTargets ? { sourceTargets, checkSource: false } : {}),
})
process.stdout.write(`Verified native distribution: ${records.length} targets at ${records[0].sourceSha}\n`)
