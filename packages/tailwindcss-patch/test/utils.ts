import fs from 'fs-extra'
import path from 'pathe'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

export const fixturesRoot = path.resolve(__dirname, './fixtures')

export const appRoot = path.resolve(fixturesRoot, './apps')

export function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', caseName), 'utf8')
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
  ]).process('@tailwind utilities;', {
    from: undefined,
  })
  return res.css
}
