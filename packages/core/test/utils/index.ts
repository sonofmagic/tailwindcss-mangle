import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import fs from 'fs'
import path from 'path'

export function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, '../fixtures', caseName), 'utf-8')
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
