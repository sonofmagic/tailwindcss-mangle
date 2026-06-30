import { defineConfig } from '@vue/cli-service'
import utwm from 'unplugin-tailwindcss-mangle/webpack'

export default defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  configureWebpack: (config) => {
    config.plugins.push(utwm({
      registry: {
        mapping: true,
      },
      sources: {
        include: [
          /\.[cm]?[jt]sx?(?:$|\?)/,
          /\.vue(?:$|\?)/,
          /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/,
        ],
      },
    }))
  },

})
