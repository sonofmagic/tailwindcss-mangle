import { extractRawCandidatesWithPositions } from '@/core/candidates'
import { __unstable__loadDesignSystem } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import path from 'pathe'
import { spliceChangesIntoString } from './splice-changes-into-string'

const html = String.raw

describe('tailwindcss4', () => {
  it('scanner case 0', () => {
    const scanner = new Scanner({
      sources: [
        {
          base: __dirname,
          pattern: 'fixtures/hello-world.wxml', // path.resolve(__dirname, 'fixtures/hello-world.wxml'),
        },

      ],
    })
    const candidates = scanner.scan()
    // scanner.getCandidatesWithPositions()
    // scanner.getCandidatesWithPositions()
    console.log(candidates, scanner.files)
  })

  it('scanner case 1', () => {
    const scanner = new Scanner({})
    // const result = scanner.getCandidatesWithPositions({ content, extension })
    const result = scanner.getCandidatesWithPositions({ file: path.resolve(__dirname, 'fixtures/hello-world.wxml'), extension: '' })
    console.log(result)
  })
})

it('extracts candidates with positions from a template', async () => {
  const content = html`
    <div class="bg-blue-500 hover:focus:text-white [color:red]">
      <button class="bg-blue-500 text-white">My button</button>
    </div>
  `
  const designSystem = await __unstable__loadDesignSystem('@import "tailwindcss";', {
    base: __dirname,
  })

  const candidates = await extractRawCandidatesWithPositions(content, 'html')
  const validCandidates = candidates.filter(
    ({ rawCandidate }) => designSystem.parseCandidate(rawCandidate).length > 0,
  )

  expect(validCandidates).toMatchInlineSnapshot(`
    [
      {
        "end": 28,
        "rawCandidate": "bg-blue-500",
        "start": 17,
      },
      {
        "end": 51,
        "rawCandidate": "hover:focus:text-white",
        "start": 29,
      },
      {
        "end": 63,
        "rawCandidate": "[color:red]",
        "start": 52,
      },
      {
        "end": 98,
        "rawCandidate": "bg-blue-500",
        "start": 87,
      },
      {
        "end": 109,
        "rawCandidate": "text-white",
        "start": 99,
      },
    ]
  `)
})

// let sources = (() => {
//   // Disable auto source detection
//   if (compiler.root === 'none') {
//     return []
//   }

//   // No root specified, use the base directory
//   if (compiler.root === null) {
//     return [{ base, pattern: '**/*' }]
//   }

//   // Use the specified root
//   return [compiler.root]
// })().concat(compiler.globs)

it('extracts candidates with positions from a template case 0', async () => {
  const content = html`
    <div class="bg-blue-500 hover:focus:text-white [color:red]">
      <button class="bg-blue-500 text-white">My button</button>
    </div>
  `
  const designSystem = await __unstable__loadDesignSystem('@import "tailwindcss" source("../src");', {
    base: __dirname,
  })

  const candidates = await extractRawCandidatesWithPositions(content, 'html')
  const validCandidates = candidates.filter(
    ({ rawCandidate }) => designSystem.parseCandidate(rawCandidate).length > 0,
  )

  expect(validCandidates).toMatchInlineSnapshot(`
    [
      {
        "end": 28,
        "rawCandidate": "bg-blue-500",
        "start": 17,
      },
      {
        "end": 51,
        "rawCandidate": "hover:focus:text-white",
        "start": 29,
      },
      {
        "end": 63,
        "rawCandidate": "[color:red]",
        "start": 52,
      },
      {
        "end": 98,
        "rawCandidate": "bg-blue-500",
        "start": 87,
      },
      {
        "end": 109,
        "rawCandidate": "text-white",
        "start": 99,
      },
    ]
  `)
})

it('replaces the right positions for a candidate', async () => {
  const content = html`
    <h1>🤠👋</h1>
    <div class="bg-blue-500" />
  `
  // @import "tailwindcss" prefix(tw);
  const designSystem = await __unstable__loadDesignSystem('@import "tailwindcss";', {
    base: __dirname,
  })

  const candidates = await extractRawCandidatesWithPositions(content, 'html')

  const candidate = candidates.find(
    ({ rawCandidate }) => designSystem.parseCandidate(rawCandidate).length > 0,
  )!

  const migrated = spliceChangesIntoString(content, [
    {
      start: candidate.start,
      end: candidate.end,
      replacement: 'flex',
    },
  ])

  expect(migrated).toMatchInlineSnapshot(`
    "
        <h1>🤠👋</h1>
        <div class="flex" />
      "
  `)
})

