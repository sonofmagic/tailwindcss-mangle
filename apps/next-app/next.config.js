const utwm = require('unplugin-tailwindcss-mangle/webpack')
// import utwm from 'unplugin-tailwindcss-mangle'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // console.log(process.env.NODE_ENV)
    // if (process.env.NODE_ENV === 'production') {
    //   config.plugins.push(utwm({
    //     classMapOutput: true,
    //   }))
    // }
    config.plugins.push(utwm({
      classMapOutput: true,
    }))
    return config
  },
}

module.exports = nextConfig
