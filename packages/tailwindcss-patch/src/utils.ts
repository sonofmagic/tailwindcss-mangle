import type { PackageJson } from 'pkg-types'
import type { SyncOpts } from 'resolve'
import path from 'node:path'
import { createDefu } from 'defu'
import fs from 'fs-extra'
import pkg from 'resolve'

export { defu } from 'defu'
const { sync } = pkg

export const defuOverrideArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = value
    return true
  }
})

export function requireResolve(id: string, opts?: SyncOpts) {
  return sync(id, opts)
}

function searchPackageJSON(dir: string) {
  let packageJsonPath
  while (true) {
    if (!dir) {
      return
    }
    const newDir = path.dirname(dir)
    if (newDir === dir) {
      return
    }
    dir = newDir
    packageJsonPath = path.join(dir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      break
    }
  }

  return packageJsonPath
}

function getTailwindcssEntry(name: string = 'tailwindcss', opts?: SyncOpts) {
  return requireResolve(name, opts)
}

function getPackageJsonPath(name: string, options: SyncOpts = {}) {
  const entry = getTailwindcssEntry(name, options)
  if (!entry) {
    return
  }

  return searchPackageJSON(entry)
}

export function getPackageInfoSync(name: string, options: SyncOpts = {}) {
  const packageJsonPath = getPackageJsonPath(name, options)
  if (!packageJsonPath) {
    return
  }

  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  return {
    name,
    version: packageJson.version,
    rootPath: path.dirname(packageJsonPath),
    packageJsonPath,
    packageJson,
  }
}

export function isObject(val: any) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false
};
