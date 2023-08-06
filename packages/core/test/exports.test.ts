import { ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler } from '@/index'

describe('exports', () => {
  it('exports should be defined', () => {
    for (const x of [ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler]) {
      expect(x).toBeDefined()
    }
  })
})
