import { parse } from '@vue/compiler-sfc'

export function vueHandler(raw: string) {
  parse(raw)
}
