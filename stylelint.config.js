import { icebreaker } from '@icebreakers/stylelint-config'

export default {
  ...icebreaker(),
  overrides: [
    {
      files: ['**/*.module.css'],
      rules: {
        'selector-class-pattern': null,
      },
    },
  ],
}
