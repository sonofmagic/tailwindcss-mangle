import babel from '@babel/core'
import { declare } from '@babel/helper-plugin-utils'
import MagicString from 'magic-string'
import { splitCode } from '@tailwindcss-mangle/shared'
import { sort } from 'fast-sort'
interface Options {
  replaceMap: Map<string, string>
  magicString: MagicString
  id: string
  addToUsedBy: (key: string, file: string) => void
}

export function handleValue(options: { raw: string; node: babel.types.StringLiteral | babel.types.TemplateElement; offset: number } & Options) {
  const { addToUsedBy, id, magicString, node, raw, replaceMap, offset = 0 } = options
  let value = raw
  const arr = sort(splitCode(value)).desc((x) => x.length)

  for (const str of arr) {
    if (replaceMap.has(str)) {
      addToUsedBy(str, id)
      const v = replaceMap.get(str)
      if (v) {
        value = value.replaceAll(str, v)
      }
    }
  }
  if (typeof node.start === 'number' && typeof node.end === 'number' && value) {
    magicString.update(node.start + offset, node.end - offset, value)
  }
}

export const plugin = declare((api, options: Options) => {
  api.assertVersion(7)
  const { magicString, replaceMap, id, addToUsedBy } = options
  return {
    visitor: {
      StringLiteral: {
        enter(p) {
          const node = p.node
          handleValue({
            addToUsedBy,
            id,
            magicString,
            node,
            raw: node.value,
            replaceMap,
            offset: 1
          })
        }
      },
      TemplateElement: {
        enter(p) {
          const node = p.node
          handleValue({
            addToUsedBy,
            id,
            magicString,
            node,
            raw: node.value.raw,
            replaceMap,
            offset: 0
          })
        }
      }
    }
  }
})

export function preProcessJs(options: { code: string; replaceMap: Map<string, string>; id: string; addToUsedBy: (key: string, file: string) => void }) {
  const { code, replaceMap, id, addToUsedBy } = options
  const magicString = new MagicString(code)
  babel.transformSync(code, {
    presets: [
      // ['@babel/preset-react', {}],
      [
        require('@babel/preset-typescript'),
        {
          allExtensions: true,
          isTSX: true
        }
      ]
    ],
    plugins: [
      [
        plugin,
        {
          magicString,
          replaceMap,
          id,
          addToUsedBy
        }
      ]
    ],
    filename: id
  })
  return magicString.toString()
}
