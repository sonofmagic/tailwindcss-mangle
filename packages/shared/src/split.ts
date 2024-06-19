// eslint-disable-next-line regexp/no-obscure-range
export const validateFilterRE = /[\w\u00A0-\uFFFF%-?]/

export function isValidSelector(selector = ''): selector is string {
  return validateFilterRE.test(selector)
}

export function splitCode(code: string, options: {
  splitQuote?: boolean
} = { splitQuote: true }) {
  const regex = options.splitQuote ? /[\s"]+/ : /\s+/
  return code.split(regex).filter(x => isValidSelector(x))
}
