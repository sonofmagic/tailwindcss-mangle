import { extractRawCandidates } from '@/core/candidates'
import { TailwindcssPatcher } from '@/index'
import fs from 'fs-extra'
import path from 'pathe'
// import { __unstable__loadDesignSystem } from 'tailwindcss'

describe('v4', () => {
  it('tailwindcssPatcher case 0', async () => {
    const patcher = new TailwindcssPatcher()

    const candidates = await patcher.extractValidCandidates({
      base: import.meta.dirname,
      css: await fs.readFile(path.resolve(import.meta.dirname, './fixtures/v4/index.css'), 'utf8'),
      content: path.resolve(import.meta.dirname, './fixtures/v4/index.html'),
    })
    expect(candidates).toMatchSnapshot()
  })

  it('tailwindcssPatcher casae 1', async () => {
    const patcher = new TailwindcssPatcher()

    const candidates = await patcher.extractValidCandidates({
      base: import.meta.dirname,
      css: await fs.readFile(path.resolve(import.meta.dirname, './fixtures/v4/index.css'), 'utf8'),

    })
    expect(candidates).toMatchSnapshot()
  })

  it('extractRawCandidates case 0', async () => {
    const candidates = await extractRawCandidates(
      [
        {
          base: import.meta.dirname,
          pattern: path.resolve(import.meta.dirname, './fixtures/v4/index.html'),
        },
      ],
    )
    expect(candidates).toMatchSnapshot()
  })

  // {
  //   base: import.meta.dirname,
  //   css: await fs.readFile(path.resolve(import.meta.dirname, './fixtures/v4/index.css'), 'utf8'),
  //   content: path.resolve(import.meta.dirname, './fixtures/v4/index.html'),
  // }
})
