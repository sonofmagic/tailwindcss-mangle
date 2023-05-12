import { getCss, getTestCase } from './utils'

describe('common usage', () => {
  it('hello-world', () => {
    expect(getCss(getTestCase('hello-world.html'))).toMatchSnapshot()
  })

  it('hello-world with js', () => {
    expect(getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])).toMatchSnapshot()
  })
})
