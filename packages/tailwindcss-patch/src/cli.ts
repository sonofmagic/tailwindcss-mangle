import { createPatch, getPatchOptions } from './core/patcher'
const opt = getPatchOptions()
const patch = createPatch(opt)
patch()
