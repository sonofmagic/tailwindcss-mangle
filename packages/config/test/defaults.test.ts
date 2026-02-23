import { createFilter } from '@rollup/pluginutils'
import { omit } from 'lodash-es'
import { getDefaultRegistryConfig, getDefaultTransformerConfig, getDefaultUserConfig } from '@/defaults'

function omitCwdPath(o: any) {
  return omit(o, ['registry.tailwind.cwd'])
}

function normaliseRegex(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normaliseRegex)
  }
  if (value instanceof RegExp) {
    return value.toString()
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normaliseRegex(val)]))
  }
  return value
}

describe('defaults', () => {
  it('getDefaultRegistryConfig', () => {
    expect(omitCwdPath(getDefaultRegistryConfig())).toMatchSnapshot()
  })

  it('exposes default pipeline include/exclude patterns', () => {
    const transformer = getDefaultTransformerConfig()
    const include = transformer.sources?.include
    const includePatterns = (Array.isArray(include) ? include : include ? [include] : [])
      .filter((item): item is RegExp => item instanceof RegExp)

    expect(includePatterns.some(re => re.test('index.html'))).toBe(true)
    expect(includePatterns.some(re => re.test('styles.css'))).toBe(true)
    expect(transformer.sources?.exclude).toEqual([])
  })

  it('getDefaultUserConfig', () => {
    expect(normaliseRegex(omitCwdPath(getDefaultUserConfig()))).toMatchSnapshot()
  })

  it('getDefaultTransformerConfig reflects NODE_ENV', () => {
    const originalEnv = process.env['NODE_ENV']

    vi.stubEnv('NODE_ENV', 'development')
    expect(getDefaultTransformerConfig().disabled).toBe(true)
    vi.unstubAllEnvs()

    vi.stubEnv('NODE_ENV', 'production')
    expect(getDefaultTransformerConfig().disabled).toBe(false)
    vi.unstubAllEnvs()

    if (originalEnv !== undefined) {
      process.env['NODE_ENV'] = originalEnv
    }
    else {
      delete process.env['NODE_ENV']
    }
  })
})

describe('createFilter', () => {
  it('case 0', () => {
    const config = getDefaultUserConfig()
    const filter = createFilter(config.transformer?.sources?.include, config.transformer?.sources?.exclude)
    expect(filter('xx/yy.js?a=1')).toBe(true)
  })
})
