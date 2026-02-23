---
"tailwindcss-patch": patch
---

Remove legacy source-level CLI compatibility shims and standardize internal imports on `src/commands/*`.

- Remove `src/cli/commands.ts` and `src/cli/migrate-config.ts` compatibility shim files.
- Update internal tests and command wiring to import directly from `src/commands/*`.
- Keep public package API and CLI behavior unchanged.
