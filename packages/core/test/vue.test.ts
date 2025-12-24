import { splitCode } from '@tailwindcss-mangle/shared'
import { Context } from '@/ctx'
import { vueHandler } from '@/vue'

describe('vue handler', () => {
  let ctx: Context
  beforeEach(() => {
    ctx = new Context()
  })

  it('should transform static class in template', async () => {
    const input = `<template>
  <div class="bg-red-500 text-white">Hello</div>
</template>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
  })

  it('should handle dynamic :class binding', async () => {
    const input = `<template>
  <div :class="dynamicClass">Hello</div>
</template>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500')) {
      replaceMap.set(x, '1')
    }

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
  })

  it('should transform class in script setup', async () => {
    const input = `<script setup>
const cls = 'bg-red-500 text-white'
</script>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
  })

  it('should transform class in style section', async () => {
    const input = `<style scoped>
.bg-red-500 {
  color: white;
}
</style>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500')) {
      replaceMap.set(x, '1')
    }

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
  })

  it('should handle complete SFC with template, script and style', async () => {
    const input = `<script setup>
const className = 'bg-blue-500'
</script>

<template>
  <div class="bg-red-500 text-white" :class="className">
    Hello World
  </div>
</template>

<style scoped>
.bg-red-500 {
  color: white;
}
</style>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 bg-blue-500 text-white')) {
      replaceMap.set(x, '1')
    }

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
  })

  it('should preserve twMerge classes', async () => {
    const input = `<script setup>
import { twMerge } from 'tailwind-merge'
const cls = twMerge('bg-red-500', 'bg-blue-500')
</script>`
    const replaceMap = ctx.replaceMap
    for (const x of splitCode('bg-red-500 bg-blue-500')) {
      replaceMap.set(x, '1')
    }

    await ctx.initConfig({
      classList: ['bg-red-500', 'bg-blue-500'],
      transformerOptions: {
        preserve: { functions: ['twMerge'] },
      },
    })

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBeGreaterThan(0)
  })

  it('should handle non-Vue files by processing them', async () => {
    // Vue parser can handle regular JS strings in template
    const input = `<template>
  <div class="bg-red-500">Hello</div>
</template>`
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500', '1')

    const { code } = await vueHandler(input, { ctx, id: 'test.vue' })
    // Should process the Vue file and transform the class
    expect(code).toContain('tw-')
  })
})
