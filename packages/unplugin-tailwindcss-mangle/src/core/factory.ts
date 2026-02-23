import type { TransformerOptions } from '@tailwindcss-mangle/config'
import type { UnpluginFactory } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import { Context, cssHandler, htmlHandler, jsHandler, svelteHandler, vueHandler } from '@tailwindcss-mangle/core'
import { isCSSRequest } from 'is-css-request'
import path from 'pathe'
import { getGroupedEntries } from '@/utils'
import { pluginName } from '../constants'

const WEBPACK_LOADER = path.resolve(__dirname, __DEV__ ? '../../dist/loader.cjs' : './loader.cjs')
const JS_LIKE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.jsx', '.tsx'])
const HTML_LIKE_EXTENSIONS = new Set(['.html', '.htm'])
const CSS_LIKE_LANGS = new Set(['css', 'less', 'sass', 'scss', 'styl', 'stylus', 'pcss', 'postcss', 'sss'])
const JS_LIKE_LANGS = new Set(['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx'])
const HTML_LIKE_LANGS = new Set(['html', 'htm'])
type TransformKind = 'js' | 'vue' | 'svelte' | 'css' | 'html'

function normalizeLang(rawLang: string | null) {
  if (!rawLang) {
    return ''
  }
  return rawLang.toLowerCase().replace(/^\./, '')
}

function isLikelyMarkup(code: string) {
  return /<([a-z][\w:-]*)(?:\s|>)/i.test(code)
}

function isHtmlFileRequest(id: string) {
  const cleanId = id.split('?')[0] ?? id
  const ext = path.extname(cleanId).toLowerCase()
  return HTML_LIKE_EXTENSIONS.has(ext)
}

function resolveTransformKind(id: string, code: string): TransformKind {
  if (isCSSRequest(id)) {
    return 'css'
  }

  const cleanId = id.split('?')[0] ?? id
  const ext = path.extname(cleanId).toLowerCase()
  const query = id.includes('?') ? id.slice(id.indexOf('?') + 1) : ''
  const params = new URLSearchParams(query)
  const type = params.get('type')?.toLowerCase()
  const lang = normalizeLang(params.get('lang'))

  if (type === 'style') {
    return 'css'
  }
  if (type === 'script') {
    return 'js'
  }
  if (type === 'template') {
    if (lang && JS_LIKE_LANGS.has(lang)) {
      return 'js'
    }
    if (lang && HTML_LIKE_LANGS.has(lang)) {
      return 'html'
    }
    return isLikelyMarkup(code) ? 'html' : 'js'
  }

  if (lang) {
    if (CSS_LIKE_LANGS.has(lang)) {
      return 'css'
    }
    if (JS_LIKE_LANGS.has(lang)) {
      return 'js'
    }
    if (HTML_LIKE_LANGS.has(lang)) {
      return 'html'
    }
    if (lang === 'vue') {
      return 'vue'
    }
    if (lang === 'svelte') {
      return 'svelte'
    }
  }

  if (ext === '.vue') {
    return 'vue'
  }
  if (ext === '.svelte') {
    return 'svelte'
  }
  if (HTML_LIKE_EXTENSIONS.has(ext)) {
    return 'html'
  }
  if (JS_LIKE_EXTENSIONS.has(ext)) {
    return 'js'
  }

  // For included sources without explicit type, prefer markup parsing when source looks like HTML-ish content.
  return isLikelyMarkup(code) ? 'html' : 'js'
}

