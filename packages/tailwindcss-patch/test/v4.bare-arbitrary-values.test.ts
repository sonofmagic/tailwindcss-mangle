import { describe, expect, it } from 'vitest'
import { resolveBareArbitraryValueCandidate } from '@/v4/bare-arbitrary-values'

describe('bare arbitrary value resolver', () => {
  it('resolves common UnoCSS-style bare arbitrary values', () => {
    expect(resolveBareArbitraryValueCandidate('p-10%', true)).toEqual({
      candidate: 'p-10%',
      canonicalCandidate: 'p-[10%]',
    })
    expect(resolveBareArbitraryValueCandidate('p-2.5px', true)).toEqual({
      candidate: 'p-2.5px',
      canonicalCandidate: 'p-[2.5px]',
    })
    expect(resolveBareArbitraryValueCandidate('m-4rem', true)).toEqual({
      candidate: 'm-4rem',
      canonicalCandidate: 'm-[4rem]',
    })
  })

  it('supports variants, negative values and important modifiers', () => {
    expect(resolveBareArbitraryValueCandidate('hover:!-mt-2rem', true)).toEqual({
      candidate: 'hover:!-mt-2rem',
      canonicalCandidate: 'hover:!-mt-[2rem]',
    })
    expect(resolveBareArbitraryValueCandidate('sm:-top-1.5rem', true)).toEqual({
      candidate: 'sm:-top-1.5rem',
      canonicalCandidate: 'sm:-top-[1.5rem]',
    })
  })

  it('supports hex colors and function values', () => {
    expect(resolveBareArbitraryValueCandidate('bg-#fff', true)).toEqual({
      candidate: 'bg-#fff',
      canonicalCandidate: 'bg-[#fff]',
    })
    expect(resolveBareArbitraryValueCandidate('text-rgb(255,0,0)', true)).toEqual({
      candidate: 'text-rgb(255,0,0)',
      canonicalCandidate: 'text-[rgb(255,0,0)]',
    })
    expect(resolveBareArbitraryValueCandidate('w-[calc(100%-1rem)]', true)).toBeUndefined()
    expect(resolveBareArbitraryValueCandidate('w-calc(100vh)', true)).toEqual({
      candidate: 'w-calc(100vh)',
      canonicalCandidate: 'w-[calc(100vh)]',
    })
  })

  it('rejects ambiguous or unsupported values', () => {
    expect(resolveBareArbitraryValueCandidate('p-4', true)).toBeUndefined()
    expect(resolveBareArbitraryValueCandidate('bg-red-500', true)).toBeUndefined()
    expect(resolveBareArbitraryValueCandidate('text-var(--brand)', true)).toEqual({
      candidate: 'text-var(--brand)',
      canonicalCandidate: 'text-[var(--brand)]',
    })
    expect(resolveBareArbitraryValueCandidate('w-calc(100%-1rem', true)).toBeUndefined()
  })

  it('respects custom unit allow lists', () => {
    expect(resolveBareArbitraryValueCandidate('p-10%', { units: ['px'] })).toBeUndefined()
    expect(resolveBareArbitraryValueCandidate('p-10px', { units: ['px'] })).toEqual({
      candidate: 'p-10px',
      canonicalCandidate: 'p-[10px]',
    })
  })
})
