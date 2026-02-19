# tailwindcss-patch

## 8.7.1

### Patch Changes

- 🐛 **tailwindcss-patch: add broader unit coverage for @tailwindcss/node@4.2.0 utility families, variants, fallback base loading, and `@source inline()` parsing.** [`db582e3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/db582e309a45965e51090c6c13fab0bf4f8fea41) by @sonofmagic

## 8.7.0

### Minor Changes

- ✨ **Introduce context-aware cache governance for `tailwindcss-patch` with schema v2 isolation and explicit cache management APIs.** [`24ebd4b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/24ebd4b4ad08c0aaeb0a5a7b106558cb008c39a0) by @sonofmagic
  - add context fingerprint based cache isolation (cwd/config/package/options/version) to prevent cross-project cache pollution in monorepos
  - upgrade cache index schema to include `schemaVersion` and per-context metadata, with safe legacy fallback and lazy rebuild behavior
  - add `TailwindcssPatcher#clearCache(options?)` to clear current context (default) or all cache contexts with removal statistics
  - improve cache observability via debug logs that explain hit/miss reasons and mismatch details
  - harden file cache writes with lock-file coordination plus atomic temp-file rename for concurrent writers
  - add coverage for same-project hit, cross-project isolation, config/version invalidation, clearCache scopes, legacy schema handling, and concurrent writes

