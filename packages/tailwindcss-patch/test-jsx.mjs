import { parse } from '@babel/parser'

const code = '<div className="bg-red-500 text-white">Hello</div>'

console.log('Testing without jsx plugin:')
try {
  const ast1 = parse(code, { sourceType: 'module' })
  console.log('✓ Parsed without jsx plugin')
}
catch (e) {
  console.log('✗ Failed:', e.code || e.message.split('\n')[0])
}

console.log('\nTesting with jsx plugin:')
try {
  const ast2 = parse(code, { sourceType: 'module', plugins: ['jsx'] })
  console.log('✓ Parsed with jsx plugin')
  console.log('AST type:', ast2.program.body[0].type)
}
catch (e) {
  console.log('✗ Failed:', e.code || e.message.split('\n')[0])
}
