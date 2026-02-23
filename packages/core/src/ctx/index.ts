import type { TransformerMappingEntry, TransformerOptions } from '@tailwindcss-mangle/config'
import process from 'node:process'
import { getConfig } from '@tailwindcss-mangle/config'
import { defu } from 'defu'
import { sort } from 'fast-sort'
import fs from 'fs-extra'
import { dirname, isAbsolute, resolve } from 'pathe'
import { ClassGenerator, defaultMangleClassFilter, escapeStringRegexp } from '../shared'

interface InitConfigOptions {
  cwd?: string
  classList?: string[]
  transformerOptions?: TransformerOptions
}

export class Context {
  options: TransformerOptions
  public replaceMap: Map<string, string>
  classSet: Set<string>

  classGenerator: ClassGenerator

  configRoot: string

  preserveFunctionSet: Set<string>
  preserveClassNamesSet: Set<string>
  preserveFunctionRegexs: RegExp[]
  constructor() {
    this.options = {}
    this.classSet = new Set()
    this.replaceMap = new Map()
    this.classGenerator = new ClassGenerator()
    this.configRoot = process.cwd()
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

  private mergeOptions(...opts: (TransformerOptions | undefined)[]) {
    // 配置选项优先
    this.options = defu(this.options, ...opts)
    this.classGenerator = new ClassGenerator(this.options.generator)
    const preserveOptions = this.options.preserve ?? {}
    this.preserveFunctionSet = new Set(preserveOptions.functions ?? [])
    this.preserveClassNamesSet = new Set(preserveOptions.classes ?? [])
    this.preserveFunctionRegexs = [...this.preserveFunctionSet.values()].map((x) => {
      return new RegExp(`${escapeStringRegexp(x)}\\(([^)]*)\\)`, 'g')
    })
  }

  currentMangleClassFilter(className: string) {
    if (this.preserveClassNamesSet.has(className)) {
      return false
    }
    return (this.options.filter ?? defaultMangleClassFilter)(className)
  }

  getClassSet() {
    return this.classSet
  }

  getReplaceMap() {
    return this.replaceMap // map
  }

  addToUsedBy(key: string, file?: string) {
    if (!file) {
      return
    }
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
    const { cwd, classList: _classList, transformerOptions } = opts
    const { config, cwd: configCwd } = await getConfig(cwd)
    this.configRoot = configCwd ?? cwd ?? process.cwd()

    const normalizedTransformer = transformerOptions
      ? { ...transformerOptions, registry: { ...transformerOptions.registry } }
      : undefined

    if (normalizedTransformer?.registry?.mapping === true) {
      const fallback = config?.transformer?.registry?.mapping
      if (typeof fallback === 'function') {
        normalizedTransformer.registry.mapping = fallback
      }
      else if (fallback && typeof fallback === 'object') {
        normalizedTransformer.registry.mapping = {
          ...fallback,
          enabled: true,
        }
      }
      else {
        normalizedTransformer.registry.mapping = {
          enabled: true,
        }
      }
    }

    this.mergeOptions(normalizedTransformer, config?.transformer)
    if (_classList) {
      this.loadClassSet(_classList)
    }
    else {
      const fallbackFile = config?.registry?.output?.file
      let jsonPath = this.options.registry?.file ?? fallbackFile
      if (jsonPath) {
        if (!isAbsolute(jsonPath)) {
          jsonPath = resolve(this.configRoot, jsonPath)
        }

        if (fs.existsSync(jsonPath)) {
          const rawClassList = fs.readFileSync(jsonPath, 'utf8')
          const list = JSON.parse(rawClassList) as string[]
          // why?
          // cause bg-red-500 and bg-red-500/50 same time
          // transform bg-red-500/50 first
          this.loadClassSet(list)
        }
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

  async dump() {
    try {
      const arr = Object.entries(this.classGenerator.newClassMap).map<TransformerMappingEntry>((x) => {
        return {
          original: x[0],
          mangled: x[1].name,
          usedBy: Array.from(x[1].usedBy),
        }
      })
      const mappingOption = this.options.registry?.mapping
      if (typeof mappingOption === 'function') {
        await mappingOption(arr)
      }
      else if (mappingOption && typeof mappingOption === 'object' && mappingOption.enabled && mappingOption.file) {
        const outputFile = isAbsolute(mappingOption.file) ? mappingOption.file : resolve(this.configRoot, mappingOption.file)
        fs.mkdirSync(dirname(outputFile), { recursive: true })
        fs.writeFileSync(outputFile, JSON.stringify(arr, null, 2))
      }
    }
    catch (error) {
      console.error(`[tailwindcss-mangle]: ${error}`)
    }
  }
}
