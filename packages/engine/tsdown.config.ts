import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'htmlparser2': 'src/htmlparser2.ts',
    'htmlparser2/WritableStream': 'src/htmlparser2-writable-stream.ts',
    'htmlparser2/WebWritableStream': 'src/htmlparser2-web-writable-stream.ts',
    'v3/index': 'src/v3/index.ts',
    'v4/index': 'src/v4/index.ts',
  },
  shims: true,
  format: ['cjs', 'esm'],
  target: 'node18',
  clean: true,
  dts: true,
  fixedExtension: false,
  deps: {
    alwaysBundle: ['htmlparser2'],
    neverBundle: ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide'],
  },
})
