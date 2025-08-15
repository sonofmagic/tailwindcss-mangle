import { defineConfig } from 'vitest/config'

export default defineConfig(
  () => {
    return {
      test: {
        projects: [
          'packages/*',
          // 'apps/*',
        ],
        coverage: {
          enabled: true,
          all: false,
          skipFull: true,
        },
        forceRerunTriggers: [
          '**/{vitest,vite}.config.*/**',
        ],
      },
    }
  },
)
