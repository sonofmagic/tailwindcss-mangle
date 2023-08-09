import type { MangleUserConfig } from './types'
import { unplugin } from './core'

export default function (options: MangleUserConfig = {}, nuxt: any) {
  // install webpack plugin
  nuxt.hook('webpack:config', (config: any) => {
    config.plugins = config.plugins || []
    config.plugins.unshift(unplugin.webpack(options))
  })

  // install vite plugin
  nuxt.hook('vite:extendConfig', (config: any) => {
    config.plugins = config.plugins || []
    config.plugins.push(unplugin.vite(options))
  })
}
