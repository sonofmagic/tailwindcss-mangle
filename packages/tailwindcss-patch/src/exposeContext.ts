import path from 'path'
import fs from 'fs'
import type { Rule } from 'postcss'
import { requireResolve } from './utils'

export function getTailwindcssEntry(basedir: string = process.cwd()) {
  return requireResolve('tailwindcss')
}

export function getContexts(basedir?: string) {
  const twPath = getTailwindcssEntry(basedir)

  const distPath = path.dirname(twPath)

  let injectFilePath = path.join(distPath, 'plugin.js')
  if (!fs.existsSync(injectFilePath)) {
    injectFilePath = path.join(distPath, 'index.js')
  }

  const mo = require(injectFilePath)
  if (mo.contextRef) {
    return mo.contextRef.value as any[]
  }
  return []
}

export function getClassCaches(basedir?: string): Map<
  string,
  (
    | {
        layer: string
        options: Record<string, any>
        sort: Record<string, any>
      }
    | Rule
  )[]
>[] {
  const contexts = getContexts(basedir)
  return (contexts as any[]).map((x) => x.classCache)
}

export function getClassCacheSet(basedir?: string): Set<string> {
  const classCaches = getClassCaches(basedir)
  const classSet = new Set<string>()
  for (let i = 0; i < classCaches.length; i++) {
    const classCacheMap = classCaches[i]
    const keys = classCacheMap.keys()
    for (const key of keys) {
      classSet.add(key)
    }
  }
  return classSet
}
