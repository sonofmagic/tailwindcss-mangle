import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*', '!packages/unplugin-tailwindcss-mangle', '!packages/tailwindcss-patch'])
