import fs from 'node:fs'
import { resolve } from 'node:path'
import { ClassGenerator } from '@tailwindcss-mangle/shared'
import { getConfig, getDefaultUserConfig } from '@tailwindcss-mangle/config'
import type { UserConfig } from '@tailwindcss-mangle/config'
import defu from 'defu'
import { sort } from 'fast-sort'
import { htmlHandler, cssHandler, jsHandler, preProcessJs } from '@tailwindcss-mangle/core'
import type { Options, ClassMapOutputOptions } from '@/types'
import { createGlobMatcher, defaultMangleClassFilter } from '@/utils'

export function getOptions(opts: Options | undefined = {}) {
  const {
    include,
    exclude,
    disabled,
    mangleClassFilter,
    classMapOutput,
    classGenerator: classGeneratorOptions,
    classListPath: _classListPath
  } = defu<Options, Options[]>(opts, {
    include: ['**/*.{js,jsx,ts,tsx,svelte,vue}'],
    exclude: ['**/*.{css,scss,less,sass,postcss,html,htm}'],
    disabled: process.env.NODE_ENV === 'development'
  })
  const includeMatcher = createGlobMatcher(include, true)
  const excludeMatcher = createGlobMatcher(exclude, false)
  const currentMangleClassFilter = mangleClassFilter ?? defaultMangleClassFilter

  function isInclude(file: string) {
    return includeMatcher(file) && !excludeMatcher(file)
  }

  const classSet: Set<string> = new Set()
  const replaceMap: Map<string, string> = new Map()
  let userConfig: UserConfig = getDefaultUserConfig()

  const classMapOutputOptions: ClassMapOutputOptions = {
    filename: 'classMap.json'
  }

  if (typeof classMapOutput === 'object') {
    Object.assign(classMapOutputOptions, classMapOutput)
  }

  // let cached: boolean
  const classGenerator = new ClassGenerator(classGeneratorOptions)

  function getCachedClassSet() {
    return classSet
  }

  function getReplaceMap() {
    return replaceMap
  }

  async function initConfig() {
    const { config } = await getConfig()
    userConfig = config as UserConfig
    let classListPath: string = ''
    if (userConfig) {
      classListPath = resolve(process.cwd(), userConfig.patch?.output?.filename as string)
    }
    if (_classListPath) {
      classListPath = _classListPath
    }

    if (classListPath && fs.existsSync(classListPath)) {
      const rawClassList = fs.readFileSync(classListPath, 'utf8')
      const list = JSON.parse(rawClassList) as string[]
      // why?
      // case bg-red-500 and bg-red-500/50
      // transform bg-red-500/50 first
      const classList = sort(list).desc((c) => c.length)
      for (const className of classList) {
        if (currentMangleClassFilter(className)) {
          classSet.add(className)
        }
      }
    }
    for (const cls of classSet) {
      classGenerator.generateClassName(cls)
    }

    for (const x of Object.entries(classGenerator.newClassMap)) {
      replaceMap.set(x[0], x[1].name)
    }
    return config
  }

  function addToUsedBy(key: string, file: string) {
    const hit = classGenerator.newClassMap[key]
    if (hit) {
      hit.usedBy.add(file)
    }
  }

  return {
    getCachedClassSet,
    classGenerator,
    includeMatcher,
    excludeMatcher,
    isInclude,
    classMapOutputOptions,
    initConfig,
    getReplaceMap,
    addToUsedBy,
    disabled,
    htmlHandler,
    cssHandler,
    jsHandler,
    preProcessJs
  }
}
