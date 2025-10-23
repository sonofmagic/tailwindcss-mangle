import * as t from '@babel/types'
import { generate, parse, traverse } from '../../../babel'
import { ExposeContextTransformOptions } from './postcss-v3'

const IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i

function toIdentifierName(property: string) {
  if (!property) {
    return 'contextRef'
  }
  const sanitized = property.replace(/[^0-9A-Za-z_$]/g, '_')
  if (/^[0-9]/.test(sanitized)) {
    return `_${sanitized}`
  }
  return sanitized || 'contextRef'
}

function createExportsMember(property: string) {
  if (IDENTIFIER_RE.test(property)) {
    return t.memberExpression(t.identifier('exports'), t.identifier(property))
  }
  return t.memberExpression(t.identifier('exports'), t.stringLiteral(property), true)
}

export function transformProcessTailwindFeaturesReturnContextV2(content: string) {
  const ast = parse(content, {
    sourceType: 'unambiguous',
  })
  let hasPatched = false

  traverse(ast, {
    FunctionDeclaration(path) {
      const node = path.node
      if (
        node.id?.name === 'processTailwindFeatures'
        && node.body.body.length === 1
        && t.isReturnStatement(node.body.body[0])
      ) {
        const returnStatement = node.body.body[0]
        if (t.isFunctionExpression(returnStatement.argument)) {
          const body = returnStatement.argument.body.body
          const lastStatement = body[body.length - 1]
          hasPatched
            = t.isReturnStatement(lastStatement)
            && t.isIdentifier(lastStatement.argument)
            && lastStatement.argument.name === 'context'

          if (!hasPatched) {
            body.push(t.returnStatement(t.identifier('context')))
          }
        }
      }
    },
  })

  return {
    code: hasPatched ? content : generate(ast).code,
    hasPatched,
  }
}

export function transformPostcssPluginV2(content: string, options: ExposeContextTransformOptions) {
  const refIdentifier = t.identifier(toIdentifierName(options.refProperty))
  const exportMember = createExportsMember(options.refProperty)
  const valueMember = t.memberExpression(refIdentifier, t.identifier('value'))
  const ast = parse(content)

  let hasPatched = false

  traverse(ast, {
    Program(path) {
      const program = path.node
      const index = program.body.findIndex(statement => t.isFunctionDeclaration(statement) && statement.id?.name === '_default')

      if (index === -1) {
        return
      }

      const previous = program.body[index - 1]
      const beforePrevious = program.body[index - 2]

      const alreadyHasVariable
        = previous
          && t.isVariableDeclaration(previous)
          && previous.declarations.length === 1
          && t.isIdentifier(previous.declarations[0].id)
          && previous.declarations[0].id.name === refIdentifier.name

      const alreadyAssignsExports
        = beforePrevious
          && t.isExpressionStatement(beforePrevious)
          && t.isAssignmentExpression(beforePrevious.expression)
          && t.isMemberExpression(beforePrevious.expression.left)
          && t.isIdentifier(beforePrevious.expression.right)
          && beforePrevious.expression.right.name === refIdentifier.name
          && generate(beforePrevious.expression.left).code === generate(exportMember).code

      hasPatched = alreadyHasVariable && alreadyAssignsExports

      if (!alreadyHasVariable) {
        program.body.splice(
          index,
          0,
          t.variableDeclaration('var', [
            t.variableDeclarator(
              refIdentifier,
              t.objectExpression([
                t.objectProperty(t.identifier('value'), t.arrayExpression()),
              ]),
            ),
          ]),
          t.expressionStatement(
            t.assignmentExpression('=', exportMember, refIdentifier),
          ),
        )
      }
    },
    FunctionDeclaration(path) {
      if (hasPatched) {
        return
      }

      const fn = path.node
      if (fn.id?.name !== '_default') {
        return
      }

      if (fn.body.body.length !== 1 || !t.isReturnStatement(fn.body.body[0])) {
        return
      }

      const returnStatement = fn.body.body[0]
      if (
        !t.isCallExpression(returnStatement.argument)
        || !t.isMemberExpression(returnStatement.argument.callee)
        || !t.isArrayExpression(returnStatement.argument.callee.object)
      ) {
        return
      }

      const fnExpression = returnStatement.argument.callee.object.elements[1]
      if (!fnExpression || !t.isFunctionExpression(fnExpression)) {
        return
      }

      const block = fnExpression.body
      const statements = block.body

      if (t.isExpressionStatement(statements[0]) && t.isAssignmentExpression(statements[0].expression) && t.isNumericLiteral(statements[0].expression.right)) {
        hasPatched = true
        return
      }

      const lastStatement = statements[statements.length - 1]
      if (lastStatement && t.isExpressionStatement(lastStatement)) {
        statements[statements.length - 1] = t.expressionStatement(
          t.callExpression(
            t.memberExpression(valueMember, t.identifier('push')),
            [lastStatement.expression],
          ),
        )
      }

      const index = statements.findIndex(statement => t.isIfStatement(statement))
      if (index > -1) {
        const ifStatement = statements[index] as t.IfStatement
        if (
          t.isBlockStatement(ifStatement.consequent)
          && ifStatement.consequent.body[1]
          && t.isForOfStatement(ifStatement.consequent.body[1])
        ) {
          const forOf = ifStatement.consequent.body[1]
          if (t.isBlockStatement(forOf.body) && forOf.body.body.length === 1) {
            const nestedIf = forOf.body.body[0]
            if (
              nestedIf
              && t.isIfStatement(nestedIf)
              && t.isBlockStatement(nestedIf.consequent)
              && nestedIf.consequent.body.length === 1
              && t.isExpressionStatement(nestedIf.consequent.body[0])
            ) {
              nestedIf.consequent.body[0] = t.expressionStatement(
                t.callExpression(
                  t.memberExpression(valueMember, t.identifier('push')),
                  [nestedIf.consequent.body[0].expression],
                ),
              )
            }
          }
        }
      }

      statements.unshift(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(valueMember, t.identifier('length')),
            t.numericLiteral(0),
          ),
        ),
      )
    },
  })

  return {
    code: hasPatched ? content : generate(ast).code,
    hasPatched,
  }
}
