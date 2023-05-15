export const validateFilterRE = /[\w\u00A0-\uFFFF-_:%-?]/

export function isValidSelector(selector = ''): selector is string {
  return validateFilterRE.test(selector)
}

export const splitCode = (
  code: string,
  options: {
    splitQuote?: boolean
  } = { splitQuote: true }
) => {
  const regex = options.splitQuote ? /[\s"]+/ : /[\s]+/
  return code.split(regex).filter(isValidSelector)
}
