import fs from 'node:fs/promises'
import path from 'node:path'
import micromatch from 'micromatch'

import { groupBy } from '@tailwindcss-mangle/shared'
import { pluginName } from './constants'
const { isMatch } = micromatch

export function getGroupedEntries<T>(
  entries: [string, T][],
  options = {
    cssMatcher(file: string) {
      return /\.css$/.test(file)
    },
    htmlMatcher(file: string) {
      return /\.html?$/.test(file)
    },
    jsMatcher(file: string) {
      return /\.[cm]?js$/.test(file)
    }
  }
) {
  const { cssMatcher, htmlMatcher, jsMatcher } = options
  const groupedEntries = groupBy(entries, ([file]) => {
    if (cssMatcher(file)) {
      return 'css'
    } else if (htmlMatcher(file)) {
      return 'html'
    } else if (jsMatcher(file)) {
      return 'js'
    } else {
      return 'other'
    }
  })
  if (!groupedEntries.css) {
    groupedEntries.css = []
  }
  if (!groupedEntries.html) {
    groupedEntries.html = []
  }
  if (!groupedEntries.js) {
    groupedEntries.js = []
  }
  if (!groupedEntries.other) {
    groupedEntries.other = []
  }
  return groupedEntries as Record<'css' | 'html' | 'js' | 'other', [string, T][]>
}

export function createGlobMatcher(pattern: string | string[] | undefined, fallbackValue: boolean = false) {
  if (pattern === undefined) {
    return function () {
      return fallbackValue
    }
  }
  return function (file: string) {
    return isMatch(file, pattern)
  }
}

export function getCacheDir(basedir = process.cwd()) {
  return path.resolve(basedir, 'node_modules/.cache', pluginName)
}

export async function ensureDir(p: string) {
  try {
    await fs.access(p)
  } catch {
    await fs.mkdir(p, {
      recursive: true
    })
  }
}

export { defaultMangleClassFilter, isMap, isRegexp } from '@tailwindcss-mangle/shared'
