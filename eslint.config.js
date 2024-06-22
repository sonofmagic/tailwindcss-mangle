import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    tailwindcss: false,
  },
  {
    ignores: ['**/fixtures/**'],
  },
)
