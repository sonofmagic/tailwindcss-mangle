import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import fs from 'fs'
import path from 'path'

function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', caseName), 'utf-8')
}
// @tailwind base;
// @tailwind components;
function getCss(raw: string | string[]) {
  if (typeof raw === 'string') {
    raw = [raw]
  }
  return postcss([
    tailwindcss({
      content: raw.map((x) => {
        return {
          raw: x
        }
      })
    })
  ]).process('@tailwind utilities;').css
}

describe('common usage', () => {
  it('hello-world', () => {
    expect(getCss(getTestCase('hello-world.html'))).toMatchSnapshot()
  })

  it('hello-world with js', () => {
    expect(getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])).toMatchSnapshot()
  })
})
