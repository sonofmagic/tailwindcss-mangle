import fs from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { ClassGenerator } from '@tailwindcss-mangle/shared'
import { getConfig } from '@tailwindcss-mangle/config'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import { sort } from 'fast-sort'
import defu from 'defu'
import { createGlobMatcher, defaultMangleClassFilter, escapeStringRegexp } from '@/utils'

interface InitConfigOptions {
  cwd?: string
  classList?: string[]
  mangleOptions?: MangleUserConfig
}

export class Context {
  options: MangleUserConfig
  private includeMatcher: (file: string) => boolean
  private excludeMatcher: (file: string) => boolean
  public replaceMap: Map<string, string>
  classSet: Set<string>

  classGenerator: ClassGenerator

  preserveFunctionSet: Set<string>
  preserveClassNamesSet: Set<string>
  preserveFunctionRegexs: RegExp[]
  constructor() {
    this.options = {}
    this.classSet = new Set()
    this.replaceMap = new Map()
    this.includeMatcher = () => true
    this.excludeMatcher = () => false
    this.classGenerator = new ClassGenerator()
    this.preserveFunctionSet = new Set()
    this.preserveClassNamesSet = new Set()
    this.preserveFunctionRegexs = []
  }

  isPreserveClass(className: string) {
    return this.preserveClassNamesSet.has(className)
  }

  addPreserveClass(className: string) {
    return this.preserveClassNamesSet.add(className)
  }

  isPreserveFunction(calleeName: string) {
    return this.preserveFunctionSet.has(calleeName)
  }

  private mergeOptions(...opts: (MangleUserConfig | undefined)[]) {
    // 配置选项优先
    this.options = defu(this.options, ...opts)
    this.includeMatcher = createGlobMatcher(this.options.include, true)
    this.excludeMatcher = createGlobMatcher(this.options.exclude, false)
    this.classGenerator = new ClassGenerator(this.options.classGenerator)
    this.preserveFunctionSet = new Set(this.options?.preserveFunction ?? [])
    this.preserveFunctionRegexs = [...this.preserveFunctionSet.values()].map((x) => {
      return new RegExp(`${escapeStringRegexp(x)}\\(([^)]*)\\)`, 'g')
    })
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
    return this.replaceMap // map
  }

  addToUsedBy(key: string, file: string) {
    const hit = this.classGenerator.newClassMap[key]
    if (hit) {
      hit.usedBy.add(file)
    }
  }

  loadClassSet(classList: string[]) {
    const list = sort(classList).desc(c => c.length)
    for (const className of list) {
      if (this.currentMangleClassFilter(className)) {
        this.classSet.add(className)
      }
    }
  }

  async initConfig(opts: InitConfigOptions = {}) {
    const { cwd, classList: _classList, mangleOptions } = opts
    const { config, cwd: configCwd } = await getConfig(cwd)

    this.mergeOptions(mangleOptions, config?.mangle)
    if (_classList) {
      this.loadClassSet(_classList)
    }
    else {
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
        this.loadClassSet(list)
      }
    }

    for (const cls of this.classSet) {
      this.classGenerator.generateClassName(cls)
    }

    for (const x of Object.entries(this.classGenerator.newClassMap)) {
      this.replaceMap.set(x[0], x[1].name)
    }
    return config
  }

  // ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
}
