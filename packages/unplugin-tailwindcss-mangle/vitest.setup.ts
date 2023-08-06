// import 'tailwindcss-patch/cli'
import { createPatch, getPatchOptions } from 'tailwindcss-patch'
const opt = getPatchOptions()
const patch = createPatch(opt)
patch()
