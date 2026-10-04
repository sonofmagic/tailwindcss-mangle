import type { ExposeContextTransformOptions } from './postcss-v3'
import { patchPostcssPluginNative, patchReturnContextNative } from '@tailwindcss-mangle/native'

export function transformProcessTailwindFeaturesReturnContextV2(content: string) {
  const { code, hasPatched } = patchReturnContextNative(content)
  return { code, hasPatched }
}

export function transformPostcssPluginV2(content: string, options: ExposeContextTransformOptions) {
  const { code, hasPatched } = patchPostcssPluginNative(content, options.refProperty, 2)
  return { code, hasPatched }
}
