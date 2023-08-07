import postcss from 'postcss'
import postcssrc from 'postcss-load-config'

export async function getCss(p?: string) {
  // ctx?: postcssrc.ConfigContext,
  //  opts?: Parameters<typeof postcssrc>[2]
  const { options, plugins } = await postcssrc(undefined, p)
  const res = await postcss(plugins).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
    ...options
  })
  return res
}