const candidates = [
  // Arbitrary candidates
  ['[color:red]', '[color:red]'],
  ['[color:red]/50', '[color:red]/50'],
  ['[color:red]/[0.5]', '[color:red]/[0.5]'],
  ['[color:red]/50!', '[color:red]/50!'],
  ['![color:red]/50', '[color:red]/50!'],
  ['[color:red]/[0.5]!', '[color:red]/[0.5]!'],

  // Static candidates
  ['box-border', 'box-border'],
  ['underline!', 'underline!'],
  ['!underline', 'underline!'],
  ['-inset-full', '-inset-full'],

  // Functional candidates
  ['bg-red-500', 'bg-red-500'],
  ['bg-red-500/50', 'bg-red-500/50'],
  ['bg-red-500/[0.5]', 'bg-red-500/[0.5]'],
  ['bg-red-500!', 'bg-red-500!'],
  ['!bg-red-500', 'bg-red-500!'],
  ['bg-[#0088cc]/50', 'bg-[#0088cc]/50'],
  ['bg-[#0088cc]/[0.5]', 'bg-[#0088cc]/[0.5]'],
  ['bg-[#0088cc]!', 'bg-[#0088cc]!'],
  ['!bg-[#0088cc]', 'bg-[#0088cc]!'],
  ['bg-[var(--spacing)-1px]', 'bg-[var(--spacing)-1px]'],
  ['bg-[var(--spacing)_-_1px]', 'bg-[var(--spacing)-1px]'],
  ['bg-[-1px_-1px]', 'bg-[-1px_-1px]'],
  ['p-[round(to-zero,1px)]', 'p-[round(to-zero,1px)]'],
  ['w-1/2', 'w-1/2'],
  ['p-[calc((100vw-theme(maxWidth.2xl))_/_2)]', 'p-[calc((100vw-theme(maxWidth.2xl))/2)]'],

  // Keep spaces in strings
  ['content-["hello_world"]', 'content-["hello_world"]'],
  ['content-[____"hello_world"___]', 'content-["hello_world"]'],

  // Do not escape underscores for url() and CSS variable in var()
  ['bg-[no-repeat_url(/image_13.png)]', 'bg-[no-repeat_url(/image_13.png)]'],
  [
    'bg-[var(--spacing-0_5,_var(--spacing-1_5,_3rem))]',
    'bg-(--spacing-0_5,var(--spacing-1_5,3rem))',
  ],
]

const variants = [
  ['', ''], // no variant
  ['*:', '*:'],
  ['focus:', 'focus:'],
  ['group-focus:', 'group-focus:'],

  ['hover:focus:', 'hover:focus:'],
  ['hover:group-focus:', 'hover:group-focus:'],
  ['group-hover:focus:', 'group-hover:focus:'],
  ['group-hover:group-focus:', 'group-hover:group-focus:'],

  ['min-[10px]:', 'min-[10px]:'],

  // Normalize spaces
  ['min-[calc(1000px_+_12em)]:', 'min-[calc(1000px+12em)]:'],
  ['min-[calc(1000px_+12em)]:', 'min-[calc(1000px+12em)]:'],
  ['min-[calc(1000px+_12em)]:', 'min-[calc(1000px+12em)]:'],
  ['min-[calc(1000px___+___12em)]:', 'min-[calc(1000px+12em)]:'],

  ['peer-[&_p]:', 'peer-[&_p]:'],
  ['peer-[&_p]:hover:', 'peer-[&_p]:hover:'],
  ['hover:peer-[&_p]:', 'hover:peer-[&_p]:'],
  ['hover:peer-[&_p]:focus:', 'hover:peer-[&_p]:focus:'],
  ['peer-[&:hover]:peer-[&_p]:', 'peer-[&:hover]:peer-[&_p]:'],

  ['[p]:', '[p]:'],
  ['[_p_]:', '[p]:'],
  ['has-[p]:', 'has-[p]:'],
  ['has-[_p_]:', 'has-[p]:'],

  // Simplify `&:is(p)` to `p`
  ['[&:is(p)]:', '[p]:'],
  ['[&:is(_p_)]:', '[p]:'],
  ['has-[&:is(p)]:', 'has-[p]:'],
  ['has-[&:is(_p_)]:', 'has-[p]:'],
]

const combinations: [string, string][] = []

for (const [inputVariant, outputVariant] of variants) {
  for (const [inputCandidate, outputCandidate] of candidates) {
    combinations.push([`${inputVariant}${inputCandidate}`, `${outputVariant}${outputCandidate}`])
  }
}
