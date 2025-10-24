import { getCss, getTestCase } from './utils'

describe('common usage', () => {
  it('hello-world', async () => {
    const css = await getCss(getTestCase('hello-world.html'))
    expect(css).toContain('.text-3xl')
    expect(css).toContain('.font-bold')
    expect(css).toContain('.underline')
  })

  it('hello-world with js', async () => {
    const css = await getCss([
      { raw: getTestCase('hello-world.html'), extension: 'html' },
      { raw: getTestCase('hello-world.js'), extension: 'js' },
    ])
    expect(css).toContain('.text-3xl')
    expect(css).toContain('.font-bold')
    expect(css).toContain('.underline')
    expect(css).toContain('.bg-\\[\\#123456\\]')
  })
})
