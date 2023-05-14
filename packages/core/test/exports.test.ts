import { ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler, makeRegex } from '../'

describe('exports', () => {
  it('exports should be defined', () => {
    ;[ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler, makeRegex].forEach((x) => {
      expect(x).toBeDefined()
    })
  })
})
