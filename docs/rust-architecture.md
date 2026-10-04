# Rust kernels and JavaScript interfaces

The npm packages retain their existing APIs. `@tailwindcss-mangle/native` owns the Rust implementation and the compiled artifacts. Package consumers install a binary with the npm package; only contributors need Cargo.

| Area                          | Rust responsibility                                                                                                                              | JavaScript boundary                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| JavaScript / TypeScript / JSX | Oxc parsing, syntax validation, literal traversal, preservation, escaping, replacement edits                                                     | Public handler options, custom naming callbacks, MagicString composition and maps                   |
| CSS                           | Rule and selector parsing, escaped class names, scoped selectors, preserved rule copies                                                          | Public PostCSS plugin adapter                                                                       |
| HTML                          | HTML5 tokenization, attribute spans, entity-safe class edits                                                                                     | Public handler and MagicString adapter                                                              |
| Vue / Svelte                  | Inner script, style, and class transformations                                                                                                   | Official framework compilers and AST lifecycle                                                      |
| Shared utilities              | Token splitting, default name generation, class filtering and escaping                                                                           | User RegExp and generic JavaScript callbacks                                                        |
| Engine                        | Candidate filtering, deduplication, source ranges, position reports, arbitrary values, source expansion, raw candidate LRU and file fingerprints | Existing Oxide scanner, Tailwind 2/3/4 compiler and plugin APIs, micromatch and host path semantics |
| Tailwind patching             | Oxc analysis, context exposure, length-unit patching and status analysis                                                                         | Installed-package discovery and patch file I/O                                                      |
| Configuration migration       | Object analysis, modern-option precedence, source edits, discovery, backup/restore and rollback writes                                           | CLI options, host path normalization, public result objects                                         |
| Cache                         | Schema normalization, indexes, memory state, context decisions, merging, clearing, serialization and fingerprints                                | Sync/async filesystem locks, atomic rename, logging, JavaScript value and locale semantics          |
| Build integrations            | Transformation kernels above                                                                                                                     | Vite, Rollup, Webpack, esbuild and Nuxt hooks                                                       |

This boundary avoids transferring ASTs or invoking JavaScript once per token. A native context retains replacement maps. The adapter compares the effective contents of the public replacement Map and generated-name records, including mutations made through Map.prototype and replacement of the Map. A module reports each used/preserved class once, in encounter order. Lazy custom callbacks use an ordered native literal/preservation plan so each callback sees the same live usage records and mutable maps as before. Normal initialized contexts already contain the names and need one transform call.

JS analysis can add preserved classes before a later CSS transform. That ordering remains serial. Parser byte offsets are converted to UTF-16 before being applied to MagicString; astral Unicode characters are covered by regression tests. Invalid JavaScript is returned unchanged. Oxc syntax validation includes early errors. Literal surrogate escapes remain valid JavaScript escapes instead of invalid UTF-8 output.

## Building and testing

```sh
rustup show active-toolchain
pnpm install --frozen-lockfile
pnpm build
pnpm lint:rust
pnpm test:native
pnpm test
```

The six existing Vitest library projects remain, with Rust tests in the native workspace. Babel and the old selector parser are development-time oracles, not runtime transformation backends. Tests compare behavior, preservation, source locations, callbacks, native mutations, and migration/patch idempotence. Filesystem regression tests cover rollback and preservation of existing cache data after write failures.

## ABI and distribution

N-API level 6 preserves the engine's Node 18.20 runtime requirement. Development tools still require Node 22.22.1. Rust 1.95.0 and Oxc 0.146.0 are pinned together; later Oxc releases require a newer compiler.

The portable loader pins `@napi-rs/wasm-runtime` to 1.1.6: the 1.2 line requires Node 20.19 or newer. Its emnapi peers are explicit production dependencies so Node 18 consumers can install with strict engine checks and use WASI without development dependencies.

The reusable native workflow produces macOS and Windows x64/arm64 binaries, Linux x64/arm64 glibc and musl binaries, and a portable Rust WASI backend for platforms without a matching binary. Release downloads the artifacts for the same commit and checks the complete set before packing. The WASI backend uses the same Rust algorithms; there is no alternate Babel implementation installed as a fallback.

Keep binary files out of Git. Do not run a real publish to validate distribution. `pnpm release:plan` inspects versioning, while the native artifact check validates the package payload before the release workflow invokes repoctl.

## Measuring performance

Measure warm kernel calls separately from whole builds, fresh-process startup, and browser-observed HMR. Include lazy source-map generation in JavaScript handler timings. Compare identical source and equivalent outputs, alternate baseline and native measurements, discard warmups, and retain samples rather than reporting only the best run.

Vite/Rolldown, Tailwind Oxide, and framework compilers already contain native code. Their existing benefit is not a Rust migration gain. A faster transform does not imply the same speedup for the entire build, and equivalent browser assets do not acquire a browser runtime speedup merely because the build kernel changed language.
