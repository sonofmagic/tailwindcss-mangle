import fs from 'node:fs'
import { sync, type SyncOpts } from 'resolve'

export function ensureFileContent(filepaths: string | string[]) {
  if (typeof filepaths === 'string') {
    filepaths = [filepaths]
  }
  let content
  for (const filepath of filepaths) {
    if (fs.existsSync(filepath)) {
      content = fs.readFileSync(filepath, {
        encoding: 'utf8'
      })
      break
    }
  }
  return content
}

export function requireResolve(id: string, opts?: SyncOpts) {
  return sync(id, opts)
}
