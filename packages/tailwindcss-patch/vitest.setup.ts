// import 'tailwindcss-patch/cli'
import { createPatch, getPatchOptions } from './dist'
const opt = getPatchOptions()
const patch = createPatch(opt)
patch()
