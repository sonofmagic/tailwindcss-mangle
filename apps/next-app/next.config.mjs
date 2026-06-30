import utwm from 'unplugin-tailwindcss-mangle/webpack'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // console.log(process.env.NODE_ENV)
    // if (process.env.NODE_ENV === 'production') {
    //   config.plugins.push(utwm({
    //     registry: {
    //       mapping: true,
    //     },
    //   }))
    // }
    config.plugins.push(utwm({
      registry: {
        mapping: true,
      },
    }))
    return config
  },
}

export default nextConfig
