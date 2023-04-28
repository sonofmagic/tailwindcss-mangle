const { defineConfig } = require('@vue/cli-service')
const { webpackPlugin: utwm } = require('unplugin-tailwindcss-mangle')
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: (config) => {
    config.plugins.push(utwm({
      classSetOutput: true,
      classMapOutput: true
    }))
  }
})
