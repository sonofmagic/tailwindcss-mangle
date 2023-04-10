import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'

export default createUnplugin<Options | undefined>((options) => ({
  name: pluginName,
  enforce: 'post',
  transformInclude(id) {
    return id.endsWith('main.ts')
  },
  transform(code, id) {
    return code.replace('__UNPLUGIN__', `Hello Unplugin! ${options}`)
  }
}))
