import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import tailwindcssPostcssV4 from '@tailwindcss/postcss'
import path from 'pathe'
import postcss from 'postcss'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTailwindV4Engine,
  resolveTailwindV4Source,
} from '@/v4'

const require = createRequire(import.meta.url)
const packageRoot = path.resolve(__dirname, '..')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))
const tailwindcssV4Root = path.dirname(require.resolve('tailwindcss-4/package.json'))
const tempDirs: string[] = []

const ORDER_CORPUS = [
  'before:block',
  'after:content-[\'tail\']',
  'first:flex',
  'last:grid',
  'odd:bg-red-500',
  'even:bg-blue-500',
  'disabled:opacity-50',
  'group-hover:block',
  'peer-focus:flex',
  'py-3',
  'p-1',
  'px-3',
  'hover:p-1',
  'focus:hover:p-3',
  'py-4!',
  'mt-2!',
  '-translate-y-1',
  'rtl:flex',
  'dark:flex',
  'starting:flex',
  'not-hover:flex',
  'motion-safe:animate-pulse',
  'motion-reduce:transition-none',
  'md:grid-cols-3',
  'sm:w-4',
  'max-lg:p-2',
  'bg-red-500',
  'bg-blue-500',
  'bg-[rgb(12,34,56)]',
  'bg-[var(--primary-color)]',
  'text-sm',
  'text-lg',
  'text-[55rpx]',
  'font-bold',
  'underline',
  'flex',
  'grid',
  'grid-cols-[200rpx_minmax(900rpx,_1fr)_100rpx]',
  'w-[123px]',
  'w-[calc(100%_-_12px)]',
  'text-[#123456]',
  'before:content-[\'x\']',
  'first-letter:text-red-500',
  'aria-[expanded=true]:max-h-[32rem]',
  'data-[state=open]:opacity-100',
  'supports-[display:grid]:grid',
  '[@supports(display:grid)]:grid',
  'max-[712px]:p-[13px]',
  '[--fg:#fff]',
  '[color:var(--fg)]',
]

function normalizeCss(css: string) {
  return css.replace(/\r\n/g, '\n').trim()
}

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-v4-order-parity-'))
  tempDirs.push(tempDir)
  return tempDir
}

async function createFixtureRoot() {
  const root = await createTempDir()
  const nodeModulesDir = path.join(root, 'node_modules')
  await fs.mkdir(nodeModulesDir, { recursive: true })
  await fs.symlink(tailwindcssV4Root, path.join(nodeModulesDir, 'tailwindcss'), 'dir')
  return root
}

function createCss(candidates: string[]) {
  return [
    '@import "tailwindcss" source(none);',
    `@source inline(${JSON.stringify(candidates.join(' '))});`,
    '',
  ].join('\n')
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })))
})

describe('Tailwind v4 engine order parity', () => {
  it('keeps generated CSS order and content identical to official Tailwind CSS v4', async () => {
    const tempDir = await createFixtureRoot()
    const css = createCss(ORDER_CORPUS)
    const cssEntry = path.join(tempDir, 'app.css')

    const official = await postcss([
      tailwindcssPostcssV4({
        optimize: false,
      }),
    ]).process(css, {
      from: cssEntry,
    })
    const source = await resolveTailwindV4Source({
      projectRoot: packageRoot,
      base: tailwindNodeBase,
      css,
    })
    const result = await createTailwindV4Engine(source).generate({
      candidates: [...ORDER_CORPUS].reverse(),
    })

    expect(result.classSet).toEqual(new Set(ORDER_CORPUS))
    expect(normalizeCss(result.css)).toBe(normalizeCss(official.css))
  })
})
