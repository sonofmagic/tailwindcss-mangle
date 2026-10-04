import type { IClassGenerator, IClassGeneratorContextItem, IClassGeneratorOptions } from './types'

import process from 'node:process'
import { defaultClassNameNative } from '@tailwindcss-mangle/native'
import { regExpTest, stripEscapeSequence } from './utils'

export class ClassGenerator implements IClassGenerator {
  public newClassMap: Record<string, IClassGeneratorContextItem>
  public newClassSize: number
  public context: Record<string, any>
  public opts: IClassGeneratorOptions
  public classPrefix: string
  constructor(opts: IClassGeneratorOptions = {}) {
    this.newClassMap = {}
    this.newClassSize = 0
    this.context = {}
    this.opts = opts
    this.classPrefix = opts.classPrefix ?? 'tw-'
  }

  defaultClassGenerate() {
    return defaultClassNameNative(this.newClassSize, this.classPrefix)
  }

  ignoreClassName(className: string): boolean {
    return regExpTest(this.opts.ignoreClass, className)
  }

  includeFilePath(filePath: string): boolean {
    const { include } = this.opts
    return Array.isArray(include) ? regExpTest(include, filePath) : true
  }

  excludeFilePath(filePath: string): boolean {
    const { exclude } = this.opts
    return Array.isArray(exclude) ? regExpTest(exclude, filePath) : false
  }

  isFileIncluded(filePath: string) {
    return this.includeFilePath(filePath) && !this.excludeFilePath(filePath)
  }

  transformCssClass(className: string): string {
    const key = stripEscapeSequence(className)
    const cn = this.newClassMap[key]
    if (cn) {
      return cn.name
    }
    return className
  }

  generateClassName(original: string): IClassGeneratorContextItem {
    const opts = this.opts

    original = stripEscapeSequence(original)
    const cn = this.newClassMap[original]
    if (cn) {
      return cn
    }

    let newClassName
    if (opts.customGenerate && typeof opts.customGenerate === 'function') {
      newClassName = opts.customGenerate(original, opts, this.context)
    }
    if (!newClassName) {
      newClassName = this.defaultClassGenerate()
    }

    if (opts.reserveClassName && regExpTest(opts.reserveClassName, newClassName)) {
      if (opts.log) {
        process.stdout.write(`The class name has been reserved. ${newClassName}\n`)
      }
      this.newClassSize++
      return this.generateClassName(original)
    }
    if (opts.log) {
      process.stdout.write(`Minify class name from ${original} to ${newClassName}\n`)
    }
    const newClass: IClassGeneratorContextItem = {
      name: newClassName,
      usedBy: new Set<string>(),
    }
    this.newClassMap[original] = newClass
    this.newClassSize++
    return newClass
  }
}
