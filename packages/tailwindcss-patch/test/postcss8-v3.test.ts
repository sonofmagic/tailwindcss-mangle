import type { Config } from 'tailwindcss'
import path from 'pathe'
import { TailwindcssPatcher } from '@/core/patcher'
import { processTailwindcss } from '@/core/postcss'
import postcss from 'postcss'
import { appRoot } from './utils'

describe('postcss', () => {
  it('getCss 0.common', async () => {
    const p = path.resolve(appRoot, '0.common')
    const twPatcher = new TailwindcssPatcher()
    const res = await processTailwindcss({
      cwd: p,
    })
    expect(res.css).toMatchSnapshot()
    const res0 = twPatcher.getContexts()
    expect(res0.length).toBe(1)
    const set = twPatcher.getClassSet({
      removeUniversalSelector: false,
    })
    expect(set.size).toBe(4)
  })

  it('rpx case 0', async () => {
    const config: Config = {
      content: [
        'p-[0.32rpx]',
        'm-[23.43rpx]',
        'space-y-[12.0rpx]',
        'w-[12rpx]',
        'min-w-[12rpx]',
        'max-w-[12rpx]',
        'h-[12rpx]',
        'min-h-[12rpx]',
        'max-h-[12rpx]',
        'basis-[32rpx]',
        'text-[length:32rpx]',
      ].map((x) => {
        return {
          raw: x,
        }
      }),
      corePlugins: {
        preflight: false,
      },
    }
    const { css } = await postcss([
      // eslint-disable-next-line ts/no-require-imports
      require('tailwindcss')({
        config,
      }),
    ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
      from: undefined,
    })

    expect(css).toMatchSnapshot()
  })
})
