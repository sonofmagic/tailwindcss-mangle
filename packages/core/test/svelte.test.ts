import { splitCode } from '@tailwindcss-mangle/shared'
import { Context } from '@/ctx'
import { svelteHandler } from '@/svelte'

describe('svelte handler', () => {
  let ctx: Context
  beforeEach(() => {
    ctx = new Context()
  })

  it('should transform static class', async () => {
    const input = `<div class="bg-red-500 text-white">Hello</div>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })

  it('should handle class directives', async () => {
    const input = `<div class:bg-red-500={isActive}>Hello</div>`
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500', '1')

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })

  it('should transform class in script tag', async () => {
    const input = `<script>
const cls = 'bg-red-500 text-white'
</script>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })

  it('should transform class in style tag', async () => {
    const input = `<style>
.bg-red-500 {
  color: white;
}
</style>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500')) {
      replaceMap.set(x, '1')
    }

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })

  it('should handle complete component with script, template and style', async () => {
    const input = `<script>
let className = 'bg-blue-500'
</script>

<div class="bg-red-500 text-white" class:bg-blue-500={true}>
  Hello World
</div>

<style>
.bg-red-500 {
  color: white;
}
</style>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 bg-blue-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })

  it('should handle multiple class attributes', async () => {
    const input = `<div class="p-4 m-2 bg-red-500 hover:bg-red-600">Content</div>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('p-4 m-2 bg-red-500 hover:bg-red-600')) {
      replaceMap.set(x, '1')
    }

    const { code } = await svelteHandler(input, { ctx, id: 'test.svelte' })
    expect(code).toMatchSnapshot()
  })
})
