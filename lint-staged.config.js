export default {
  '*.{js,jsx,mjs,ts,tsx,mts}': [
    'eslint --fix',
  ],
  '*.vue': [
    'eslint --fix',
    'stylelint --fix --allow-empty-input',
  ],
  '*.{json,md,mdx,html,yml,yaml}': [
    // 'prettier --with-node-modules --ignore-path .prettierignore --write',
    'eslint --fix',
  ],
  '*.{css,scss,sass,less}': [
    'stylelint --fix --allow-empty-input',
  ],
  // for rust
  // '*.rs': ['cargo fmt --'],
}
