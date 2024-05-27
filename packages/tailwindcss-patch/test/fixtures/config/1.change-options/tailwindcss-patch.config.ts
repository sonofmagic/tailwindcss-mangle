import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  output: {
    filename: 'xxx/yyy/zzz.json',
    loose: false,
    removeUniversalSelector: false,
  },
  tailwindcss: {
    cwd: 'aaa/bbb/cc',
  },
})
