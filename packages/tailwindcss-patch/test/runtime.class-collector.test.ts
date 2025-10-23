import { describe, expect, it } from 'vitest'
import { collectClassesFromContexts } from '@/runtime/class-collector'

function createContext(classes: string[]) {
  const map = new Map()
  for (const cls of classes) {
    map.set(cls, [])
  }
  return {
    classCache: map,
  } as any
}

describe('collectClassesFromContexts', () => {
  it('aggregates class names respecting the filter', () => {
    const contexts = [createContext(['text-lg', '*', 'font-bold'])]
    const filter = (className: string) => className !== '*'
    const result = collectClassesFromContexts(contexts as any, filter)
    expect(result.has('text-lg')).toBe(true)
    expect(result.has('*')).toBe(false)
  })
})
