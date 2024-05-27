import path from 'node:path'
import fs from 'node:fs'
import type { TailwindcssClassCache, TailwindcssRuntimeContext } from '@/types'
import { requireResolve } from '@/utils'

export function getTailwindcssEntry(basedir?: string) {
  return requireResolve('tailwindcss', {
    basedir,
  })
}

export function getContexts(basedir?: string): TailwindcssRuntimeContext[] {
  const twPath = getTailwindcssEntry(basedir)

  const distPath = path.dirname(twPath)

  let injectFilePath = path.join(distPath, 'plugin.js')
  if (!fs.existsSync(injectFilePath)) {
    injectFilePath = path.join(distPath, 'index.js')
  }

  const mo = require(injectFilePath)
  if (mo.contextRef) {
    return mo.contextRef.value
  }
  return []
}

export function getClassCaches(basedir?: string): TailwindcssClassCache[] {
  const contexts = getContexts(basedir)
  return contexts.map(x => x.classCache)
}

export function getClassCacheSet(basedir?: string, options?: { removeUniversalSelector?: boolean }): Set<string> {
  const classCaches = getClassCaches(basedir)
  const classSet = new Set<string>()
  for (const classCacheMap of classCaches) {
    const keys = classCacheMap.keys()
    for (const key of keys) {
      const v = key.toString()
      if (options?.removeUniversalSelector && v === '*') {
        continue
      }
      classSet.add(v)
    }
  }
  return classSet
}
