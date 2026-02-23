// https://nuxt.com/docs/api/configuration/nuxt-config
import nuxtPlugin from 'unplugin-tailwindcss-mangle/nuxt'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  // https://github.com/nuxt/nuxt/issues/20428
  experimental: {
    inlineSSRStyles: false,
  },
  modules: [
    [
      nuxtPlugin,
      {
        registry: {
          mapping: true,
        },
      },
    ],
  ],
})
