import type { RegistryOptions, TailwindcssMangleConfig, TransformerOptions } from './types'
import process from 'node:process'
import { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'
import { CSS_LANGS_RE } from 'is-css-request'
// /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
const defaultPipelineInclude = [
  /\.(html|js|cjs|mjs|ts|cts|mts|jsx|tsx|vue|svelte|astro|elm|php|phtml|mdx|md)(?:$|\?)/,
  CSS_LANGS_RE,
]

const defaultPipelineExclude: string[] = []

export function getDefaultRegistryConfig(): RegistryOptions {
  return {
    output: {
      file: '.tw-patch/tw-class-list.json',
      stripUniversalSelector: true,
      pretty: true,
    },
    tailwind: {},
  }
}

export function getDefaultTransformerConfig(): TransformerOptions {
  return {
    filter: defaultMangleClassFilter,
    sources: {
      include: defaultPipelineInclude,
      exclude: defaultPipelineExclude,
    },
    disabled: process.env['NODE_ENV'] === 'development',
    registry: {
      file: '.tw-patch/tw-class-list.json',
      mapping: {
        enabled: false,
        file: '.tw-patch/tw-map-list.json',
        loose: true,
      },
    },
    preserve: {
      functions: [],
      classes: [],
    },
  }
}

export function getDefaultUserConfig(): TailwindcssMangleConfig {
  return {
    registry: getDefaultRegistryConfig(),
    transformer: getDefaultTransformerConfig(),
  }
}
