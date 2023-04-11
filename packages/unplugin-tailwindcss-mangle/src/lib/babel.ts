import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

const generate = (_generate as any).default as typeof _generate

const traverse = (_traverse as any).default as typeof _traverse

export { generate, parse, traverse }
