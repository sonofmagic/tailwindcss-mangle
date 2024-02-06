/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['icebreaker', 'plugin:prettier/recommended'],
  rules: {
    'unicorn/prefer-at': 0
  }
}
