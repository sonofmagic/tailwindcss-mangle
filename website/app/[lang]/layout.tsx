import { Footer, LastUpdated, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { getDictionary, getDirection } from '../_dictionaries/get-dictionary'
// Required for theme styles, previously was imported under the hood
import 'nextra-theme-docs/style.css'

export const metadata = {
  // ... your metadata API
  // https://nextjs.org/docs/app/building-your-application/optimizing/metadata
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params
  const pageMap = await getPageMap(lang)
  const direction = getDirection(lang)
  const dictionary = await getDictionary(lang)
  console.log(lang)
  return (
    <html
      lang={lang}
      // Required to be set
      dir={direction}
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <Head />
      <body>
        <Layout
          // banner={<Banner storageKey="some-key">{dictionary.banner}</Banner>}
          docsRepositoryBase="https://github.com/shuding/nextra/blob/main/examples/swr-site"
          editLink={dictionary.editPage}
          // feedback={{ content: dictionary.feedback }}
          footer={<Footer>1</Footer>}
          i18n={[
            { locale: 'en', name: 'English' },
            { locale: 'fr', name: 'Français' },
            { locale: 'ru', name: 'Русский' },
          ]}
          lastUpdated={<LastUpdated>{dictionary.lastUpdated}</LastUpdated>}
          navbar={<Navbar logo={<div>Logo</div>} />}
          pageMap={pageMap}
          search={(
            <Search
              emptyResult="4"
              errorText="3"
              loading="2"
              placeholder="1"
            />
          )}
          themeSwitch={{
            dark: dictionary.dark,
            light: dictionary.light,
            system: dictionary.system,
          }}
          toc={{
            backToTop: dictionary.backToTop,
            title: '1',
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
