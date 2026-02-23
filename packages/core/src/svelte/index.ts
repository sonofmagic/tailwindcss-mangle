import type { IHandlerTransformResult, IJsHandlerOptions } from '../types'
import MagicString from 'magic-string'
import { parse } from 'svelte/compiler'
import { cssHandler } from '../css'
import { jsHandler } from '../js'
import { makeRegex, splitCode } from '../shared'

interface ISvelteHandlerOptions extends IJsHandlerOptions {}

export async function svelteHandler(
  rawSource: string,
  options: ISvelteHandlerOptions,
): Promise<IHandlerTransformResult> {
  const { ctx, id } = options
  const ms = new MagicString(rawSource)

  try {
    const ast = parse(rawSource, {
      filename: id || 'unknown.svelte',
    })

    // Process the AST for class attributes and directives
    await processSvelteAst(ast, ms, ctx, id)

    return {
      code: ms.toString(),
      get map() {
        return ms.generateMap()
      },
    }
  }
  catch (error) {
    // Fallback to jsHandler if Svelte parsing fails
    return jsHandler(rawSource, options)
  }
}

async function processSvelteAst(
  ast: any,
  ms: MagicString,
  ctx: any,
  id?: string,
): Promise<void> {
  const { replaceMap, classGenerator } = ctx
  const stylePromises: Promise<void>[] = []

  // Walk the AST and process class-related nodes
  async function walk(node: any) {
    if (!node) { return }

    // Handle regular class attributes
    if (node.type === 'Attribute' && node.name === 'class') {
      for (const attrValue of node.value) {
        if (attrValue.type === 'Text') {
          const classValue = attrValue.data
          const arr = splitCode(classValue, { splitQuote: false })
          let newValue = classValue
          let needUpdate = false

          for (const v of arr) {
            if (replaceMap.has(v)) {
              const gen = classGenerator.generateClassName(v)
              newValue = newValue.replace(makeRegex(v), gen.name)
              if (id) {
                ctx.addToUsedBy(v, id)
              }
              needUpdate = true
            }
          }

          if (needUpdate) {
            const start = attrValue.start
            const end = attrValue.end
            ms.update(start, end, newValue)
          }
        }
      }
    }

    // Handle class directives (class:name={value})
    if (node.type === 'ClassDirective') {
      // Class directives like `class:bg-red-500={condition}`
      // We should extract the class name but not transform it in the directive itself
      const className = node.name
      if (replaceMap.has(className)) {
        if (id) {
          ctx.addToUsedBy(className, id)
        }
        // Note: We don't transform class directives as they are dynamic
        // but we track their usage
      }
    }

    // Handle script tag
    if (node.type === 'Script') {
      const contentStart = node.content.start
      const contentEnd = node.content.end
      const innerContent = ms.original.slice(contentStart, contentEnd)

      const jsHandlerOptions = id === undefined ? { ctx } : { ctx, id }
      const result = jsHandler(innerContent, jsHandlerOptions)
      if (result.code !== innerContent) {
        ms.update(contentStart, contentEnd, result.code)
      }
      return // Don't process children of Script tag
    }

    // Handle style tag - collect promises
    if (node.type === 'Style') {
      const contentStart = node.content.start
      const contentEnd = node.content.end
      const innerContent = ms.original.slice(contentStart, contentEnd)

      const cssHandlerOptions = id === undefined ? { ctx } : { ctx, id }
      const promise = cssHandler(innerContent, cssHandlerOptions).then((result) => {
        if (result.code !== innerContent) {
          ms.update(contentStart, contentEnd, result.code)
        }
      })
      stylePromises.push(promise)
      return // Don't process children of Style tag
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        await walk(child)
      }
    }
  }

  await walk(ast)

  // Wait for all style transformations to complete
  await Promise.all(stylePromises)
}
