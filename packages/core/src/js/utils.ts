import type babel from '@babel/core'
// const t = babel.types
export function getStringLiteralCalleeName(path: babel.NodePath<babel.types.StringLiteral>) {
  if (path.parentPath.isCallExpression()) {
    const callee = path.parentPath.get('callee')
    if (callee.isIdentifier()) {
      return callee.node.name
    }
  }
}

export function getTemplateElementCalleeName(path: babel.NodePath<babel.types.TemplateElement>) {
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
