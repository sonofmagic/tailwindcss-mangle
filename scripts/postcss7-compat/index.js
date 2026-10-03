const assert = require('node:assert/strict')
const fs = require('node:fs')
const process = require('node:process')
const path = require('pathe')
const postcss = require('postcss')

async function main() {
  const { TailwindcssPatcher } = await import('tailwindcss-patch')
  const twPatcher = new TailwindcssPatcher({
    projectRoot: __dirname,
    cache: false,
  })
  await twPatcher.patch()

  // Load Tailwind after patching so this process receives the exposed context.
  const tailwindcss = require('tailwindcss')
  const tw = tailwindcss({
    mode: 'jit',
    purge: {
      content: [{
        raw: 'w-[99px]',
      }],
    },
  })
  const result = await postcss([tw]).process(`@tailwind base;
  @tailwind components;
  @tailwind utilities;`, { from: undefined })
  fs.writeFileSync(path.join(__dirname, 'result.css'), result.css, 'utf8')

  const classes = twPatcher.getClassSetSync()
  assert.ok(result.css.includes('width: 99px'))
  assert.ok(classes.has('w-[99px]'))
  console.log('PostCSS 7 and Tailwind CSS 2 extraction smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
