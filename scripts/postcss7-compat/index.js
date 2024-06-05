const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const tailwindcss = require('tailwindcss')

async function main() {
  const tw = tailwindcss({
    mode: 'jit',
    purge: {
      content: [{
        raw: 'w-[99px]',
      }],
    },
    // corePlugins: {
    //   preflight: false
    // }
  })
  const result = postcss([tw]).process(`@tailwind base;
  @tailwind components;
  @tailwind utilities;`)
  // console.log(result.css)
  fs.writeFileSync(path.join(__dirname, 'result.css'), result.css, 'utf8')

  const ctx = require('tailwindcss/lib/jit/index')
  console.log(ctx)
}

main()
