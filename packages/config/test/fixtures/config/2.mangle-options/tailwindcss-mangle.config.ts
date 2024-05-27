import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  patch: {
    output: {
      filename: 'xxx/yyy/zzz.json',
      loose: false,
      removeUniversalSelector: false,
    },
    tailwindcss: {
      cwd: 'aaa/bbb/cc',
    },
  },
  mangle: {
    mangleClassFilter(className) {
      return true
    },
    classListPath: 'zzzzz.json',
    classGenerator: {
      log: true,
    },
    disabled: false,
    classMapOutput: {
      enable: true,
      loose: false,
      filename: 'ffff.json',
    },
  },
})
