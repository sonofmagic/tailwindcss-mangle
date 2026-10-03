import type { NodePath } from '@babel/traverse'
import type { StringLiteral, TemplateElement } from '@babel/types'

export function getStringLiteralCalleeName(path: NodePath<StringLiteral>) {
  if (path.parentPath.isCallExpression()) {
    const callee = path.parentPath.get('callee')
    if (callee.isIdentifier()) {
      return callee.node.name
    }
  }
}

export function getTemplateElementCalleeName(path: NodePath<TemplateElement>) {
  if (path.parentPath.isTemplateLiteral()) {
    const pp = path.parentPath
    if (pp.parentPath.isCallExpression()) {
      const callee = pp.parentPath.get('callee')
      if (callee.isIdentifier()) {
        return callee.node.name
      }
    }
  }
}
