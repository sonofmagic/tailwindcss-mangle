module.exports = {
  root: true,
  extends: ['@icebreakers/eslint-config-ts', 'plugin:unicorn/recommended'],
  rules: {
    'unicorn/prefer-module': 0,
    'unicorn/prevent-abbreviations': 0,
    'unicorn/filename-case': 0,
    'unicorn/no-object-as-default-parameter': 0,
    'unicorn/no-null': 0
  }
}
