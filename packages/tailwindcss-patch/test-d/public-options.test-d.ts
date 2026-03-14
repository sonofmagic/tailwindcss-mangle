/// <reference path="./tsd-env.d.ts" />

import { expectAssignable, expectError, expectType } from 'tsd'
import {
  TailwindcssPatcher,
  defineConfig,
  normalizeOptions,
  type ApplyOptions,
  type CacheOptions,
  type ExposeContextOptions,
  type ExtendLengthUnitsOptions,
  type ExtractOptions,
  type NormalizedTailwindCssPatchOptions,
  type TailwindCssOptions,
  type TailwindCssPatchOptions,
  type TailwindV2V3Options,
  type TailwindV4Options,
} from '..'

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

const v3Options: TailwindV2V3Options = {
  cwd: 'apps/web',
  config: 'tailwind.config.ts',
  postcssPlugin: '@tailwindcss/postcss',
}

const v4Options: TailwindV4Options = {
  base: 'apps/web',
  css: '@import "tailwindcss";',
  cssEntries: ['./src/app.css'],
  sources: [
    {
      base: 'apps/web',
      pattern: '**/*',
      negated: false,
    },
  ],
}

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
  v2: {
    cwd: 'apps/legacy',
  },
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
