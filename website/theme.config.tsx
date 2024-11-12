import type { DocsThemeConfig } from 'nextra-theme-docs'

export default {
  logo: <span>Tailwindcss-mangle Documentation</span>,
  project: {
    link: 'https://github.com/sonofmagic/tailwindcss-mangle',
  },
  docsRepositoryBase: 'https://github.com/sonofmagic/tailwindcss-mangle/tree/main/website',
  i18n: [
    { locale: 'en', name: 'English' },
    { locale: 'zh', name: '中文' },
  ],
} as DocsThemeConfig
