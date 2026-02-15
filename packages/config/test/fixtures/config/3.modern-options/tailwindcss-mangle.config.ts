import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    projectRoot: 'apps/demo-a',
    extract: {
      write: false,
      file: 'modern/classes.txt',
      format: 'lines',
      pretty: false,
      removeUniversalSelector: false,
    },
    apply: {
      overwrite: false,
      exposeContext: {
        refProperty: 'runtimeContexts',
      },
      extendLengthUnits: {
        units: ['rpx', 'vh'],
      },
    },
    tailwindcss: {
      packageName: 'tailwindcss-modern',
      version: 4,
      v4: {
        cssEntries: ['dist/tailwind.css'],
      },
    },
    cache: {
      enabled: true,
      dir: '.cache/modern',
      strategy: 'overwrite',
    },
  },
})
