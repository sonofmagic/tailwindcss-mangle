import { splitCode } from '@/split'

describe('split code', () => {
  it('split vue static str', () => {
    const testCase
      = 'tl = ai("<div class="mb-32 grid tw-xb tw-yb tw-zb lg:text-left" data-v-988e8bc1><a href="https://nextjs.org/docs?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Docs <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Find in-depth information about Next.js features and API.</p></a><a href="https://nextjs.org/learn?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Learn <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Learn about Next.js in an interactive course with\u00A0quizzes!</p></a><a href="https://vercel.com/templates?framework=next.js&amp;utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Templates <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Discover and deploy boilerplate example Next.js\u00A0projects.</p></a><a href="https://vercel.com/new?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Deploy <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Instantly deploy your Next.js site to a shareable URL with Vercel.</p></a></div>", 1),'

    const arr = splitCode(testCase)
    expect(arr).toMatchSnapshot()
  })

  it('split vue static str with splitQuote false', () => {
    const testCase
      = 'tl = ai("<div class="mb-32 grid tw-xb tw-yb tw-zb lg:text-left" data-v-988e8bc1><a href="https://nextjs.org/docs?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Docs <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Find in-depth information about Next.js features and API.</p></a><a href="https://nextjs.org/learn?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Learn <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Learn about Next.js in an interactive course with\u00A0quizzes!</p></a><a href="https://vercel.com/templates?framework=next.js&amp;utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Templates <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Discover and deploy boilerplate example Next.js\u00A0projects.</p></a><a href="https://vercel.com/new?utm_source=create-next-app&amp;utm_medium=default-template-tw&amp;utm_campaign=create-next-app" class="group tw-ac border tw-bc tw-cc tw-dc tw-ec tw-fc tw-gc tw-hc hover:dark:bg-neutral-800/30" target="_blank" rel="noopener noreferrer" data-v-988e8bc1><h2 class="mb-3 tw-ic font-semibold" data-v-988e8bc1> Deploy <span class="inline-block tw-jc tw-kc motion-reduce:transform-none" data-v-988e8bc1>-&gt;</span></h2><p class="m-0 tw-lc tw-k opacity-50" data-v-988e8bc1>Instantly deploy your Next.js site to a shareable URL with Vercel.</p></a></div>", 1),'

    const arr = splitCode(testCase, {
      splitQuote: false,
    })
    expect(arr).toMatchSnapshot()
  })

  it('split long class string', () => {
    const testCase
      = 'fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30'
    const arr = splitCode(testCase, {
      splitQuote: false,
    })
    expect(arr).toMatchSnapshot()
  })
})
