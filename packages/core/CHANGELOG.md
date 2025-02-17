# @tailwindcss-mangle/core

## 4.0.3

### Patch Changes

- Updated dependencies [[`362bd49`](https://github.com/sonofmagic/tailwindcss-mangle/commit/362bd496d40810b8f69c4789900117f83c9c4692)]:
  - @tailwindcss-mangle/config@5.0.0

## 4.0.2

### Patch Changes

- [`ba35630`](https://github.com/sonofmagic/tailwindcss-mangle/commit/ba3563015630cddd38eb188493878852ceb026a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add `twIgnore` for ignore mangle

  ## Example

  ### Input

  ```js
  const twIgnore = String.raw;
  const className = `${twIgnore`gap-y-4`} bg-zinc-800/30`;
  ```

  ### Output

  ```js
  const twIgnore = String.raw;
  const className = `${twIgnore`gap-y-4`} tw-a`;
  ```

## 4.0.1

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1
  - @tailwindcss-mangle/shared@4.0.1

## 4.0.1-alpha.0

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1-alpha.0
  - @tailwindcss-mangle/shared@4.0.1-alpha.0

## 4.0.0

### Major Changes

- [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/config@4.0.0
  - @tailwindcss-mangle/shared@4.0.0

## 4.0.0-alpha.0

### Major Changes

- [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/config@4.0.0-alpha.0
  - @tailwindcss-mangle/shared@4.0.0-alpha.0

## 2.3.0

### Minor Changes

- 3c2d2b9: fix(tailwindcss-patch): monorepo basedir option
