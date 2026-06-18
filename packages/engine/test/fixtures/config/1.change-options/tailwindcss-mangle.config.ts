import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    output: {
      file: 'xxx/yyy/zzz.json',
      pretty: false,
      stripUniversalSelector: false,
    },
    tailwind: {
      classic: {
        cwd: 'aaa/bbb/cc',
      },
    },
  },
})
