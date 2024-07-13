import type { LoaderContext } from 'webpack'
import { type Context, cssHandler } from '@tailwindcss-mangle/core'

const TailwindcssMangleWebpackLoader = async function (this: LoaderContext<{ ctx: Context }>, source: string) {
  const callback = this.async()
  const { ctx } = this.getOptions()

  const { code } = await cssHandler(source, {
    ctx,
    id: this.resource,
  })

  callback(null, code)
}

export default TailwindcssMangleWebpackLoader
