import { defineMonorepoConfig } from 'repoctl'

export default defineMonorepoConfig({
  commands: {
    create: {
      defaultTemplate: 'tsdown',
      renameJson: false,
    },
    clean: {
      autoConfirm: false,
      includePrivate: true,
    },
    upgrade: {
      skipOverwrite: false,
      mergeTargets: true,
    },
    release: {
      branches: {
        stable: 'main',
        prerelease: [
          { branch: 'alpha', lane: 'alpha', tag: 'alpha', target: 'main' },
          { branch: 'beta', lane: 'beta', tag: 'beta', target: 'main' },
          { branch: 'rc', lane: 'rc', tag: 'rc', target: 'main' },
          { branch: 'next', lane: 'next', tag: 'next', target: 'main' },
        ],
      },
      qualityScripts: ['release:verify'],
    },
  },
  tooling: {
    eslint: {
      ignores: ['**/fixtures/**', 'website/public/_pagefind'],
      configs: [
        {
          rules: {
            'dot-notation': 'off',
            'prefer-arrow-callback': 'off',
          },
        },
      ],
    },
    stylelint: {
      overrides: [
        {
          files: ['**/*.module.css'],
          rules: {
            'selector-class-pattern': null,
          },
        },
      ],
    },
    lintStaged: {
      repoCommand: 'pnpm exec repo',
    },
    vitest: {
      projectRoots: ['packages'],
      includeWorkspaceRootConfig: false,
      configCandidates: [
        'vitest.config.ts',
        'vitest.config.mts',
        'vitest.config.cts',
        'vitest.config.js',
        'vitest.config.cjs',
        'vitest.config.mjs',
      ],
      coverageEnabled: true,
      coverageSkipFull: true,
      coverageExclude: ['**/dist/**'],
    },
    vitestProject: {
      globals: true,
      testTimeout: 60_000,
    },
  },
})
