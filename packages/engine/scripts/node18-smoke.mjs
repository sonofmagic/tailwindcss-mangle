import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const oxide = require('../node_modules/@tailwindcss/oxide')
const scanner = new oxide.Scanner({})
const oxideCandidates = scanner.getCandidatesWithPositions({
  content: '<div class="text-red-500 hover:bg-blue-500"></div>',
  extension: 'html',
}).map(item => item.candidate)

if (!oxideCandidates.includes('text-red-500') || !oxideCandidates.includes('hover:bg-blue-500')) {
  throw new Error(`Unexpected @tailwindcss/oxide candidates: ${oxideCandidates.join(', ')}`)
}

const engine = await import('../dist/index.js')
const { Parser } = await import('../dist/htmlparser2.js')
let sawClassAttribute = false
const parser = new Parser({
  onattribute(name, value) {
    sawClassAttribute ||= name === 'class' && value === 'text-red-500'
  },
})

parser.write('<div class="text-red-500"></div>')
parser.end()

if (!sawClassAttribute) {
  throw new Error('Unexpected htmlparser2 subpath export behavior')
}

const vueCandidates = await engine.extractSourceCandidatesWithPositions(
  '<template><div class="text-red-500 hover:bg-blue-500"></div></template>',
  'vue',
)
const vueCandidateSet = new Set(vueCandidates.map(item => item.rawCandidate))

if (!vueCandidateSet.has('text-red-500') || !vueCandidateSet.has('hover:bg-blue-500')) {
  throw new Error(`Unexpected engine Vue candidates: ${Array.from(vueCandidateSet).join(', ')}`)
}

console.log(`Node ${process.version} engine smoke passed`)
