import { pkgName } from './constants'

export function log(message?: any, ...optionalParams: any[]) {
  return console.log(`[${pkgName}]:` + message, ...optionalParams)
}
