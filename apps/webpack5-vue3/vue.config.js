const { defineConfig } = require('@vue/cli-service')
const utwm = require('unplugin-tailwindcss-mangle/webpack')

module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: (config) => {
    config.plugins.push(utwm({
      classMapOutput: true,
    }))
  },
})
