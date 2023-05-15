import { ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler } from '../'

describe('exports', () => {
  it('exports should be defined', () => {
    ;[ClassGenerator, cssHandler, handleValue, htmlHandler, jsHandler].forEach((x) => {
      expect(x).toBeDefined()
    })
  })
})
