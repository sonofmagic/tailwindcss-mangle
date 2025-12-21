# tailwindcss-patch

## 8.5.1

### Patch Changes

- [`edd1171`](https://github.com/sonofmagic/tailwindcss-mangle/commit/edd11710d93825ec05d5c0e401f893ca93bbd519) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Gracefully skip cache updates when the cache file is locked on Windows to avoid EPERM failures.

## 8.5.0

### Minor Changes

- [`5b11714`](https://github.com/sonofmagic/tailwindcss-mangle/commit/5b1171478412dc53a94109792bc3aeef50399442) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Add CLI/API support for reporting which Tailwind patches are applied or pending.

## 8.4.3

### Patch Changes

- [`0b484c1`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0b484c187257ccdbe04224280a77174330341ce6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- [`6542453`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6542453f28ea5bb6f6e90023ad93f557524afb80) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Fix `getClassSetSync()` returning an empty set before Tailwind v3 contexts are ready so runtime collectors fall back to the async extraction path instead of skipping class discovery.

## 8.4.2

### Patch Changes

- [`6bd5faa`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6bd5faa394ce5612ee5c9e2951d828eb585636ff) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix cache store to write through temp files and rename atomically so concurrent patchers never read truncated JSON

## 8.4.1

### Patch Changes

- [`e5c8155`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e5c8155afc6ee30b311b9fb90616d2560a5fa2cc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Ensure TailwindcssPatcher uses the workspace root as the default v4 source when cssEntries point at empty folders so extract() still reports runtime classes in v4 mode.

- [`4df42ed`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4df42ed3bc3006ce643206f5781314da17876b74) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Stop logging cache warnings when the Tailwind class cache file is missing so repeated builds on Windows no longer show ENOENT errors.

## 8.4.0

### Minor Changes

- [`9105a4a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/9105a4a59fa20fb2fa0171562206648d2de71d45) Thanks [@sonofmagic](https://github.com/sonofmagic)! - expose hookable CLI command registration so host CLIs can customize command lifecycles, descriptions, and options without reimplementing tw-patch wiring

## 8.3.0

### Minor Changes

- [`6353ff5`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6353ff530064e086efc89d9e4950d00e6abe66b3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Expose helpers to mount the Tailwind CSS patch CLI inside other `cac` apps with prefixed or renamed commands.

## 8.2.4

### Patch Changes

- [`1af573b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/1af573b1cce1b1447f871943aae939e2a1202511) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Ensure Tailwind v4 CSS entries resolve `@config` paths relative to each CSS file when no explicit base is provided.

## 8.2.3

### Patch Changes

- [`fc73e30`](https://github.com/sonofmagic/tailwindcss-mangle/commit/fc73e304bb67a7df926228f261cc846ed1f81ddd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Ensure Tailwind v4 candidate extraction only keeps class names that compile to CSS so HTTP header literals like `text/event-stream` no longer leak into the runtime class set.

## 8.2.2

### Patch Changes

- Updated dependencies [[`6799e3b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6799e3b319ed27f227f698c7971256fc427921f7)]:
  - @tailwindcss-mangle/config@6.1.0

## 8.2.1

### Patch Changes

- Updated dependencies [[`ba12f2a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/ba12f2afd8321e03d55f9f7b8cd5e60bf93da85d)]:
  - @tailwindcss-mangle/config@6.0.1

## 8.2.0

### Minor Changes

- [`d516eeb`](https://github.com/sonofmagic/tailwindcss-mangle/commit/d516eeb8cbe7f4d7ac2e099a1ef330816ed986b6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Add grouped token exports, sanitized file metadata, and CLI options for the new token reporting flow.

## 8.1.0

### Minor Changes

- [`91f408c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/91f408cb4a010f1f339cf0469912a1006ad1d35c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Add `getClassSetSync` along with synchronous cache utilities so consumers that cannot await the async API can still collect Tailwind classes.

## 8.0.0

### Major Changes

- [`0e36bfe`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0e36bfe49c9d1e68d760759f54c80b80b9cc21f9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - refactor!: redesign the patcher architecture, CLI surface, and documentation while adding Tailwind CSS v4 extraction support. Legacy APIs are wrapped for compatibility but consumers should migrate to the new entry points.

- [`18a8c3c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/18a8c3c1ef704acd2b68dd93ac31f57d403fd8ed) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Adopt a unified `registry`/`transformer` configuration surface across the toolchain, update runtime consumers and tests to the new API, and refresh docs and examples to match the renamed options.

### Patch Changes

- Updated dependencies [[`18a8c3c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/18a8c3c1ef704acd2b68dd93ac31f57d403fd8ed)]:
  - @tailwindcss-mangle/config@6.0.0

## Unreleased

- refactor: rebuild around the new `TailwindcssPatcher` API, explicit module boundaries (`api/`, `patching/`, `runtime/`, `options/`, `extraction/`).
- feat: add Tailwind CSS v4 class discovery plus configurable output formats (`json` or newline delimited).
- feat: expose helpers such as `CacheStore`, `normalizeOptions`, and v4 candidate scanners as public exports.
- docs: add `MIGRATION.md` and refresh both README variants to describe the new workflow and CLI flags.

## 7.1.6

### Patch Changes

- [`6596fae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6596fae09395e1d92f2dc9244586fe05366aa42b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(tailwindcss-patch): make @tailwindcss/node as dependencies

- Updated dependencies [[`6596fae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6596fae09395e1d92f2dc9244586fe05366aa42b)]:
  - @tailwindcss-mangle/config@5.1.2

## 7.1.5

### Patch Changes

- [`4e2841b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4e2841b0f8b7808e66829a4f7578e2ae9cd37195) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 7.1.4

### Patch Changes

- [`2221792`](https://github.com/sonofmagic/tailwindcss-mangle/commit/22217922be9b2cb0f1cef669162fae11e9e251b7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add `patchOptions#cwd` option

## 7.1.3

### Patch Changes

- [`f74a624`](https://github.com/sonofmagic/tailwindcss-mangle/commit/f74a624f29a061542e69a72c5211a8dcb7fd2d99) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: extract always return classSet

## 7.1.2

### Patch Changes

- [`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(patch): add TailwindcssPatcher extract option

  chore(deps): upgrade

- Updated dependencies [[`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace)]:
  - @tailwindcss-mangle/config@5.1.1

## 7.1.1

### Patch Changes

- [`2b91de7`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2b91de7cf94956abad7d128e5a03184305d21294) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: make cache sync and add getClassCacheSetV3 method

## 7.1.0

### Minor Changes

- [`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support tailwindcss@4.1.1

### Patch Changes

- Updated dependencies [[`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019)]:
  - @tailwindcss-mangle/config@5.1.0

## 7.0.2

### Patch Changes

- Updated dependencies [[`0651cae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0651cae4e5d3544b5265278a1dfb44d8a4e3f2f8)]:
  - @tailwindcss-mangle/config@5.0.6

## 7.0.1

### Patch Changes

- [`e7f9c6f`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e7f9c6f04e34b9ebff87ab36dc7dca8813dba888) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: cjs import from user project

## 7.0.0

### Major Changes

- [`6716921`](https://github.com/sonofmagic/tailwindcss-mangle/commit/67169214662fd2736c56a57e1cfc5905c4f658f5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add v4 SupportingCustomUnit patch

### Patch Changes

- [`41dc914`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41dc91418b0d36f85fddf5bfcd078fa1a90986a8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`41dc914`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41dc91418b0d36f85fddf5bfcd078fa1a90986a8)]:
  - @tailwindcss-mangle/config@5.0.5

## 6.0.9

### Patch Changes

- [`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump deps and add patch only for tailwindcss v2 and v3

- Updated dependencies [[`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6)]:
  - @tailwindcss-mangle/config@5.0.4

## 6.0.8

### Patch Changes

- [`daabb93`](https://github.com/sonofmagic/tailwindcss-mangle/commit/daabb9389717beaf285a107c40c0d9999ac87f5c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

## 6.0.7

### Patch Changes

- [`f603c5b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/f603c5b49f1a61e7a0b10781799f22bef7489eac) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: CacheManager read write func

## 6.0.6

### Patch Changes

- [`e87d048`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e87d048324ca80ccef69902ab45e4d0c993f06fa) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: tw-patch extract error

- Updated dependencies [[`e87d048`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e87d048324ca80ccef69902ab45e4d0c993f06fa)]:
  - @tailwindcss-mangle/config@5.0.3

## 6.0.5

### Patch Changes

- [`229b1a6`](https://github.com/sonofmagic/tailwindcss-mangle/commit/229b1a61d78065e4e24d0c59f22ad9243bd094e2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add filter option for PatchOptions

## 6.0.4

### Patch Changes

- Updated dependencies [[`78c0297`](https://github.com/sonofmagic/tailwindcss-mangle/commit/78c02972f17865d489e66274086bcf11860689eb)]:
  - @tailwindcss-mangle/config@5.0.2

## 6.0.3

### Patch Changes

- [`96075ec`](https://github.com/sonofmagic/tailwindcss-mangle/commit/96075ec887acdb3ac27ead12b00c6b3dac8447e9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: CacheManager error

## 6.0.2

### Patch Changes

- [`a8ba17e`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a8ba17e8e676602f8d724ee3b08cc83ad6654192) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: export type and add tailwindcss version config

- Updated dependencies [[`a8ba17e`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a8ba17e8e676602f8d724ee3b08cc83ad6654192)]:
  - @tailwindcss-mangle/config@5.0.1

## 6.0.1

### Patch Changes

- [`8e364e4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8e364e47a76b3e4cecfadef2f5f9602e61708a03) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: remove getClassSet params and set default patch options

## 6.0.0

### Major Changes

- [`a3214e0`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a3214e058cd1c6e691899abf4e90e62958efc268) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: prepare for tailwindcss v4

- [`362bd49`](https://github.com/sonofmagic/tailwindcss-mangle/commit/362bd496d40810b8f69c4789900117f83c9c4692) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: add tailwindcss v4 support and change getClassSet return type

  need to install `@tailwindcss/node` and `@tailwindcss/oxide`

  This is a breaking change because it changes the return type of `getClassSet`.

- [`4318d88`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4318d8808a18186d7a0676a7aad941efa25a2ff5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tailwindcss-config@1 and remove jiti and lilconfig dep

### Patch Changes

- Updated dependencies [[`362bd49`](https://github.com/sonofmagic/tailwindcss-mangle/commit/362bd496d40810b8f69c4789900117f83c9c4692)]:
  - @tailwindcss-mangle/config@5.0.0

## 5.0.2

### Patch Changes

- [`4005a83`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4005a831a3875b8069bb804a90f19f72e6cee952) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: use jiti instead of tsx

## 5.0.1

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1

## 5.0.1-alpha.0

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1-alpha.0

## 5.0.0

### Major Changes

- [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/config@4.0.0

## 5.0.0-alpha.0

### Major Changes

- [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/config@4.0.0-alpha.0

## 3.0.1

### Patch Changes

- 3c2d2b9: fix(tailwindcss-patch): monorepo basedir option

## 3.0.0

### Major Changes

- 3e7d646: support tailwindcss@2 postcss7 compat

## 2.2.4

### Patch Changes

- [`eb9d5e9`](https://github.com/sonofmagic/tailwindcss-mangle/commit/eb9d5e9fab3961f2f4899abdf0ed8864c5ad1c50) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: "npx tw-patch extract" does not look for all valid Tailwind config file paths #57

## 2.2.3

### Patch Changes

- [`cba040d`](https://github.com/sonofmagic/tailwindcss-mangle/commit/cba040df39e0a787f262787dccad0cf1feb40e2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - remove at and replace with length-1
