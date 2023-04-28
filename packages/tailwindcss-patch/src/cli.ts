import { createPatch, getPatchOptions } from './patcher'
const opt = getPatchOptions()
const patch = createPatch(opt)
patch()
