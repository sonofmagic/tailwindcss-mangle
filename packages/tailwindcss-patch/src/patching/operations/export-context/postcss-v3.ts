import * as t from '@babel/types'
import { generate, parse, traverse } from '../../../babel'

export interface ExposeContextTransformOptions {
  refProperty: string
}

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

function toIdentifierName(property: string) {
  if (!property) {
    return 'contextRef'
  }
  const sanitized = property.replace(/[^\w$]/gu, '_')
  if (/^\d/.test(sanitized)) {
    return `_${sanitized}`
  }
  return sanitized || 'contextRef'
}

function createModuleExportsMember(property: string) {
  const object = t.memberExpression(t.identifier('module'), t.identifier('exports'))
  if (IDENTIFIER_RE.test(property)) {
    return t.memberExpression(object, t.identifier(property))
  }
  return t.memberExpression(object, t.stringLiteral(property), true)
}

export function transformProcessTailwindFeaturesReturnContext(content: string) {
  const ast = parse(content)
  let hasPatched = false

  traverse(ast, {
    FunctionDeclaration(path) {
      const node = path.node
      if (
        node.id?.name !== 'processTailwindFeatures'
        || node.body.body.length !== 1
      ) {
        return
      }

      const [returnStatement] = node.body.body
      if (
        !t.isReturnStatement(returnStatement)
        || !t.isFunctionExpression(returnStatement.argument)
      ) {
        return
      }

      const expression = returnStatement.argument
      const body = expression.body.body
      const lastStatement = body[body.length - 1]
      const alreadyReturnsContext = Boolean(
        t.isReturnStatement(lastStatement)
        && t.isIdentifier(lastStatement.argument)
        && lastStatement.argument.name === 'context',
      )

      hasPatched = alreadyReturnsContext
      if (!alreadyReturnsContext) {
        body.push(t.returnStatement(t.identifier('context')))
      }
    },
  })

  return {
    code: hasPatched ? content : generate(ast).code,
    hasPatched,
  }
}

export function transformPostcssPlugin(content: string, { refProperty }: ExposeContextTransformOptions) {
  const ast = parse(content)
  const refIdentifier = t.identifier(toIdentifierName(refProperty))
  const moduleExportsMember = createModuleExportsMember(refProperty)
  const valueMember = t.memberExpression(refIdentifier, t.identifier('value'))

  let hasPatched = false

  traverse(ast, {
    Program(path) {
      const program = path.node
      const index = program.body.findIndex((statement) => {
        return (
          t.isExpressionStatement(statement)
          && t.isAssignmentExpression(statement.expression)
          && t.isMemberExpression(statement.expression.left)
          && t.isFunctionExpression(statement.expression.right)
          && statement.expression.right.id?.name === 'tailwindcss'
        )
      })

      if (index === -1) {
        return
      }

      const previousStatement = program.body[index - 1]
      const lastStatement = program.body[program.body.length - 1]
      const alreadyHasVariable = Boolean(
        previousStatement
        && t.isVariableDeclaration(previousStatement)
        && previousStatement.declarations.length === 1
        && t.isIdentifier(previousStatement.declarations[0].id)
        && previousStatement.declarations[0].id.name === refIdentifier.name,
      )

      const alreadyAssignsModuleExports = Boolean(
        t.isExpressionStatement(lastStatement)
        && t.isAssignmentExpression(lastStatement.expression)
        && t.isMemberExpression(lastStatement.expression.left)
        && t.isIdentifier(lastStatement.expression.right)
        && lastStatement.expression.right.name === refIdentifier.name
        && generate(lastStatement.expression.left).code === generate(moduleExportsMember).code,
      )

      hasPatched = alreadyHasVariable && alreadyAssignsModuleExports

      if (!alreadyHasVariable) {
        program.body.splice(
          index,
          0,
          t.variableDeclaration('const', [
            t.variableDeclarator(
              refIdentifier,
              t.objectExpression([
                t.objectProperty(t.identifier('value'), t.arrayExpression()),
              ]),
            ),
          ]),
        )
      }

      if (!alreadyAssignsModuleExports) {
        program.body.push(
          t.expressionStatement(
            t.assignmentExpression('=', moduleExportsMember, refIdentifier),
          ),
        )
      }
    },
    FunctionExpression(path) {
      if (hasPatched) {
        return
      }
      const fn = path.node
      if (fn.id?.name !== 'tailwindcss' || fn.body.body.length !== 1) {
        return
      }

      const [returnStatement] = fn.body.body
      if (!returnStatement || !t.isReturnStatement(returnStatement) || !t.isObjectExpression(returnStatement.argument)) {
        return
      }

      const properties = returnStatement.argument.properties
      if (properties.length !== 2) {
        return
      }

      const pluginsProperty = properties.find(
        prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'plugins',
      )

      if (
        !pluginsProperty
        || !t.isObjectProperty(pluginsProperty)
        || !t.isCallExpression(pluginsProperty.value)
        || !t.isMemberExpression(pluginsProperty.value.callee)
        || !t.isArrayExpression(pluginsProperty.value.callee.object)
      ) {
        return
      }

      const pluginsArray = pluginsProperty.value.callee.object.elements

      const targetPlugin = pluginsArray[1]
      if (!targetPlugin || !t.isFunctionExpression(targetPlugin)) {
        return
      }

      const block = targetPlugin.body
      const statements = block.body
      const last = statements[statements.length - 1]

      if (
        last
        && t.isExpressionStatement(last)
      ) {
        statements[statements.length - 1] = t.expressionStatement(
          t.callExpression(
            t.memberExpression(valueMember, t.identifier('push')),
            [last.expression],
          ),
        )
      }

      const index = statements.findIndex(s => t.isIfStatement(s))
      if (index > -1) {
        const ifStatement = statements[index] as t.IfStatement
        if (t.isBlockStatement(ifStatement.consequent)) {
          const [, second] = ifStatement.consequent.body
          if (
            second
            && t.isForOfStatement(second)
            && t.isBlockStatement(second.body)
          ) {
            const bodyStatement = second.body.body[0]
            if (
              bodyStatement
              && t.isIfStatement(bodyStatement)
              && t.isBlockStatement(bodyStatement.consequent)
              && bodyStatement.consequent.body.length === 1
              && t.isExpressionStatement(bodyStatement.consequent.body[0])
            ) {
              bodyStatement.consequent.body[0] = t.expressionStatement(
                t.callExpression(
                  t.memberExpression(valueMember, t.identifier('push')),
                  [bodyStatement.consequent.body[0].expression],
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
