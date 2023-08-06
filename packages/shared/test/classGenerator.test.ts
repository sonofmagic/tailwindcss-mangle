import ClassGenerator from '@/classGenerator'

describe('classGenerator', () => {
  it('size 26*27+1', () => {
    const result: string[] = []
    const clsGen = new ClassGenerator()
    for (let i = 0; i < 26 * 27 + 1; i++) {
      result.push(clsGen.defaultClassGenerate())
      clsGen.newClassSize++
    }
    expect(result).toMatchSnapshot()
  })

  it('26*27+1', () => {
    const clsGen = new ClassGenerator()
    clsGen.newClassSize = 26 * 27
    expect(clsGen.defaultClassGenerate()).toBe('tw-aaa')
  })
})
