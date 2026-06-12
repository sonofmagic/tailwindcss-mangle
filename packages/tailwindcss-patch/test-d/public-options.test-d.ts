/// <reference path="./tsd-env.d.ts" />

import { expectAssignable, expectError, expectType } from 'tsd'
import {
  TailwindcssPatcher,
  defineConfig,
  generateCustomStyle,
  generateTailwindStyle,
  generateTailwindV3Style,
  generateTailwindV4Style,
  normalizeOptions,
  splitCandidateTokens,
  type ApplyOptions,
  type CacheOptions,
  type ExposeContextOptions,
  type ExtendLengthUnitsOptions,
  type ExtractOptions,
  type NormalizedTailwindCssPatchOptions,
  type TailwindCssOptions,
  type TailwindCssPatchOptions,
  type TailwindStyleGenerateOptions,
  type TailwindStyleGenerateResult,
  type TailwindStyleSource,
  type TailwindV3StyleGenerateOptions,
  type TailwindV3StyleGenerateResult,
  type TailwindV4CssSource,
  type TailwindV4GenerateOptions,
  type TailwindV4SourcePattern,
  type TailwindV4StyleGenerateOptions,
  type TailwindV4StyleGenerateResult,
  type TailwindV4StyleSource,
  type TailwindV2Options,
  type TailwindV3Options,
  type TailwindV4Options,
} from '..'

expectType<string[]>(splitCandidateTokens('before:content-["x"] text-red-500'))

const exposeContext: ExposeContextOptions = {
  refProperty: 'contextRef',
}

const extendLengthUnits: ExtendLengthUnitsOptions = {
  enabled: true,
  units: ['rpx'],
  overwrite: false,
}

const applyOptions: ApplyOptions = {
  overwrite: false,
  exposeContext,
  extendLengthUnits,
}

const extractOptions: ExtractOptions = {
  write: true,
  file: '.tw-patch/classes.txt',
  format: 'lines',
  pretty: false,
  removeUniversalSelector: false,
}

const cacheOptions: CacheOptions = {
  enabled: true,
  cwd: process.cwd(),
  dir: '.cache/tw-patch',
  file: 'classes.json',
  strategy: 'merge',
  driver: 'memory',
}

const v2Options: TailwindV2Options = {
  cwd: 'apps/legacy',
  config: 'tailwind.config.js',
}

const v3Options: TailwindV3Options = {
  cwd: 'apps/web',
  config: 'tailwind.config.ts',
  postcssPlugin: '@tailwindcss/postcss',
}

const v4Options: TailwindV4Options = {
  base: 'apps/web',
  css: '@import "tailwindcss";',
  cssSources: [
    {
      file: './src/app.css',
      css: '@import "tailwindcss";',
      dependencies: ['./src/theme.css'],
    },
  ],
  cssEntries: ['./src/app.css'],
  bareArbitraryValues: {
    units: ['%', 'px', 'rem'],
  },
  sources: [
    {
      base: 'apps/web',
      pattern: '**/*',
      negated: false,
    },
  ],
}

expectAssignable<TailwindV4CssSource[]>(v4Options.cssSources!)

const v4GenerateOptions: TailwindV4GenerateOptions = {
  bareArbitraryValues: true,
  scanSources: [
    {
      base: 'apps/web',
      pattern: '**/*.{html,tsx}',
      negated: false,
    },
  ],
}

expectAssignable<TailwindV4GenerateOptions['scanSources']>(v4GenerateOptions.scanSources)

const v4StyleSource: TailwindV4StyleSource = {
  file: 'pages/index.tsx',
  extension: 'tsx',
  content: '<view class="text-red-500"></view>',
}

const v4StyleOptions: TailwindV4StyleGenerateOptions = {
  css: '@import "tailwindcss";',
  candidates: ['text-red-500'],
  sources: [v4StyleSource],
  bareArbitraryValues: true,
}

expectAssignable<Promise<TailwindV4StyleGenerateResult>>(generateTailwindV4Style(v4StyleOptions))

const styleSource: TailwindStyleSource = {
  file: 'pages/index.wxml',
  extension: 'wxml',
  content: '<view class="text-red-500"></view>',
}

const v3StyleOptions: TailwindV3StyleGenerateOptions = {
  cwd: 'apps/web',
  packageName: 'tailwindcss',
  candidates: ['text-red-500'],
  sources: [styleSource],
  config: {
    theme: {
      extend: {},
    },
  },
  layers: ['utilities', 'variants'],
}

expectAssignable<Promise<TailwindV3StyleGenerateResult>>(generateTailwindV3Style(v3StyleOptions))

const customStyleResult = generateCustomStyle({
  candidates: ['text-red-500'],
  sources: [styleSource],
  generate(ctx) {
    expectType<Set<string>>(ctx.tokens)
    return [...ctx.tokens].join('\n')
  },
})

expectAssignable<Promise<{ version: 'custom', css: string, tokens: Set<string> }>>(customStyleResult)

const styleGenerateOptions: TailwindStyleGenerateOptions = {
  version: 3,
  candidates: ['text-red-500'],
}

