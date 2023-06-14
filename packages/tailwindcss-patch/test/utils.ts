import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import fs from 'node:fs'
import path from 'node:path'

export function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', caseName), 'utf8')
}
// @tailwind base;
// @tailwind components;
export function getCss(raw: string | string[]) {
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
