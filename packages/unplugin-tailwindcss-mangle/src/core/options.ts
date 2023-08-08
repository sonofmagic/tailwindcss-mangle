import fs from 'node:fs'
import { resolve } from 'node:path'
import { ClassGenerator } from '@tailwindcss-mangle/core'
import type { IHtmlHandlerOptions, IJsHandlerOptions, ICssHandlerOptions } from '@tailwindcss-mangle/core'
import { getConfig, getDefaultUserConfig } from '@tailwindcss-mangle/config'
import type { UserConfig } from '@tailwindcss-mangle/config'
import defu from 'defu'
import type { Options, ClassMapOutputOptions } from '@/types'
import { createGlobMatcher, defaultMangleClassFilter } from '@/utils'
export function getOptions(opts: Options | undefined = {}) {
  const options = defu<Options, Options[]>(opts, {
    include: ['**/*.{js,jsx,ts,tsx,html,htm,svelte}'],
    exclude: ['**/*.{css,scss,less,sass,postcss}']
  })
  const includeMatcher = createGlobMatcher(options.include, true)
  const excludeMatcher = createGlobMatcher(options.exclude, false)
  const currentMangleClassFilter = options.mangleClassFilter ?? defaultMangleClassFilter

  function isInclude(file: string) {
    return includeMatcher(file) && !excludeMatcher(file)
  }

  const classSet: Set<string> = new Set()
  const replaceMap: Map<string, string> = new Map()
  let userConfig: UserConfig = getDefaultUserConfig()

  const classMapOutputOptions: ClassMapOutputOptions = {
    filename: 'classMap.json'
  }

  if (typeof options.classMapOutput === 'object') {
    Object.assign(classMapOutputOptions, options.classMapOutput)
  }

  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)

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
    if (options.classListPath) {
      classListPath = options.classListPath
    }

    if (classListPath) {
      const rawClassList = fs.readFileSync(classListPath, 'utf8')
      const classList = JSON.parse(rawClassList) as string[]
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

  return {
    getCachedClassSet,
    classGenerator,
    includeMatcher,
    excludeMatcher,
    isInclude,
    classMapOutputOptions,
    jsHandlerOptions: <IJsHandlerOptions>(options.jsHandlerOptions ?? {}),
    htmlHandlerOptions: <IHtmlHandlerOptions>(options.htmlHandlerOptions ?? {}),
    cssHandlerOptions: <ICssHandlerOptions>(options.cssHandlerOptions ?? {}),
    initConfig,
    getReplaceMap
  }
}
