import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
})

export default withNextra({
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
  },
})
