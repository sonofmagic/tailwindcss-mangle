import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  patch: {
    output: {
      filename: 'xxx/yyy/zzz.json',
      loose: false,
      removeUniversalSelector: false
    },
    tailwindcss: {
      cwd: 'aaa/bbb/cc'
    }
  }
})