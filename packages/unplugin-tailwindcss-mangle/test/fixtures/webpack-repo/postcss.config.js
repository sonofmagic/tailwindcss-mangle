const path = require('path')

module.exports = {
  plugins: [
    require('@tailwindcss/postcss')({
      config: path.resolve(__dirname, './tailwind.config.js'),
    }),
    // require('autoprefixer')(),
  ],
}
