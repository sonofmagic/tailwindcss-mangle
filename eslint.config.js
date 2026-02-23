import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    ignores: ['**/fixtures/**', 'website/public/_pagefind'],
  },
  {
    rules: {
      'dot-notation': 'off',
      'prefer-arrow-callback': 'off',
    },
  },
)