const factory: UnpluginFactory<TransformerOptions | undefined> = (options) => {
  const ctx = new Context()
  // webpack/rspack may evaluate transform filters before buildStart,
  // so we need a usable filter immediately from inline options.
  let filter = createFilter(options?.sources?.include, options?.sources?.exclude)
  return [
    {
      name: `${pluginName}:pre`,
      enforce: 'pre',
      async buildStart() {
        const initOptions = options === undefined ? {} : { transformerOptions: options }
        await ctx.initConfig(initOptions)
        filter = createFilter(ctx.options.sources?.include, ctx.options.sources?.exclude)
      },
    },
    {
      name: `${pluginName}`,
      transformInclude(id) {
        const cleanId = id.split('?')[0] ?? id
        if (isHtmlFileRequest(cleanId)) {
          return false
        }
        return filter(cleanId)
      },
      async transform(code, id) {
        const opts = {
          ctx,
          id,
        }
        const kind = resolveTransformKind(id, code)
        const framework = this.getNativeBuildContext?.().framework

        // webpack/rspack transform loader must return JS for html modules.
        // Keep html handling in post hooks / framework-native html pipelines.
        if ((framework === 'webpack' || framework === 'rspack') && kind === 'html' && isHtmlFileRequest(id)) {
          return null
        }

        switch (kind) {
          case 'css':
            return await cssHandler(code, opts)
          case 'vue':
            return await vueHandler(code, opts)
          case 'svelte':
            return await svelteHandler(code, opts)
          case 'html':
            return htmlHandler(code, opts)
          case 'js':
          default:
            return jsHandler(code, opts)
        }
      },
      webpack(compiler) {
        const { NormalModule } = compiler.webpack
        const isExisted = true
        compiler.hooks.compilation.tap(pluginName, (compilation) => {
          NormalModule.getCompilationHooks(compilation).loader.tap(pluginName, (_loaderContext, module) => {
            if (isExisted) {
              const idx = module.loaders.findIndex(x => x.loader.includes('postcss-loader'))

              if (idx > -1) {
                module.loaders.splice(idx, 0, {
                  loader: WEBPACK_LOADER,
                  ident: null,
                  options: {
                    ctx,
                  },
                  type: null,
                })
              }
            }
          })
        })
      },
    },
    {
      name: `${pluginName}:post`,
      enforce: 'post',
      vite: {
        transformIndexHtml(html) {
          const { code } = htmlHandler(html, { ctx })
          return code
        },
        // generateBundle: {
        //   async handler(options, bundle) {
        //     const groupedEntries = getGroupedEntries(Object.entries(bundle))

        //     if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
        //       for (let i = 0; i < groupedEntries.css.length; i++) {
        //         const [id, cssSource] = groupedEntries.css[i] as [string, OutputAsset]

        //         const { code } = await cssHandler(cssSource.source.toString(), {
        //           id,
        //           ctx,
        //         })
        //         cssSource.source = code
        //       }
        //     }
        //   },
        // },
      },
      webpack(compiler) {
        const { Compilation, sources } = compiler.webpack
        const { ConcatSource } = sources

        compiler.hooks.compilation.tap(pluginName, (compilation) => {
          compilation.hooks.processAssets.tapPromise(
            {
              name: pluginName,
              stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
            },
            async (assets) => {
              const groupedEntries = getGroupedEntries(Object.entries(assets))

              // if (groupedEntries.js.length > 0) {
              //   for (let i = 0; i < groupedEntries.js.length; i++) {
              //     const [file, chunk] = groupedEntries.js[i]

              //     const code = jsHandler(chunk.source().toString(), {
              //       ctx,
              //     }).code
              //     if (code) {
              //       const source = new ConcatSource(code)
              //       compilation.updateAsset(file, source)
              //     }
              //   }
              // }

              if (groupedEntries.css.length > 0) {
                for (let i = 0; i < groupedEntries.css.length; i++) {
                  const entry = groupedEntries.css[i]
                  if (!entry) {
                    continue
                  }
                  const [id, cssSource] = entry

                  const { code } = await cssHandler(cssSource.source().toString(), {
                    id,
                    ctx,
                  })

                  const source = new ConcatSource(code)

                  compilation.updateAsset(id, source)
                }
              }

              // if (groupedEntries.html.length > 0) {
              //   for (let i = 0; i < groupedEntries.html.length; i++) {
              //     const [file, asset] = groupedEntries.html[i]

              //     const { code } = htmlHandler(asset.source().toString(), {
              //       ctx,
              //     })
              //     const source = new ConcatSource(code)
              //     compilation.updateAsset(file, source)
              //   }
              // }
            },
          )
        })
      },
      writeBundle() {
        ctx.dump()
      },
    },
  ]
}

export default factory
