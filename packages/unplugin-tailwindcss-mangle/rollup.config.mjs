import { createRollupConfig, legacyOutputOptions } from '@icebreakers/rollup'

export default createRollupConfig({
  input: {
    index: 'src/index.ts',
    esbuild: 'src/esbuild.ts',
    nuxt: 'src/nuxt.ts',
    rollup: 'src/rollup.ts',
    vite: 'src/vite.ts',
    webpack: 'src/webpack.ts'
  },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: '[name]-[hash].cjs',
      ...legacyOutputOptions
    },
    {
      dir: 'dist',
      format: 'esm',
      ...legacyOutputOptions
    }
  ]
})