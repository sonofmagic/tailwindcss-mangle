const path = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.resolve(__dirname, "./src/**/*.{html,js}")],
  theme: {
    extend: {},
  },
  plugins: [],
}