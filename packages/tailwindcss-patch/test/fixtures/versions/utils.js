import fs from 'node:fs/promises'
import path from 'pathe'
import { fileURLToPath } from 'node:url'

export function getCurrentFilename (importMetaUrl) {
  return fileURLToPath(importMetaUrl)
}

export async function ensureDir (p) {
  await fs.mkdir(p, {
    recursive: true
  })
}

export async function copyFiles (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      const { src, dest } = arr[i]
      await ensureDir(path.dirname(dest))

      const isExisted = await pathExists(src)

      if (isExisted) {
        await fs.copyFile(src, dest)
      } else {
        console.warn(`[warning]: 404 ${src}`)
      }
    }
  }
}

export async function pathExists (target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
