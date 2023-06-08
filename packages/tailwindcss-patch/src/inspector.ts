import * as t from '@babel/types'
import { parse, traverse, generate } from './babel'
// crash code

export function inspectProcessTailwindFeaturesReturnContext(content: string) {
  const ast = parse(content)
  let hasPatched = false
  traverse(ast, {
    FunctionDeclaration(p) {
      const n = p.node
      if (n.id?.name === 'processTailwindFeatures' && n.body.body.length === 1 && t.isReturnStatement(n.body.body[0])) {
        const rts = n.body.body[0]
        if (t.isFunctionExpression(rts.argument)) {
          const body = rts.argument.body.body
          const lastStatement = body.at(-1)
          hasPatched = t.isReturnStatement(lastStatement) && t.isIdentifier(lastStatement.argument) && lastStatement.argument.name === 'context'
          if (!hasPatched) {
            // return context;
            const rts = t.returnStatement(t.identifier('context'))
            body.push(rts)
          }
        }
      }
    }
  })

  return {
    code: hasPatched ? content : generate(ast).code,
    hasPatched
  }
}

export function inspectPostcssPlugin(content: string) {
  const ast = parse(content)
  const exportKey = 'contextRef'
  const variableName = 'contextRef'
  const valueKey = 'value'
  let hasPatched = false
  traverse(ast, {
    Program(p) {
      const n = p.node
      // find module.exports = function tailwindcss(configOrPath)
      const idx = n.body.findIndex((x) => {
        return (
          t.isExpressionStatement(x) &&
          t.isAssignmentExpression(x.expression) &&
          t.isMemberExpression(x.expression.left) &&
          t.isFunctionExpression(x.expression.right) &&
          x.expression.right.id?.name === 'tailwindcss'
        )
      })

      if (idx > -1) {
        const prevStatement = n.body[idx - 1]
        const lastStatement = n.body.at(-1)
        const hasPatchedCondition0 =
          prevStatement &&
          t.isVariableDeclaration(prevStatement) &&
          prevStatement.declarations.length === 1 &&
          t.isIdentifier(prevStatement.declarations[0].id) &&
          prevStatement.declarations[0].id.name === variableName
        const hasPatchedCondition1 =
          t.isExpressionStatement(lastStatement) &&
          t.isAssignmentExpression(lastStatement.expression) &&
          t.isIdentifier(lastStatement.expression.right) &&
          lastStatement.expression.right.name === variableName

        hasPatched = hasPatchedCondition0 || hasPatchedCondition1
        if (!hasPatched) {
          // const contextRef = {
          //   value: []
          // };
          const statement = t.variableDeclaration('const', [
            t.variableDeclarator(t.identifier(variableName), t.objectExpression([t.objectProperty(t.identifier(valueKey), t.arrayExpression())]))
          ])
          n.body.splice(idx, 0, statement)
          // module.exports.contextRef = contextRef;
          n.body.push(
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(t.memberExpression(t.identifier('module'), t.identifier('exports')), t.identifier(exportKey)),
                t.identifier(variableName)
              )
            )
          )
        }
      }
    },
    FunctionExpression(p) {
      if (hasPatched) {
        return
      }
      const n = p.node
      if (n.id?.name === 'tailwindcss' && n.body.body.length === 1 && t.isReturnStatement(n.body.body[0])) {
        const returnStatement = n.body.body[0]
        if (t.isObjectExpression(returnStatement.argument) && returnStatement.argument.properties.length === 2) {
          const properties = returnStatement.argument.properties
          if (t.isObjectProperty(properties[0]) && t.isObjectProperty(properties[1])) {
            const keyMatched = t.isIdentifier(properties[0].key) && properties[0].key.name === 'postcssPlugin'
            const pluginsMatched = t.isIdentifier(properties[1].key) && properties[1].key.name === 'plugins'
            if (
              pluginsMatched &&
              keyMatched &&
              t.isCallExpression(properties[1].value) &&
              t.isMemberExpression(properties[1].value.callee) &&
              t.isArrayExpression(properties[1].value.callee.object)
            ) {
              const pluginsCode = properties[1].value.callee.object.elements
              if (pluginsCode[1] && t.isFunctionExpression(pluginsCode[1])) {
                const targetBlockStatement = pluginsCode[1].body

                const lastStatement = targetBlockStatement.body.at(-1)
                if (t.isExpressionStatement(lastStatement)) {
                  // contextRef.value.push((0, _processTailwindFeatures.default)(context)(root, result));
                  const newExpressionStatement = t.expressionStatement(
                    t.callExpression(
                      t.memberExpression(
                        t.memberExpression(t.identifier(variableName), t.identifier('value')),

                        t.identifier('push')
                      ),

                      [lastStatement.expression]
                    )
                  )
                  targetBlockStatement.body[targetBlockStatement.body.length - 1] = newExpressionStatement
                }

                const ifIdx = targetBlockStatement.body.findIndex((x) => t.isIfStatement(x))
                if (ifIdx > -1) {
                  const ifRoot = <t.IfStatement>targetBlockStatement.body[ifIdx]
                  if (t.isBlockStatement(ifRoot.consequent) && ifRoot.consequent.body[1] && t.isForOfStatement(ifRoot.consequent.body[1])) {
                    const forOf: t.ForOfStatement = ifRoot.consequent.body[1]
                    if (t.isBlockStatement(forOf.body) && forOf.body.body.length === 1 && t.isIfStatement(forOf.body.body[0])) {
                      const if2: t.IfStatement = forOf.body.body[0]
                      if (t.isBlockStatement(if2.consequent) && if2.consequent.body.length === 1 && t.isExpressionStatement(if2.consequent.body[0])) {
                        const target = if2.consequent.body[0]
                        // contextRef.value.push((0, _processTailwindFeatures.default)(context)(root1, result));
                        const newExpressionStatement = t.expressionStatement(
                          t.callExpression(t.memberExpression(t.memberExpression(t.identifier(variableName), t.identifier('value')), t.identifier('push')), [target.expression])
                        )
                        if2.consequent.body[0] = newExpressionStatement
                      }
                    }
                  }
                }
                // clear contextRef.value
                targetBlockStatement.body.unshift(
                  // contentRef.value = []
                  // t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier(variableName), t.identifier(valueKey)), t.arrayExpression()))

                  // contentRef.value.length = 0
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      t.memberExpression(t.memberExpression(t.identifier(variableName), t.identifier(valueKey)), t.identifier('length')),
                      t.numericLiteral(0)
                    )
                  )
                )
              }
            }
          }
        }
      }
      // start = true
    }
    // BlockStatement(p) {
    //   const n = p.node
    //   if (start && p.parent.type === 'FunctionExpression' && !p.parent.id) {
    //     n.body.unshift(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier(variableName), t.identifier(valueKey)), t.arrayExpression())))
    //   }
    // }
  })
  return {
    code: hasPatched ? content : generate(ast).code,
    hasPatched
  }
}
