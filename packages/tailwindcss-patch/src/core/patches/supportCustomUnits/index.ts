import type { ArrayExpression, StringLiteral } from '@babel/types'
import type { ILengthUnitsPatchOptions } from '../../../types'
import * as t from '@babel/types'
import { defuOverrideArray } from '@tailwindcss-mangle/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { generate, parse, traverse } from '../../../babel'
import logger from '../../../logger'
import { spliceChangesIntoString } from '../../../utils'

function findAstNode(content: string, options: ILengthUnitsPatchOptions) {
  const { variableName, units } = options
  const ast = parse(content)

  let arrayRef: ArrayExpression | undefined
  let changed = false
  traverse(ast, {
    Identifier(path) {
      if (
        path.node.name === variableName
        && t.isVariableDeclarator(path.parent)
        && t.isArrayExpression(path.parent.init)
      ) {
        arrayRef = path.parent.init
        const set = new Set(path.parent.init.elements.map(x => (<StringLiteral>x).value))
        for (const unit of units) {
          if (!set.has(unit)) {
            path.parent.init.elements = path.parent.init.elements.map((x) => {
              if (t.isStringLiteral(x)) {
                return {
                  type: x.type,
                  value: x.value,
                }
              }
              return x
            })
            path.parent.init.elements.push({
              type: 'StringLiteral',
              value: unit,
            })
            changed = true
          }
        }
      }
    },
  })
  return {
    arrayRef,
    changed,
  }
}

export function monkeyPatchForSupportingCustomUnitV3(rootDir: string, options?: Partial<ILengthUnitsPatchOptions>) {
  const opts = defuOverrideArray<Required<ILengthUnitsPatchOptions>, ILengthUnitsPatchOptions[]>(options as Required<ILengthUnitsPatchOptions>, {
    units: ['rpx'],
    lengthUnitsFilePath: 'lib/util/dataTypes.js',
    variableName: 'lengthUnits',
    overwrite: true,
  })
  const { lengthUnitsFilePath, overwrite, destPath } = opts
  const dataTypesFilePath = path.resolve(rootDir, lengthUnitsFilePath)
  const dataTypesFileContent = fs.readFileSync(dataTypesFilePath, {
    encoding: 'utf8',
  })
  const { arrayRef, changed } = findAstNode(dataTypesFileContent, opts)
  if (arrayRef && changed) {
    const { code } = generate(arrayRef, {
      jsescOption: {
        quotes: 'single',
      },
    })

    if (arrayRef.start && arrayRef.end) {
      const prev = dataTypesFileContent.slice(0, arrayRef.start)
      const next = dataTypesFileContent.slice(arrayRef.end as number)
      const newCode = prev + code + next
      if (overwrite) {
        fs.writeFileSync(destPath ?? dataTypesFilePath, newCode, {
          encoding: 'utf8',
        })
        logger.success('patch tailwindcss for custom length unit successfully!')
      }
    }
    return {
      [opts.lengthUnitsFilePath]: code,
    }
  }
}

// "cm","mm","Q","in","pc","pt","px","em","ex","ch","rem","lh","rlh","vw","vh","vmin","vmax","vb","vi","svw","svh","lvw","lvh","dvw","dvh","cqw","cqh","cqi","cqb","cqmin","cqmax"

export function monkeyPatchForSupportingCustomUnitV4(rootDir: string, options?: Partial<ILengthUnitsPatchOptions>) {
  const opts = defuOverrideArray<Required<ILengthUnitsPatchOptions>, ILengthUnitsPatchOptions[]>(options as Required<ILengthUnitsPatchOptions>, {
    units: ['rpx'],
    overwrite: true,
  })
  const distPath = path.resolve(rootDir, 'dist')
  const list = fs.readdirSync(distPath)
  const chunks = list.filter(x => x.startsWith('chunk-'))
  const guessUnitStart = /\[\s*["']cm["'],\s*["']mm["'],[\w,"]+\]/
  let code
  let matches: RegExpMatchArray | null = null
  let guessFile: string | undefined
  for (const chunkName of chunks) {
    guessFile = path.join(distPath, chunkName)
    code = fs.readFileSync(guessFile, 'utf8')
    const res = guessUnitStart.exec(code)
    if (res) {
      matches = res
      break
    }
  }
  let hasPatched = false
  if (matches && code) {
    const match = matches[0]
    const ast = parse(match, {
      sourceType: 'unambiguous',
    })

    traverse(ast, {
      ArrayExpression(path) {
        for (const unit of opts.units) {
          if (path.node.elements.some(x => t.isStringLiteral(x) && x.value === unit)) {
            hasPatched = true
            break
          }
          path.node.elements.push(t.stringLiteral(unit))
        }
      },
    })
    if (hasPatched) {
      return {
        code,
        hasPatched,
      }
    }
    const { code: replacement } = generate(ast, {
      minified: true,
    })
    code = spliceChangesIntoString(code, [
      {
        start: matches.index as number,
        end: matches.index as number + match.length,
        replacement: replacement.endsWith(';') ? replacement.slice(0, -1) : replacement,
      },
    ])
    if (opts.overwrite && guessFile) {
      fs.writeFileSync(guessFile, code, {
        encoding: 'utf8',
      })
      logger.success('patch tailwindcss for custom length unit successfully!')
    }
  }

  return {
    code,
    hasPatched,
  }
  //  /\["cm","mm"/
}
