import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    output: {
      file: 'xxx/yyy/zzz.json',
      pretty: false,
      stripUniversalSelector: false,
    },
    tailwind: {
      cwd: 'aaa/bbb/cc',
    },
  },
  transformer: {
    filter(className) {
      return true
    },
    registry: {
      file: 'zzzzz.json',
      mapping: {
        enabled: true,
        loose: false,
        file: 'ffff.json',
      },
    },
    generator: {
      log: true,
    },
    disabled: false,
  },
})
