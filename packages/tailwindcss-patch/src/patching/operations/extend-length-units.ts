import type { ArrayExpression, StringLiteral } from '@babel/types'
import type { NormalizedExtendLengthUnitsOptions } from '../../options/types'
import * as t from '@babel/types'
import fs from 'fs-extra'
import path from 'pathe'
import { generate, parse, traverse } from '../../babel'
import logger from '../../logger'
import { spliceChangesIntoString } from '../../utils'

interface FindArrayExpressionResult {
  arrayRef?: ArrayExpression
  changed: boolean
}

function updateLengthUnitsArray(content: string, options: NormalizedExtendLengthUnitsOptions): FindArrayExpressionResult {
  const { variableName = 'lengthUnits', units } = options
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
        const existing = new Set(
          path.parent.init.elements.map(element => (t.isStringLiteral(element) ? (element as StringLiteral).value : undefined)).filter(Boolean),
        )

        for (const unit of units) {
          if (!existing.has(unit)) {
            path.parent.init.elements = path.parent.init.elements.map((element) => {
              if (t.isStringLiteral(element)) {
                return t.stringLiteral(element.value)
              }
              return element
            })
            path.parent.init.elements.push(t.stringLiteral(unit))
            changed = true
          }
        }
      }
    },
  })

  return {
    ...(arrayRef === undefined ? {} : { arrayRef }),
    changed,
  }
}

export function applyExtendLengthUnitsPatchV3(rootDir: string, options: NormalizedExtendLengthUnitsOptions) {
  if (!options.enabled) {
    return { changed: false, code: undefined }
  }

  const opts: NormalisedV3Options = {
    ...options,
    lengthUnitsFilePath: options.lengthUnitsFilePath ?? 'lib/util/dataTypes.js',
    variableName: options.variableName ?? 'lengthUnits',
  }

  const dataTypesFilePath = path.resolve(rootDir, opts.lengthUnitsFilePath)
  const exists = fs.existsSync(dataTypesFilePath)

  if (!exists) {
    return { changed: false, code: undefined }
  }

  const content = fs.readFileSync(dataTypesFilePath, 'utf8')
  const { arrayRef, changed } = updateLengthUnitsArray(content, opts)

  if (!arrayRef || !changed) {
    return { changed: false, code: undefined }
  }

  const { code } = generate(arrayRef, {
    jsescOption: { quotes: 'single' },
  })

  if (arrayRef.start != null && arrayRef.end != null) {
    const nextCode = `${content.slice(0, arrayRef.start)}${code}${content.slice(arrayRef.end)}`
    if (opts.overwrite) {
      const target = opts.destPath ? path.resolve(opts.destPath) : dataTypesFilePath
      fs.writeFileSync(target, nextCode, 'utf8')
      logger.success('Patched Tailwind CSS length unit list (v3).')
    }

    return {
      changed: true,
      code: nextCode,
    }
  }

  return {
    changed: false,
    code: undefined,
  }
}

interface NormalisedV3Options extends NormalizedExtendLengthUnitsOptions {
  lengthUnitsFilePath: string
  variableName: string
}

interface V4FilePatch {
  file: string
  code: string
  hasPatched: boolean
}

interface V4Candidate extends V4FilePatch {
  match: RegExpExecArray
}

export function applyExtendLengthUnitsPatchV4(rootDir: string, options: NormalizedExtendLengthUnitsOptions) {
  if (!options.enabled) {
    return { files: [], changed: false }
  }

  const opts: NormalisedV4Options = { ...options }

  const distDir = path.resolve(rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    return { files: [], changed: false }
  }

  const entries = fs.readdirSync(distDir)
  const chunkNames = entries.filter(entry => entry.endsWith('.js') || entry.endsWith('.mjs'))
  const pattern = /\[\s*["']cm["'],\s*["']mm["'],[\w,"']+\]/

  const candidates = chunkNames.map((chunkName) => {
    const file = path.join(distDir, chunkName)
    const code = fs.readFileSync(file, 'utf8')
    const match = pattern.exec(code)
    if (!match) {
      return null
    }
    return {
      file,
      code,
      match,
      hasPatched: false,
    }
  }).filter((candidate): candidate is V4Candidate => candidate !== null)

  for (const item of candidates) {
    const { code, file, match } = item
    const ast = parse(match[0], { sourceType: 'unambiguous' })

    traverse(ast, {
      ArrayExpression(path) {
        for (const unit of opts.units) {
          if (path.node.elements.some(element => t.isStringLiteral(element) && element.value === unit)) {
            item.hasPatched = true
            return
          }
          path.node.elements.push(t.stringLiteral(unit))
        }
      },
    })

    if (item.hasPatched) {
      continue
    }

    const { code: replacement } = generate(ast, { minified: true })
    const start = match.index ?? 0
    const end = start + match[0].length
    item.code = spliceChangesIntoString(code, [
      {
        start,
        end,
        replacement: replacement.endsWith(';') ? replacement.slice(0, -1) : replacement,
      },
    ])

    if (opts.overwrite) {
      fs.writeFileSync(file, item.code, 'utf8')
    }
  }

  if (candidates.some(file => !file.hasPatched)) {
    logger.success('Patched Tailwind CSS length unit list (v4).')
  }

  return {
    changed: candidates.some(file => !file.hasPatched),
    files: candidates,
  }
}

interface NormalisedV4Options extends NormalizedExtendLengthUnitsOptions {}
