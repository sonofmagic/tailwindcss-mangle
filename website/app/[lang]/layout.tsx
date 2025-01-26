import type { Metadata } from 'next'
/* eslint-env node */
import {
  Footer,
  LastUpdated,
  Layout,
  Link,
  LocaleSwitch,
  Navbar,
} from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { getDictionary, getDirection } from '../_dictionaries/get-dictionary'
import './styles.css'

export const metadata: Metadata = {
  title: {
    absolute: '',
    template: '%s | Tailwindcss-mangle',
  },
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params
  const dictionary = await getDictionary(lang)
  const pageMap = await getPageMap(`/${lang}`)

  const navbar = (
    <Navbar
      logo={(
        <>
          <span
            className="ms-2 font-extrabold select-none max-md:hidden"
            title="tailwindcss-mangle"
          >
            Tailwindcss-mangle
          </span>
        </>
      )}
      projectLink="https://github.com/sonofmagic/tailwindcss-mangle"
    >
      <LocaleSwitch />
    </Navbar>
  )
  const footer = (
    <Footer>
      <span className="flex justify-center">
        MIT
        {' '}
        {new Date().getFullYear()}
        {' '}
        ©
        {' '}
        <a
          href="https://github.com/sonofmagic"
          rel="noreferrer"
          target="_blank"
          className="x:focus-visible:nextra-focus flex items-center gap-2 font-semibold"
        >
          sonofmagic
        </a>
      </span>
    </Footer>
  )
  return (
    <html lang={lang} dir={getDirection(lang)} suppressHydrationWarning>
      <Head
        backgroundColor={{
          dark: 'rgb(15,23,42)',
          light: 'rgb(254, 252, 232)',
        }}
        color={{
          hue: { dark: 120, light: 0 },
          saturation: { dark: 100, light: 100 },
        }}
      />
      <body>
        <Layout

          navbar={navbar}
          footer={footer}
          docsRepositoryBase="https://github.com/sonofmagic/tailwindcss-mangle/tree/main/website"
          i18n={[
            { locale: 'en', name: 'English' },
            { locale: 'zh', name: '中文' },
          ]}
          sidebar={{
            defaultMenuCollapseLevel: 1,
            autoCollapse: true,
          }}
          toc={{
            backToTop: dictionary.backToTop,
          }}
          editLink={dictionary.editPage}
          pageMap={pageMap}
          nextThemes={{ defaultTheme: 'dark' }}
          lastUpdated={<LastUpdated>{dictionary.lastUpdated}</LastUpdated>}
          themeSwitch={{
            dark: dictionary.dark,
            light: dictionary.light,
            system: dictionary.system,
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
