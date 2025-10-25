import type { NormalizedTailwindcssPatchOptions } from '../options/types'
import type { TailwindcssRuntimeContext } from '../types'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { extractValidCandidates } from '../extraction/candidate-extractor'
import { isObject } from '../utils'

export function collectClassesFromContexts(
  contexts: TailwindcssRuntimeContext[],
  filter: (className: string) => boolean,
) {
  const set = new Set<string>()
  for (const context of contexts) {
    if (!isObject(context) || !context.classCache) {
      continue
    }

    for (const key of context.classCache.keys()) {
      const className = key.toString()
      if (filter(className)) {
        set.add(className)
      }
    }
  }
  return set
}

export async function collectClassesFromTailwindV4(
  options: NormalizedTailwindcssPatchOptions,
) {
  const set = new Set<string>()
  const v4Options = options.tailwind.v4
  if (!v4Options) {
    return set
  }

  const sources = v4Options.sources?.map((source) => {
    return {
      base: source.base ?? v4Options.base ?? process.cwd(),
      pattern: source.pattern,
      negated: source.negated,
    }
  })

  if (v4Options.cssEntries.length > 0) {
    for (const entry of v4Options.cssEntries) {
      const filePath = path.isAbsolute(entry) ? entry : path.resolve(options.projectRoot, entry)
      if (!(await fs.pathExists(filePath))) {
        continue
      }
      const css = await fs.readFile(filePath, 'utf8')
      const candidates = await extractValidCandidates({
        cwd: options.projectRoot,
        base: v4Options.base,
        css,
        sources,
      })
      for (const candidate of candidates) {
        if (options.filter(candidate)) {
          set.add(candidate)
        }
      }
    }
  }
  else {
    const candidates = await extractValidCandidates({
      cwd: options.projectRoot,
      base: v4Options.base,
      css: v4Options.css,
      sources,
    })
    for (const candidate of candidates) {
      if (options.filter(candidate)) {
        set.add(candidate)
      }
    }
  }

  return set
}
