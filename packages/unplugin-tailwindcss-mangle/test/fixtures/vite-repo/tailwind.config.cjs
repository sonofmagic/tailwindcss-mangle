const path = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.resolve(__dirname, "./src/**/*.{html,js,ts}")],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false
  }
}