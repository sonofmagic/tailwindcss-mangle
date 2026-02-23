const { defineConfig } = require('@vue/cli-service')
const utwm = require('unplugin-tailwindcss-mangle/webpack')

module.exports = defineConfig({
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
