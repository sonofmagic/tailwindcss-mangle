import fs from 'node:fs'
import path from 'node:path'
import * as t from '@babel/types'
import type { ArrayExpression, StringLiteral } from '@babel/types'
import type { ILengthUnitsPatchDangerousOptions, ILengthUnitsPatchOptions } from './types'
import { generate, parse, traverse } from '@/babel'

function findAstNode(content: string, options: ILengthUnitsPatchOptions) {
  const DOPTS = options.dangerousOptions as Required<ILengthUnitsPatchDangerousOptions>
  const ast = parse(content)

  let arrayRef: ArrayExpression | undefined
  let changed = false
  traverse(ast, {
    Identifier(path) {
      if (
        path.node.name === DOPTS.variableName
        && t.isVariableDeclarator(path.parent)
        && t.isArrayExpression(path.parent.init)
      ) {
        arrayRef = path.parent.init
        const set = new Set(path.parent.init.elements.map(x => (<StringLiteral>x).value))
        for (let i = 0; i < options.units.length; i++) {
          const unit = options.units[i]
          if (!set.has(unit)) {
            path.parent.init.elements = path.parent.init.elements.map((x) => {
              if (t.isStringLiteral(x)) {
                return {
                  type: x?.type,
                  value: x?.value,
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

export function monkeyPatchForSupportingCustomUnit(rootDir: string, options: ILengthUnitsPatchOptions) {
  const { dangerousOptions } = options
  const DOPTS = dangerousOptions as Required<ILengthUnitsPatchDangerousOptions>
  const dataTypesFilePath = path.resolve(rootDir, DOPTS.lengthUnitsFilePath)
  const dataTypesFileContent = fs.readFileSync(dataTypesFilePath, {
    encoding: 'utf8',
  })
  const { arrayRef, changed } = findAstNode(dataTypesFileContent, options)
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
      if (DOPTS.overwrite) {
        fs.writeFileSync(DOPTS.destPath ?? dataTypesFilePath, newCode, {
          encoding: 'utf8',
        })
        console.log('patch tailwindcss for custom length unit successfully!')
      }
    }
    return code
  }
}
