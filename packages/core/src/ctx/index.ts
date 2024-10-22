import type { ClassMapOutputItem, MangleUserConfig } from '@tailwindcss-mangle/config'
import process from 'node:process'
import { defaultMangleClassFilter, escapeStringRegexp } from '@/utils'
import { getConfig } from '@tailwindcss-mangle/config'
import { ClassGenerator } from '@tailwindcss-mangle/shared'
import { defu } from 'defu'
import { sort } from 'fast-sort'
import fs from 'fs-extra'
import { dirname, isAbsolute, resolve } from 'pathe'

interface InitConfigOptions {
  cwd?: string
  classList?: string[]
  mangleOptions?: MangleUserConfig
}

export class Context {
  options: MangleUserConfig
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
    this.classGenerator = new ClassGenerator(this.options.classGenerator)
    this.preserveFunctionSet = new Set(this.options?.preserveFunction ?? [])
    this.preserveFunctionRegexs = [...this.preserveFunctionSet.values()].map((x) => {
      return new RegExp(`${escapeStringRegexp(x)}\\(([^)]*)\\)`, 'g')
    })
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
    const { cwd, classList: _classList, mangleOptions } = opts
    const { config, cwd: configCwd } = await getConfig(cwd)
    if (mangleOptions?.classMapOutput === true) {
      mangleOptions.classMapOutput = config.mangle?.classMapOutput
      if (typeof mangleOptions.classMapOutput === 'object') {
        mangleOptions.classMapOutput.enable = true
      }
    }
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

  async dump() {
    try {
      const arr = Object.entries(this.classGenerator.newClassMap).map<ClassMapOutputItem>((x) => {
        return {
          before: x[0],
          after: x[1].name,
          usedBy: Array.from(x[1].usedBy),
        }
      })
      if (typeof this.options.classMapOutput === 'function') {
        await this.options.classMapOutput(arr)
      }
      else if (typeof this.options.classMapOutput === 'object' && this.options.classMapOutput.enable && this.options.classMapOutput.filename) {
        fs.mkdirSync(dirname(this.options.classMapOutput.filename), { recursive: true })
        fs.writeFileSync(this.options.classMapOutput.filename, JSON.stringify(arr, null, 2))
      }
    }
    catch (error) {
      console.error(`[tailwindcss-mangle]: ${error}`)
    }
  }
}
