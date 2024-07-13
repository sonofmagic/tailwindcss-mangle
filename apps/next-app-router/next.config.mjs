import utwm from 'unplugin-tailwindcss-mangle/webpack'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.plugins.push(utwm({
      classMapOutput: true,
    }))
    return config
  },
}

export default nextConfig