- ✨ **Add `tw-patch migrate` to automatically rewrite deprecated config keys to the modern option shape.** [`64820ed`](https://github.com/sonofmagic/tailwindcss-mangle/commit/64820ed0343c658fe94121a164def0546a65b2b3) by @sonofmagic
  - introduce a migration engine for `tailwindcss-patch.config.*` and `tailwindcss-mangle.config.*`
  - support dry-run previews via `tw-patch migrate --dry-run`
  - migrate common legacy keys such as `output` -> `extract`, `tailwind` -> `tailwindcss`, `overwrite` -> `apply.overwrite`, plus nested legacy aliases
  - include migration summaries to explain per-file changes

- ✨ **Redesign `TailwindcssPatcher` options to a simpler, migration-friendly shape while preserving backward compatibility.** [`a9172ef`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a9172efbad8a337456ebc3d254e79b51f9d53169) by @sonofmagic
  - add modern constructor fields:
    - `projectRoot` (replaces `cwd`)
    - `tailwindcss` (replaces `tailwind`)
    - `apply` (replaces `overwrite` + `features`)
    - `extract` (replaces `output`)
  - keep existing fields working, but mark legacy fields with `@deprecated` JSDoc and document planned removal in the next major release
  - make option normalization prefer modern fields when both modern and legacy values are provided
  - update legacy/unified config conversion and CLI overrides to emit the modern option shape

- ✨ **Add `tw-patch restore` command to recover configs from migration backups.** [`277acbd`](https://github.com/sonofmagic/tailwindcss-mangle/commit/277acbdb549534f81bf46bf688345d5eb8861e9e) by @sonofmagic
  - introduce `restore` command with `--report-file`, `--dry-run`, `--strict`, and `--json`
  - add restore core API that replays `backupFile` entries from migration reports
  - include tests for restore success, dry-run behavior, and strict missing-backup failures

### Patch Changes

- 🐛 **Improve `tw-patch migrate` with CI-friendly and machine-readable output modes.** [`d93110a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/d93110ad5c43715e729c4608a77bad11fc36a805) by @sonofmagic
  - add `--check` to fail when migration changes are still required
  - add `--json` to print structured migration reports
  - make `--check` run in dry-run mode automatically

- 🐛 **Add a reusable GitHub Actions template for migration report validation.** [`c1ce57b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/c1ce57bc37021618c0529e4136632925b3dd71f4) by @sonofmagic
  - add `packages/tailwindcss-patch/examples/github-actions/validate-migration-report.yml`
  - document how to map validate exit codes (`21/22/23/24`) in CI workflows
  - link the example template from README and migration notes

- 🐛 **Improve CI template maintainability with a testable affected-shard resolver and workflow linting.** [`4a2f00b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4a2f00b02ccfb1862612584236dfb5c9f422bf49) by @sonofmagic
  - extract affected-shard detection logic to `examples/github-actions/scripts/resolve-shards.mjs`
  - add unit tests covering resolver behavior and output contract
  - add `.github/workflows/workflow-lint.yml` to lint workflow templates and verify local template wiring

- 🐛 **Expose migration report types and publish a JSON schema.** [`1ed3b24`](https://github.com/sonofmagic/tailwindcss-mangle/commit/1ed3b241b7db6819d94454234fd31b5dac2b111a) by @sonofmagic
  - export migration report helpers, constants, and related types from the package entry
  - publish `tailwindcss-patch/migration-report.schema.json` as a stable schema subpath
  - add tests to verify schema availability and alignment with exported constants

- 🐛 **Add a PR diff-aware GitHub Actions template for migration report validation in monorepos.** [`fefc69a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/fefc69a0a59d2bb70c8a25a03634fc193cc765ab) by @sonofmagic
  - add `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-affected.yml`
  - detect affected shards from pull request file changes and only run required shards
  - add docs links in README/README-cn and migration notes

- 🐛 **Add layered validate exit codes for CI diagnostics.** [`d143d48`](https://github.com/sonofmagic/tailwindcss-mangle/commit/d143d4896809a5383f4030c790a8337657d21d5d) by @sonofmagic
  - classify `tw-patch validate` failures into report incompatibility, missing backups, I/O, and unknown errors
  - expose `VALIDATE_EXIT_CODES` and `ValidateCommandError` for host integrations
  - set process exit code from validate failures in the standalone CLI entry

- 🐛 **Add migration report schema metadata and restore compatibility validation.** [`275c02d`](https://github.com/sonofmagic/tailwindcss-mangle/commit/275c02d42e60c797f9c7877b99bf54571f41f9d3) by @sonofmagic
  - include `reportKind`, `schemaVersion`, `generatedAt`, and `tool` metadata in `tw-patch migrate` reports
  - validate `reportKind` and `schemaVersion` in `tw-patch restore` for safer report compatibility checks
  - keep backward compatibility with legacy reports that do not include envelope metadata

- 🐛 **Publish schema for validate JSON output.** [`4fc6a94`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4fc6a94e2bbb56002d5610ca782fe71f5b7509da) by @sonofmagic
  - add `tailwindcss-patch/validate-result.schema.json` for `tw-patch validate --json`
  - include success/failure payload contracts (`ok: true` success and `ok: false` failure with `reason`, `exitCode`, `message`)
  - export `VALIDATE_FAILURE_REASONS` and align schema tests with public validate constants

- 🐛 **Refactor GitHub Actions migration-report templates to use a shared composite action.** [`8cc6dfe`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8cc6dfe25dcb9ffdde64c0b6d051a42abe71efd6) by @sonofmagic
  - add `examples/github-actions/actions/validate-migration-report/action.yml`
  - deduplicate migrate/validate shell logic across single, matrix, and affected templates
  - keep CI exit-code mapping (`21/22/23`) centralized in one reusable action

- 🐛 **Improve the affected-shards GitHub Actions template for monorepo validation.** [`41ecdc6`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41ecdc6ca548ebd5bb00eff771b714db0803d7c6) by @sonofmagic
  - add optional repo-level shard config support via `.tw-patch/ci-shards.json`
  - add base SHA fallback logic (`merge-base`) and safer run-all fallbacks when diff resolution fails
  - expand default run-all triggers for root/tooling changes
  - add `ci-shards.example.json` and document customization in README/MIGRATION

- 🐛 **Make `tw-patch migrate` file writes transactional by default.** [`8cfe325`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8cfe325b318d8186d3d1e4b69ca49c0bc38c3ed8) by @sonofmagic
  - rollback already written migration files when a later write fails
  - improve migration error messages to include rollback status
  - add tests covering failure rollback behavior

- 🐛 **Add a matrix GitHub Actions template for monorepo migration report validation.** [`4070450`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4070450a83f1ce5388556029f22846246057558e) by @sonofmagic
  - add `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-matrix.yml`
  - split validation into `root`, `apps`, and `packages` shards with per-shard artifacts
  - document single-job and matrix template choices in README and migration notes

- 🐛 **Improve the shared GitHub Actions composite action with optional environment setup controls.** [`8b3bf38`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8b3bf3805646be70592c5afd5e12c2e8d45caebf) by @sonofmagic
  - add optional inputs to `validate-migration-report` action for pnpm/node setup and dependency install
  - switch single/matrix/affected workflow templates to use action-managed setup/install
  - document new action inputs in README and migration notes

- 🐛 **Improve CI documentation with copy checklists and troubleshooting guidance.** [`b0baa22`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b0baa22085c5bf2529ee95991f5761b92ea880d5) by @sonofmagic
  - add CI copy checklists to README and README-cn covering required workflow/action/resolver files
  - add troubleshooting notes for common migration-report CI failures and local action wiring issues
  - record the documentation update in migration notes

- 🐛 **Add modern `defineConfig` registry support and bridge it end-to-end into `tailwindcss-patch`.** [`27c4976`](https://github.com/sonofmagic/tailwindcss-mangle/commit/27c4976173ea650daa417bbf857890feb69630c2) by @sonofmagic
  - extend `@tailwindcss-mangle/config` `RegistryOptions` to support modern fields: `projectRoot`, `tailwindcss`, `apply`, `extract`, `cache`, and `filter`
  - keep legacy `registry.output` and `registry.tailwind` available with deprecation annotations
  - update `initConfig` and default registry shape to include modern `extract`/`tailwindcss` keys
  - update `tailwindcss-patch` unified config mapping to read both modern and legacy registry fields, preferring modern values when both are present

- 🐛 **Add a migration report validation CLI command.** [`f69f17c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/f69f17ceba9dfc858b855d873c1cb8a156215649) by @sonofmagic
  - introduce `tw-patch validate` to verify migration report compatibility without restoring files
  - reuse restore dry-run checks for schema validation and backup reference scanning
  - support `--report-file`, `--strict`, and `--json` for validation workflows

- 🐛 **Enhance `tw-patch migrate` for monorepo workflows with recursive workspace scanning.** [`cac638a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/cac638ade1d20aa7029985e45c301dacc3f51f53) by @sonofmagic
  - add `--workspace` to discover `tailwindcss-patch.config.*` and `tailwindcss-mangle.config.*` in sub-projects
  - add `--max-depth` to control recursion depth (default `6`)
  - ignore common generated folders such as `node_modules`, `.git`, and `dist` during workspace scans

- 🐛 **Improve restore JSON observability for migration reports.** [`0f472ae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0f472ae731f6406d1e7d7dbd40d1c0ebf9dcc755) by @sonofmagic
  - expose `reportKind` and `reportSchemaVersion` in `tw-patch restore --json` output when report metadata is present
  - keep compatibility with legacy reports that do not contain schema metadata
  - add unit tests for metadata and legacy restore report behavior

- 🐛 **Publish JSON schema for restore and validate outputs.** [`4e0ffcd`](https://github.com/sonofmagic/tailwindcss-mangle/commit/4e0ffcdd3b218aad1447e7ca6ebe292aefcffc88) by @sonofmagic
  - add `tailwindcss-patch/restore-result.schema.json` for `tw-patch restore --json` and `tw-patch validate --json`
  - expose the schema through package exports (source and publish configs)
  - add tests and docs to keep schema fields aligned with public report constants

- 🐛 **Add backup snapshot support for `tw-patch migrate`.** [`d30bdd4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/d30bdd4f4fcfbce7f0e8e1f9ea2436aee498e9f9) by @sonofmagic
  - introduce `--backup-dir` to save pre-migration file snapshots
  - include backup metadata in migration reports
  - extend tests to cover backup output paths and content

- 🐛 **Extend `tw-patch migrate` with scan filtering and report persistence.** [`487741a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/487741af691f29ef8fbeeeb2b4cc670aa19d45a6) by @sonofmagic
  - add `--include` and `--exclude` glob filters for migration target control
  - add `--report-file` to persist migration JSON reports
  - keep compatibility with existing `--workspace`, `--check`, and `--backup-dir` flows

- 🐛 **Add a stable JSON contract for affected-shard resolver outputs and enforce it in CI.** [`e6cdcc2`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e6cdcc2bf4b9699a2d24c95dde5112d376162003) by @sonofmagic
  - add resolver JSON output mode (`RESOLVE_SHARDS_OUTPUT=json`) in `resolve-shards.mjs`
  - add resolver output schema and workflow-dispatch snapshot fixtures
  - add contract snapshot diff check in `.github/workflows/workflow-lint.yml`
  - extend resolver tests to cover JSON contract and snapshot alignment
- 📦 **Dependencies** [`27c4976`](https://github.com/sonofmagic/tailwindcss-mangle/commit/27c4976173ea650daa417bbf857890feb69630c2)
  → `@tailwindcss-mangle/config@6.1.1`

## 8.6.1

### Patch Changes

- [`1c0405c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/1c0405c7415adc888d058668119eae35eb037d5a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Prefer CSS entry directories when resolving Tailwind v4 `@config` so relative configs are found even when a base directory is provided.

## 8.6.0

### Minor Changes

- [`c2fd4c1`](https://github.com/sonofmagic/tailwindcss-mangle/commit/c2fd4c1e237d0edf60baf7f222e81129dca0e463) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Add configurable cache drivers (file, memory, noop) while keeping the file cache as the default fallback.

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
