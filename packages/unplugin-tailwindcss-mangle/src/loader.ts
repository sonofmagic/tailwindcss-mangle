import type { Context } from '@tailwindcss-mangle/core'
import type { LoaderContext } from 'webpack'
import { cssHandler } from '@tailwindcss-mangle/core'

async function TailwindcssMangleWebpackLoader(this: LoaderContext<{ ctx: Context }>, source: string) {
  const callback = this.async()
  const { ctx } = this.getOptions()

  const { code } = await cssHandler(source, {
    ctx,
    id: this.resource,
  })

  callback(null, code)
}

export default TailwindcssMangleWebpackLoader
