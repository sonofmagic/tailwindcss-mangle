import _babelTraverse from '@babel/traverse'

export { parse, parseExpression } from '@babel/parser'

function _interopDefaultCompat(e: any) {
  return e && typeof e === 'object' && 'default' in e ? e.default : e
}

export const traverse = _interopDefaultCompat(_babelTraverse) as typeof _babelTraverse
