const mr = (e, t) => {
  const n = e.__vccOpts || e
  for (const [s, r] of t) n[s] = r
  return n
}
const fl = mr(cl, [['__scopeId', 'data-v-1d5be6d4']])
const ul = bo(
  '<div class="flex justify-between" data-v-fd6461cd><a href="https://vitejs.dev" target="_blank" data-v-fd6461cd><img src="' +
    tl +
    '" class="logo" alt="Vite logo" data-v-fd6461cd></a><a href="https://vuejs.org/" target="_blank" data-v-fd6461cd><img src="' +
    nl +
    '" class="logo vue" alt="Vue logo" data-v-fd6461cd></a></div>',
  1
)
const al = Gs({
  __name: 'App',
  setup(e) {
    return (t, n) => (
      dr(),
      hr(
        fe,
        null,
        [
          ul,
          Ae(fl, {
            msg: 'Vite + Vue'
          })
        ],
        64
      )
    )
  }
})
const dl = mr(al, [['__scopeId', 'data-v-fd6461cd']])
Go(dl).mount('#app')
