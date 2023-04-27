// https://nuxt.com/docs/api/configuration/nuxt-config
import nuxtPlugin from 'unplugin-tailwindcss-mangle/nuxt'
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },
  modules: [
    [
      nuxtPlugin,
      {
        classSetOutput: {
          type: 'all'
        }
      }
    ]
  ]
})
