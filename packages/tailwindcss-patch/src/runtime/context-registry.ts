import type { PackageInfo } from 'local-pkg'
import type { TailwindcssRuntimeContext } from '../types'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import path from 'pathe'

const require = createRequire(import.meta.url)

function resolveRuntimeEntry(packageInfo: PackageInfo, majorVersion: 2 | 3): string | undefined {
  const root = packageInfo.rootPath

  if (majorVersion === 2) {
    const jitIndex = path.join(root, 'lib/jit/index.js')
    if (fs.existsSync(jitIndex)) {
      return jitIndex
    }
  }
  else if (majorVersion === 3) {
    const plugin = path.join(root, 'lib/plugin.js')
    const index = path.join(root, 'lib/index.js')
    if (fs.existsSync(plugin)) {
      return plugin
    }
    if (fs.existsSync(index)) {
      return index
    }
  }

  return undefined
}

export function loadRuntimeContexts(
  packageInfo: PackageInfo,
  majorVersion: 2 | 3 | 4,
  refProperty: string,
): TailwindcssRuntimeContext[] {
  if (majorVersion === 4) {
    return []
  }

  const entry = resolveRuntimeEntry(packageInfo, majorVersion)
  if (!entry) {
    return []
  }

  const moduleExports = require(entry) as Record<string, any>
  if (!moduleExports) {
    return []
  }

  const ref = moduleExports[refProperty]
  if (!ref) {
    return []
  }

  if (Array.isArray(ref)) {
    return ref as TailwindcssRuntimeContext[]
  }

  if (typeof ref === 'object' && Array.isArray(ref.value)) {
    return ref.value as TailwindcssRuntimeContext[]
  }

  return []
}
