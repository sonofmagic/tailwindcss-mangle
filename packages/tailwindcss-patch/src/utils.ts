import fss from 'node:fs'
import fs from 'node:fs/promises'
import type { SyncOpts } from 'resolve'
import pkg from 'resolve'

const { sync } = pkg

export function ensureFileContent(filepaths: string | string[]) {
  if (typeof filepaths === 'string') {
    filepaths = [filepaths]
  }
  let content
  for (const filepath of filepaths) {
    if (fss.existsSync(filepath)) {
      content = fss.readFileSync(filepath, {
        encoding: 'utf8',
      })
      break
    }
  }
  return content
}

export function requireResolve(id: string, opts?: SyncOpts) {
  return sync(id, opts)
}

export async function ensureDir(p: string) {
  try {
    await fs.access(p)
  }
  catch {
    await fs.mkdir(p, {
      recursive: true,
    })
  }
}
