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
})
