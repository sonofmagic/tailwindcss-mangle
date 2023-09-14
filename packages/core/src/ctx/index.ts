import fs from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { ClassGenerator } from '@tailwindcss-mangle/shared'
import { getConfig } from '@tailwindcss-mangle/config'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import { sort } from 'fast-sort'
import defu from 'defu'
import AhoCorasick from 'modern-ahocorasick'
import { createGlobMatcher, defaultMangleClassFilter } from '@/utils'
export class Context {
  options: MangleUserConfig
  includeMatcher: (file: string) => boolean
  excludeMatcher: (file: string) => boolean
  classSet: Set<string>
  replaceMap: Map<string, string>
  classGenerator: ClassGenerator
  ahoCorasick?: AhoCorasick
  useAC: boolean
  preserveFunctionSet: Set<string>
  preserveClassNamesSet: Set<string>
  constructor(opts: MangleUserConfig = {}) {
    this.options = opts //  defu(opts, getDefaultMangleUserConfig())
    this.classSet = new Set()
    this.replaceMap = new Map()
    this.includeMatcher = createGlobMatcher(this.options.include, true)
    this.excludeMatcher = createGlobMatcher(this.options.exclude, false)
    this.classGenerator = new ClassGenerator(this.options.classGenerator)
    this.useAC = false
    this.preserveFunctionSet = new Set(opts.preserveFunction)
    this.preserveClassNamesSet = new Set()
  }

  isPreserveClass(className: string) {
    return this.preserveClassNamesSet.has(className)
  }

  addPreserveClass(className: string) {
    return this.preserveClassNamesSet.add(className)
  }

  isPreserveFunction(calleeName: string) {
    // if (callee === undefined) {
    //   return false
    // }
    return this.preserveFunctionSet.has(calleeName)
  }

  mergeOptions(opts?: MangleUserConfig) {
    // 配置选项优先
    this.options = defu(this.options, opts)
    this.includeMatcher = createGlobMatcher(this.options.include, true)
    this.excludeMatcher = createGlobMatcher(this.options.exclude, false)
    this.classGenerator = new ClassGenerator(this.options.classGenerator)
  }

  isInclude(file: string) {
    return this.includeMatcher(file) && !this.excludeMatcher(file)
  }

  currentMangleClassFilter(className: string) {
    return (this.options.mangleClassFilter ?? defaultMangleClassFilter)(className)
  }

  getClassSet() {
    return this.classSet
  }

  getReplaceMap() {
    const map = new Map<string, string>()
    for (const [key, value] of this.replaceMap) {
      if (!this.isPreserveClass(key)) {
        map.set(key, value)
      }
    }
    return map
  }

  addToUsedBy(key: string, file: string) {
    const hit = this.classGenerator.newClassMap[key]
    if (hit) {
      hit.usedBy.add(file)
    }
  }

  search(str: string) {
    const arr = this.ahoCorasick?.search(str) ?? []
    const map = new Map<string, [number, number][]>()
    for (const [end, classNames] of arr) {
      for (const className of classNames) {
        if (map.has(className)) {
          const v = map.get(className)
          if (v) {
            v.push([end - className.length + 1, end + 1])
          }
        } else {
          map.set(className, [[end - className.length + 1, end + 1]])
        }
      }
    }
    // end - str.length + 1, end + 1, value
    return {
      map,
      arr: sort([...map.entries()]).desc((x) => x[0].length)
    }
  }

  async initConfig(cwd?: string) {
    const { config, cwd: configCwd } = await getConfig(cwd)
    const mangleConfig = config?.mangle
    this.mergeOptions(mangleConfig)

    let jsonPath = this.options.classListPath ?? resolve(process.cwd(), config?.patch?.output?.filename as string)
    if (!isAbsolute(jsonPath)) {
      jsonPath = resolve(configCwd ?? process.cwd(), jsonPath)
    }

    if (jsonPath && fs.existsSync(jsonPath)) {
      const rawClassList = fs.readFileSync(jsonPath, 'utf8')
      const list = JSON.parse(rawClassList) as string[]
      // why?
      // cause bg-red-500 and bg-red-500/50 same time
      // transform bg-red-500/50 first
      const classList = sort(list).desc((c) => c.length)
      for (const className of classList) {
        if (this.currentMangleClassFilter(className)) {
          this.classSet.add(className)
        }
      }
    }
    const keywords: string[] = []
    for (const cls of this.classSet) {
      this.classGenerator.generateClassName(cls)
      keywords.push(cls)
    }
    this.ahoCorasick = new AhoCorasick(keywords)

    for (const x of Object.entries(this.classGenerator.newClassMap)) {
      this.replaceMap.set(x[0], x[1].name)
    }
    return config
  }
}
