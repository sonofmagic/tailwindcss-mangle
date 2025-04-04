import fs from 'node:fs'
import path from 'pathe'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

export function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, '../fixtures', caseName), 'utf8')
}
// @tailwind base;
// @tailwind components;
export async function getCss(raw: string | string[]) {
  if (typeof raw === 'string') {
    raw = [raw]
  }
  const res = await postcss([
    tailwindcss({
      content: raw.map((x) => {
        return {
          raw: x,
        }
      }),
    }),
  ]).process('@tailwind utilities;')
  return res.css
}
