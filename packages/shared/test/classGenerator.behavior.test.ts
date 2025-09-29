import { ClassGenerator } from '@/classGenerator'

describe('ClassGenerator behaviour', () => {
  it('respects include/exclude filters and ignore rules', () => {
    const generator = new ClassGenerator({
      include: [/src\/.+\.ts$/u],
      exclude: [/src\/skip/u],
      ignoreClass: [/^skip-me$/u],
      classPrefix: 'pref-',
    })

    expect(generator.includeFilePath('src/file.ts')).toBe(true)
    expect(generator.includeFilePath('pkg/file.ts')).toBe(false)
    expect(generator.excludeFilePath('src/skip/component.ts')).toBe(true)
    expect(generator.isFileIncluded('src/skip/component.ts')).toBe(false)
    expect(generator.isFileIncluded('src/ok/component.ts')).toBe(true)

    expect(generator.ignoreClassName('skip-me')).toBe(true)
    expect(generator.ignoreClassName('keep-me')).toBe(false)

    const defaultGenerator = new ClassGenerator()
    expect(defaultGenerator.includeFilePath('any/path.vue')).toBe(true)
    expect(defaultGenerator.excludeFilePath('any/path.vue')).toBe(false)
  })

  it('transforms mapped class names using the escape-stripped key', () => {
    const generator = new ClassGenerator()
    generator.newClassMap['text[50]'] = {
      name: 'pref-a',
      usedBy: new Set(),
    }

    expect(generator.transformCssClass('text\\[50\\]')).toBe('pref-a')
    expect(generator.transformCssClass('text-unknown')).toBe('text-unknown')
  })

  it('reuses generated classes and supports custom generators', () => {
    const generator = new ClassGenerator({
      customGenerate: (original, _opts, ctx) => {
        ctx[original] = (ctx[original] ?? 0) + 1
        return `${original}-${ctx[original]}`
      },
    })

    const first = generator.generateClassName('foo')
    expect(first.name).toBe('foo-1')
    expect(generator.context.foo).toBe(1)

    const again = generator.generateClassName('foo')
    expect(again).toBe(first)
  })

  it('falls back to default generator and skips reserved results', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const generator = new ClassGenerator({
      reserveClassName: [/^tw-a$/u],
      log: true,
    })

    const result = generator.generateClassName('foo')
    expect(result.name).toBe('tw-b')
    expect(generator.newClassSize).toBe(2)
    expect(logSpy).toHaveBeenCalledWith('The class name has been reserved. tw-a')

    logSpy.mockRestore()
  })
})
