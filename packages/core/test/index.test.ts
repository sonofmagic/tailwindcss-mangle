import { getCss, getTestCase } from './utils'

describe('common usage', () => {
  it('hello-world', async () => {
    expect(await getCss(getTestCase('hello-world.html'))).toMatchSnapshot()
  })

  it('hello-world with js', async () => {
    expect(await getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])).toMatchSnapshot()
  })
})
