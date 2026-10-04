// Development-only Babel oracle. Production transforms must never import Babel.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(root, 'packages/core/package.json'))
const { parse } = require('@babel/parser')
const { default: traverse } = require('@babel/traverse')
const { default: MagicString } = require('magic-string')

const { NativeContext } = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'packages/native/index.cjs'))

function split(raw, splitQuote = true) {
  return raw.split(splitQuote ? /[\s"]+/ : /\s+/).filter(value => /[\w\u00A0-\uFFFF%&'()*+,./:;<=>?-]/.test(value))
}

function escapedRegex(value) {
  return value.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&').replaceAll('-', '\\x2d')
}

function escapedJs(value) {
  return value.replaceAll(/[\n\r"'\\\u2028\u2029]/g, value => ({ '\n': '\\n', '\r': '\\r', '\u2028': '\\u2028', '\u2029': '\\u2029' })[value] ?? `\\${value}`)
}

function oracle(source, replacements, preserveFunctions, splitQuote) {
  let ast
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] })
  }
  catch {
    return { code: source, used: [], preserved: [], valid: false }
  }
  const ms = new MagicString(source)
  const used = new Set()
  const preserved = new Set()
  function handle(raw, node, offset, escape) {
    let output = raw
    for (const token of split(raw, splitQuote)) {
      if (!replacements.has(token) || node.leadingComments?.some(comment => comment.value.includes('tw-mangle') && comment.value.includes('ignore'))) {
        continue
      }
      output = output.replace(new RegExp(`(?<=^|[\\s"])${escapedRegex(token)}(?=$|[\\s"])`, 'g'), replacements.get(token))
      used.add(token)
    }
    if (raw !== output && node.start + offset < node.end - offset) {
      ms.update(node.start + offset, node.end - offset, escape ? escapedJs(output) : output)
    }
  }
  traverse(ast, {
    StringLiteral(p) { handle(p.node.value, p.node, 1, true) },
    TemplateElement(p) {
      const template = p.parentPath
      if (template.isTemplateLiteral() && template.parentPath.isTaggedTemplateExpression() && template.parentPath.get('tag').isIdentifier({ name: 'twIgnore' })) {
        split(p.node.value.raw, splitQuote).forEach(value => preserved.add(value))
      }
      else {
        handle(p.node.value.raw, p.node, 0, false)
      }
    },
    CallExpression(p) {
      if (p.get('callee').isIdentifier() && preserveFunctions.includes(p.node.callee.name)) {
        function collect(raw) {
          split(raw).sort((a, b) => b.length - a.length).forEach(value => replacements.has(value) && preserved.add(value))
        }
        p.traverse({
          StringLiteral(p) { collect(p.node.value) },
          TemplateElement(p) { collect(p.node.value.raw) },
        })
      }
    },
  })
  return { code: ms.toString(), used: [...used], preserved: [...preserved], valid: true }
}

function nativeTransform(source, context, preserveFunctions, splitQuote) {
  const result = context.transformJs(source, preserveFunctions, splitQuote)
  const ms = new MagicString(source)
  for (const edit of result.edits) {
    ms.update(edit.start, edit.end, edit.content)
  }
  return { code: ms.toString(), used: [...new Set(result.used)], preserved: [...new Set(result.preserved)], valid: result.valid }
}

function safeSurrogateSource(value) {
  // Rust emits lone UTF-16 surrogates as JS escapes. Babel previously emitted
  // literal surrogate code units; both evaluate to the same JS string, while
  // the explicit escape survives UTF-8 files and N-API transport losslessly.
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, value => `\\u${value.charCodeAt(0).toString(16)}`)
}

let seed = 19061996
function pick(values) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return values[seed % values.length]
}
const literals = [JSON.stringify('p-1 p-2'), '\'p\\x2d1\'', '\'p-1 \\ud800\'', JSON.stringify('😀 p-3'), JSON.stringify('p-1\uFEFFp-2'), JSON.stringify('class="p-2"'), JSON.stringify('bg-red-500/50 bg-red-500')]
function expression(depth) {
  if (!depth) {
    return pick(literals)
  }
  const inner = expression(depth - 1)
  return pick([
    `cn(${inner}, 'p-3')`,
    `other({ 'p-1': ${inner} })`,
    `(/* tw-mangle ignore */ ${inner})`,
    `twIgnore\`p-2 \${${inner}} p-1\``,
    `tag\`p-1 \${${inner}} p-3\``,
    `<div className="p-1" data-value={${inner}}/>`,
    `${inner} as string`,
  ])
}

const cases = [
  '\'p-1\'; const x = \'p-2\';',
  'function f(){\'use server\'; return \'p-1\'}',
  'const x = { /* tw-mangle ignore */ \'p-1\': /* tw-mangle ignore */ \'p-2\' };',
  'const x = /* tw-mangle ignore */ (\'p-1\');',
  'foo(); /* tw-mangle ignore */ (\'p-1\');',
  'const x = (/* tw-mangle ignore */ \'p-1\' + \'p-2\');',
  'type T = /* tw-mangle ignore */ \'p-1\';',
  'export { missing }; const x = \'p-1\';',
  'let x; let x; const y = \'p-1\';',
  'class A { f() { return this.#missing + \'p-1\' } }',
  'const value = \'p-2 \\ud800\';',
  'cn?.(\'p-1\'); cn(\'p-2\')?.value;',
  'export type T = \'p-1\';',
  'interface Props { name: \'p-1\' }; export type { Props };',
]
for (let i = 0; i < 200; i++) {
  cases.push(`const value${i} = ${expression(3)};`)
}
const fixtures = path.join(root, 'packages/core/test/fixtures')
for (const filename of fs.readdirSync(fixtures)) {
  if (/\.(?:js|jsx|ts|tsx)$/.test(filename)) {
    cases.push(fs.readFileSync(path.join(fixtures, filename), 'utf8'))
  }
}

const failures = []
for (const custom of [false, true]) {
  const replacements = new Map([
    ['p-1', custom ? 'p-2' : 'tw-a'],
    ['p-2', custom ? 'tw-"quote\\path\n\uFFFDnext' : 'tw-b'],
    ['p-3', 'tw-c'],
    ['bg-red-500/50', 'tw-d'],
    ['bg-red-500', 'tw-e'],
  ])
  const context = new NativeContext()
  context.reset([...replacements].map(([original, replacement]) => ({ original, replacement })), [])
  for (const splitQuote of [false, true]) {
    for (const source of cases) {
      const expected = oracle(source, replacements, ['cn'], splitQuote)
      const actual = nativeTransform(source, context, ['cn'], splitQuote)
      expected.code = safeSurrogateSource(expected.code)
      try {
        assert.deepEqual(actual, expected)
      }
      catch {
        failures.push({ source: source.slice(0, 700), custom, splitQuote, expected, actual })
      }
    }
  }
}
process.stdout.write(`${JSON.stringify({ cases: cases.length * 4, failures: failures.length, examples: failures.slice(0, 8) }, null, 2)}\n`)
if (failures.length) {
  process.exitCode = 1
}
