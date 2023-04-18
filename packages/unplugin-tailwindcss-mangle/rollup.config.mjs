import { createRollupConfig, legacyOutputOptions } from '@icebreakers/rollup'
const isDev = process.env.NODE_ENV === 'development'
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
      ...legacyOutputOptions,
      dir: 'dist',
      format: 'cjs',
      exports: 'auto',
      interop: 'auto',
      // entryFileNames: '[name].cjs',
      // chunkFileNames: '[name]-[hash].cjs',
      sourcemap: isDev
    },
    {
      ...legacyOutputOptions,
      dir: 'dist',
      format: 'esm',
      interop: 'auto',
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name]-[hash].mjs',
      sourcemap: isDev
    }
  ]
})
