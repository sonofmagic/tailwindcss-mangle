# @tailwindcss-mangle/core

## 4.1.0

### Minor Changes

- [`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support tailwindcss@4.1.1

### Patch Changes

- Updated dependencies [[`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019)]:
  - @tailwindcss-mangle/config@5.1.0
  - @tailwindcss-mangle/shared@4.1.0

## 4.0.9

### Patch Changes

- Updated dependencies [[`0651cae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0651cae4e5d3544b5265278a1dfb44d8a4e3f2f8)]:
  - @tailwindcss-mangle/config@5.0.6

## 4.0.8

### Patch Changes

- Updated dependencies [[`41dc914`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41dc91418b0d36f85fddf5bfcd078fa1a90986a8)]:
  - @tailwindcss-mangle/config@5.0.5

## 4.0.7

### Patch Changes

- [`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump deps and add patch only for tailwindcss v2 and v3

- Updated dependencies [[`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6)]:
  - @tailwindcss-mangle/config@5.0.4
  - @tailwindcss-mangle/shared@4.0.2

## 4.0.6

### Patch Changes

- Updated dependencies [[`e87d048`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e87d048324ca80ccef69902ab45e4d0c993f06fa)]:
  - @tailwindcss-mangle/config@5.0.3

## 4.0.5

### Patch Changes

- Updated dependencies [[`78c0297`](https://github.com/sonofmagic/tailwindcss-mangle/commit/78c02972f17865d489e66274086bcf11860689eb)]:
  - @tailwindcss-mangle/config@5.0.2

## 4.0.4

### Patch Changes

- Updated dependencies [[`a8ba17e`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a8ba17e8e676602f8d724ee3b08cc83ad6654192)]:
  - @tailwindcss-mangle/config@5.0.1

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
