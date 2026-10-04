import { patchPostcssPluginNative, patchReturnContextNative } from '@tailwindcss-mangle/native'

export interface ExposeContextTransformOptions {
  refProperty: string
}

export function transformProcessTailwindFeaturesReturnContext(content: string) {
  const { code, hasPatched } = patchReturnContextNative(content)
  return { code, hasPatched }
}

export function transformPostcssPlugin(content: string, { refProperty }: ExposeContextTransformOptions) {
  const { code, hasPatched } = patchPostcssPluginNative(content, refProperty, 3)
  return { code, hasPatched }
}
