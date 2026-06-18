import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'style-candidates': 'src/style-candidates.ts',
    'style-generator': 'src/style-generator.ts',
    'types': 'src/types.ts',
    'extraction/candidate-extractor': 'src/extraction/candidate-extractor.ts',
    'extraction/split-candidate-tokens': 'src/extraction/split-candidate-tokens.ts',
    'v3/index': 'src/v3/index.ts',
    'v3/style-generator': 'src/v3/style-generator.ts',
    'v4/index': 'src/v4/index.ts',
    'v4/bare-arbitrary-values': 'src/v4/bare-arbitrary-values.ts',
    'v4/candidates': 'src/v4/candidates.ts',
    'v4/engine': 'src/v4/engine.ts',
    'v4/node-adapter': 'src/v4/node-adapter.ts',
    'v4/source': 'src/v4/source.ts',
    'v4/source-scan': 'src/v4/source-scan.ts',
    'v4/style-generator': 'src/v4/style-generator.ts',
    'v4/types': 'src/v4/types.ts',
  },
  shims: true,
  format: ['cjs', 'esm'],
  clean: true,
  dts: true,
  fixedExtension: false,
  deps: {
    skipNodeModulesBundle: true,
    neverBundle: ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide'],
  },
})
