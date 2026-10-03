# pnpm Change Intents

This directory stores native pnpm change intents and release history. It keeps the familiar Changesets Markdown frontmatter format, but versioning is configured in `pnpm-workspace.yaml` and releases are orchestrated by repoctl.

Record a publishable change with:

```sh
pnpm change
```

For automation, specify the affected packages, bump type, and release note:

```sh
pnpm change --bump patch --summary "Fix class extraction" tailwindcss-patch
```

Use `pnpm release:plan` (`repo release plan --json`) to inspect the plan without preparing or publishing a release. The Release workflow consumes intents, updates versions and changelogs, and preserves pnpm's release ledger. Keep existing intent files and history; do not restore a Changesets `config.json` or run the legacy Changesets CLI.

See [the release policy](../docs/release/release-group-policy.md) for the complete validation gate and supported release lanes.
