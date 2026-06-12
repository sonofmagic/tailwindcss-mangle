import { createRequire } from 'node:module'
import path from 'pathe'
import postcss from 'postcss'
import tailwindcss3 from 'tailwindcss-3'
import { describe, expect, it, vi } from 'vitest'
import {
  collectTailwindStyleCandidates,
  escapeCssClassName,
  generateCustomStyle,
  generateTailwindStyle,
  generateTailwindV3Style,
} from '@/public-api'

const require = createRequire(import.meta.url)
const packageRoot = path.resolve(__dirname, '..')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))

describe('Tailwind style generator', () => {
  it('collects candidates for all style generation engines', async () => {
    const candidates = await collectTailwindStyleCandidates({
      bareArbitraryValues: true,
      candidates: ['text-red-500'],
      sources: [
        {
          content: '<view class="min-h-screen rounded-[18px] p-10%"></view>',
          extension: 'tsx',
        },
        {
          content: '.primary { @apply inline-flex items-center; }',
          extension: 'css',
        },
      ],
    })

    expect(candidates).toEqual(new Set([
      'text-red-500',
      'min-h-screen',
      'rounded-[18px]',
      'p-10%',
      'inline-flex',
      'items-center',
    ]))
  })

  it('generates Tailwind v3 css with Tailwind v3 internal JIT engine', async () => {
    const result = await generateTailwindV3Style({
      cwd: packageRoot,
      packageName: 'tailwindcss-3',
      candidates: ['text-red-500', 'not-a-real-class'],
      sources: [
        {
          content: '<view class="min-h-screen rounded-[18px] hover:bg-blue-500"></view>',
          extension: 'wxml',
        },
      ],
      config: {
        corePlugins: {
          preflight: false,
        },
      },
    })

    expect(result.version).toBe(3)
    expect(result.tokens).toEqual(new Set([
      'text-red-500',
      'not-a-real-class',
      'min-h-screen',
      'rounded-[18px]',
      'hover:bg-blue-500',
    ]))
    expect(result.classSet).toEqual(new Set([
      'text-red-500',
      'min-h-screen',
      'rounded-[18px]',
      'hover:bg-blue-500',
    ]))
    expect(result.css).toContain('.min-h-screen')
    expect(result.css).toContain('.rounded-\\[18px\\]')
    expect(result.css).toContain('.text-red-500')
    expect(result.css).toContain('.hover\\:bg-blue-500:hover')
    expect(result.css).not.toContain('not-a-real-class')
  })

  it('matches Tailwind v3 PostCSS output while using the internal engine path', async () => {
    const candidates = [
      'rounded-[18px]',
      'text-red-500',
      'hover:bg-blue-500',
    ]
    const internal = await generateTailwindV3Style({
      cwd: packageRoot,
      packageName: 'tailwindcss-3',
      candidates,
      config: {
        corePlugins: {
          preflight: false,
        },
      },
    })
    const postcssResult = await postcss([
      tailwindcss3({
        content: [
          {
            raw: candidates.join(' '),
            extension: 'html',
          },
        ],
        corePlugins: {
          preflight: false,
        },
      }),
    ]).process('@tailwind utilities;', {
      from: undefined,
    })

    expect(internal.css).toBe(postcssResult.css)
  })

  it('routes Tailwind v3 and v4 through the unified generator', async () => {
    const v3 = await generateTailwindStyle({
      version: 3,
      cwd: packageRoot,
      packageName: 'tailwindcss-3',
      candidates: ['text-red-500'],
    })
    const v4 = await generateTailwindStyle({
      version: 4,
      projectRoot: packageRoot,
      cwd: packageRoot,
      base: tailwindNodeBase,
      css: '@import "tailwindcss";',
      candidates: ['text-red-500'],
    })

    expect(v3.version).toBe(3)
    expect(v3.css).toContain('.text-red-500')
    expect(v4.version).toBe(4)
    expect(v4.css).toContain('.text-red-500')
  })

  it('lets callers fully customize css generation', async () => {
    const generate = vi.fn(({ tokens }: { tokens: Set<string> }) => {
      return [...tokens]
        .sort()
        .map(token => `.${escapeCssClassName(token)}{--tw-patch-token:"${token}"}`)
        .join('\n')
    })

    const result = await generateCustomStyle({
      candidates: ['text-red-500'],
      sources: [
        {
          content: '<view class="rounded-[18px]"></view>',
          extension: 'wxml',
        },
      ],
      generate,
    })

    expect(generate).toHaveBeenCalledOnce()
    expect(result.version).toBe('custom')
    expect(result.tokens).toEqual(new Set(['text-red-500', 'rounded-[18px]']))
    expect(result.classSet).toEqual(result.tokens)
    expect(result.css).toBe([
      '.rounded-\\[18px\\]{--tw-patch-token:"rounded-[18px]"}',
      '.text-red-500{--tw-patch-token:"text-red-500"}',
    ].join('\n'))
  })
})
