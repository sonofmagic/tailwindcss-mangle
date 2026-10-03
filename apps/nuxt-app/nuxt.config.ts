// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import nuxtPlugin from 'unplugin-tailwindcss-mangle/nuxt'

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  features: {
    inlineStyles: false,
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
