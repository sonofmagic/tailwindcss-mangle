# tailwindcss-mangle

![star](https://badgen.net/github/stars/sonofmagic/tailwindcss-mangle)
![dm0](https://badgen.net/npm/dm/@tailwindcss-mangle/core)
![dm1](https://badgen.net/npm/dm/@tailwindcss-mangle/shared)
![dm2](https://badgen.net/npm/dm/tailwindcss-patch)
![dm3](https://badgen.net/npm/dm/unplugin-tailwindcss-mangle)
[![test](https://github.com/sonofmagic/tailwindcss-mangle/actions/workflows/test.yml/badge.svg?branch=dev)](https://github.com/sonofmagic/tailwindcss-mangle/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/sonofmagic/tailwindcss-mangle/branch/main/graph/badge.svg?token=jPyNihT78U)](https://codecov.io/gh/sonofmagic/tailwindcss-mangle)

A util for mangle tailwindcss

- [tailwindcss-mangle](#tailwindcss-mangle)
  - [tailwindcss-patch](#tailwindcss-patch)
  - [unplugin-tailwindcss-mangle](#unplugin-tailwindcss-mangle)

## tailwindcss-patch

`tailwindcss-patch` is a util to patch tailwindcss code and get its context at runtime.

Click [tailwindcss-patch](./packages/tailwindcss-patch) for more details.

## unplugin-tailwindcss-mangle

> It is recommended to read the documentation of [tailwindcss-patch](https://github.com/sonofmagic/tailwindcss-mangle/tree/main/packages/tailwindcss-patch) first, `unplugin-tailwindcss-mangle` depends on this tool.

`unplugin-tailwindcss-mangle` is a plugin for `webpack` and `vite` to **obfuscate** tailwindcss class.

You can enter [unplugin-tailwindcss-mangle](./packages/unplugin-tailwindcss-mangle) for usage and more details.

### NextJs

For users trying version `2.3.0` of `unplugin-tailwindcss-mangle`, it has been tested and confirmed to work in versions `14~15`. However, be aware that this package is no longer maintained, as the project is  focused on `vitejs`.
