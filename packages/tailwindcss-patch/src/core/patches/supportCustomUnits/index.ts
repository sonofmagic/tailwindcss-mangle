import path from 'node:path'
import fs from 'fs-extra'
import * as t from '@babel/types'
import type { ArrayExpression, StringLiteral } from '@babel/types'
import { defuOverrideArray } from '@/utils'
import type { ILengthUnitsPatchOptions } from '@/types'
import { generate, parse, traverse } from '@/babel'
import logger from '@/logger'

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
        for (let i = 0; i < units.length; i++) {
          const unit = units[i]
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

export function monkeyPatchForSupportingCustomUnit(rootDir: string, options?: Partial<ILengthUnitsPatchOptions>) {
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
