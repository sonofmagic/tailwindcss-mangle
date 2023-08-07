import postcss from 'postcss'
import postcssrc from 'postcss-load-config'

export async function getCss(ctx?: postcssrc.ConfigContext, p?: string, opts?: Parameters<typeof postcssrc>[2]) {
  const { options, plugins } = await postcssrc(ctx, p, opts)
  const res = await postcss(plugins).process('@tailwind base;@tailwind components;@tailwind utilities;', options)
  return res
}
