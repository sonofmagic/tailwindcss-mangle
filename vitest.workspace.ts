import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*', '!packages/tailwindcss-patch'])
