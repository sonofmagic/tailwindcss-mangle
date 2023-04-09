import { createRollupConfig, legacyOutputOptions } from '@icebreakers/rollup'

export default createRollupConfig({
  input: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      ...legacyOutputOptions
    }
  ]
})