expectAssignable<Promise<TailwindStyleGenerateResult>>(generateTailwindStyle(styleGenerateOptions))
expectAssignable<Promise<TailwindStyleGenerateResult>>(generateTailwindStyle({
  version: 4,
  css: '@import "tailwindcss";',
  candidates: ['text-red-500'],
}))
expectAssignable<Promise<TailwindStyleGenerateResult>>(generateTailwindStyle({
  version: 'custom',
  candidates: ['text-red-500'],
  generate: () => '.text-red-500{}',
}))

const sourcePattern: TailwindV4SourcePattern = {
  base: 'apps/web',
  pattern: '**/*',
  negated: false,
}

expectAssignable<TailwindV4SourcePattern>(sourcePattern)

const tailwindCssOptions: TailwindCssOptions = {
  packageName: 'tailwindcss',
  version: 4,
  v3: v3Options,
  v4: v4Options,
}

const patchOptions: TailwindCssPatchOptions = {
  projectRoot: process.cwd(),
  tailwindcss: tailwindCssOptions,
  apply: applyOptions,
  extract: extractOptions,
  cache: cacheOptions,
  filter: className => className.length > 0,
}

expectAssignable<TailwindCssPatchOptions>(patchOptions)
expectAssignable<TailwindCssOptions>({
  version: 3,
  cwd: 'apps/docs',
  config: 'tailwind.config.ts',
  v2: v2Options,
  v3: {
    config: 'tailwind.config.cjs',
    postcssPlugin: '@tailwindcss/postcss',
  },
  v4: v4Options,
})

const normalized = normalizeOptions({
  ...patchOptions,
  tailwindcss: {
    version: 4,
    v4: v4Options,
  },
})

expectType<NormalizedTailwindCssPatchOptions>(normalized)
expectType<'lines' | 'json'>(normalized.output.format)
expectType<boolean>(normalized.features.exposeContext.enabled)
expectType<string[]>(normalized.tailwind.v4!.cssEntries)
expectType<TailwindV4CssSource[]>(normalized.tailwind.v4!.cssSources)
expectType<'merge' | 'overwrite'>(normalized.cache.strategy)
expectType<'file' | 'memory' | 'noop'>(normalized.cache.driver)
expectType<(className: string) => boolean>(normalized.filter)

const defaults = normalizeOptions({
  cache: true,
  apply: {
    exposeContext: false,
    extendLengthUnits: false,
  },
  extract: {
    pretty: true,
  },
})

expectType<boolean>(defaults.cache.enabled)
expectType<number | false>(defaults.output.pretty)
expectType<boolean>(defaults.features.exposeContext.enabled)
expectAssignable<null | { enabled: boolean, units: string[] }>(defaults.features.extendLengthUnits)

const config = defineConfig({
  registry: {
    projectRoot: 'apps/web',
    extract: {
      file: '.tw-patch/tw-class-list.json',
      format: 'json',
    },
    tailwindcss: {
      version: 4,
      packageName: 'tailwindcss',
      v4: {
        cssEntries: ['./src/app.css'],
      },
    },
    apply: {
      overwrite: true,
    },
  },
  transformer: {
    disabled: false,
    registry: {
      file: '.tw-patch/tw-class-list.json',
    },
  },
})

expectAssignable<'json' | 'lines' | undefined>(config.registry?.extract?.format)
expectAssignable<2 | 3 | 4 | undefined>(config.registry?.tailwindcss?.version)
expectAssignable<string[] | undefined>(config.registry?.tailwindcss?.v4?.cssEntries)

new TailwindcssPatcher(patchOptions)
new TailwindcssPatcher({
  cache: false,
  tailwindcss: {
    version: 2,
    v2: {
      cwd: 'apps/legacy',
    },
  },
})
new TailwindcssPatcher({
  apply: {
    exposeContext: false,
    extendLengthUnits: false,
  },
  extract: {
    write: false,
    format: 'json',
  },
})

expectError(new TailwindcssPatcher({
  cwd: process.cwd(),
}))

expectError(new TailwindcssPatcher({
  output: {
    file: '.tw-patch/legacy.json',
  },
}))

expectError(new TailwindcssPatcher({
  features: {
    exposeContext: true,
  },
}))

expectError(new TailwindcssPatcher({
  tailwindcss: {
    package: 'tailwindcss',
  },
}))

expectError(new TailwindcssPatcher({
  tailwindcss: {
    next: {
      cssEntries: ['./src/app.css'],
    },
  },
}))

expectError(new TailwindcssPatcher({
  tailwindcss: {
    classic: {
      cwd: 'apps/web',
    },
  },
}))

expectError(new TailwindcssPatcher({
  tailwindcss: {
    legacy: {
      cwd: 'apps/web',
    },
  },
}))

expectError(defineConfig({
  registry: {
    output: {
      file: '.tw-patch/legacy.json',
    },
  },
}))

expectError(defineConfig({
  registry: {
    tailwind: {
      package: 'tailwindcss',
    },
  },
}))

expectError(defineConfig({
  registry: {
    tailwindcss: {
      package: 'tailwindcss',
    },
  },
}))

expectError(defineConfig({
  registry: {
    tailwindcss: {
      next: {
        cssEntries: ['./src/app.css'],
      },
    },
  },
}))

expectError(defineConfig({
  registry: {
    tailwindcss: {
      classic: {
        cwd: 'apps/web',
      },
    },
  },
}))

expectError(defineConfig({
  registry: {
    tailwindcss: {
      legacy: {
        cwd: 'apps/web',
      },
    },
  },
}))
