import { createRollupConfig, legacyOutputOptions } from '@icebreakers/rollup'
const isDev = process.env.NODE_ENV === 'development'
export default createRollupConfig({
  input: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: isDev,
      ...legacyOutputOptions
    }
  ]
})
