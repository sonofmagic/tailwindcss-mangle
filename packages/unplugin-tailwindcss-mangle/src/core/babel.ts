import babel from '@babel/core'
import { declare } from '@babel/helper-plugin-utils'
import MagicString from 'magic-string'
import { splitCode } from '@tailwindcss-mangle/shared'
interface Options {
  replaceMap: Map<string, string>
  magicString: MagicString
}

export const plugin = declare((api, options: Options) => {
  api.assertVersion(7)
  const { magicString, replaceMap } = options
  return {
    visitor: {
      StringLiteral: {
        enter(p) {
          const node = p.node
          let value = node.value
          const arr = splitCode(value)

          for (const str of arr) {
            if (replaceMap.has(str)) {
              const v = replaceMap.get(str)
              if (v) {
                value = value.replaceAll(str, v)
              }
            }
          }
          if (typeof node.start === 'number' && typeof node.end === 'number' && value) {
            magicString.update(node.start + 1, node.end - 1, value)
          }
        }
      }
    }
  }
})

export function processJs(options: { code: string; replaceMap: Map<string, string> }) {
  const { code, replaceMap } = options
  const magicString = new MagicString(code)
  babel.transformSync(code, {
    presets: [
      // ['@babel/preset-react', {}],
      [
        '@babel/preset-typescript',
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
          replaceMap
        }
      ]
    ]
  })
  return magicString.toString()
}
