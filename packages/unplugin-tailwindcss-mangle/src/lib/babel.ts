import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
// function _interopDefaultCompat(e) {
//   return e && typeof e === 'object' && 'default' in e ? e : { default: e }
// }
const generate = (_generate as any).default as typeof _generate

const traverse = (_traverse as any).default as typeof _traverse

export { generate, parse, traverse }
