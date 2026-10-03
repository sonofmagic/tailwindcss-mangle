import fs from 'node:fs/promises'
import path from 'node:path'

export async function snapshotFiles(files: readonly string[]): Promise<() => Promise<void>> {
  const snapshots = await Promise.all(files.map(async (file) => {
    try {
      return { file, content: await fs.readFile(file) }
    }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { file, content: undefined }
      }
      throw error
    }
  }))

  return async () => {
    const results = await Promise.allSettled(snapshots.map(async ({ file, content }) => {
      if (content === undefined) {
        await fs.rm(file, { force: true })
      }
      else {
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, content)
      }
    }))
    const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Failed to restore E2E fixture files')
    }
  }
}
