---
"tailwindcss-patch": minor
---

Redesign `TailwindcssPatcher` options to a simpler, migration-friendly shape while preserving backward compatibility.

- add modern constructor fields:
  - `projectRoot` (replaces `cwd`)
  - `tailwindcss` (replaces `tailwind`)
  - `apply` (replaces `overwrite` + `features`)
  - `extract` (replaces `output`)
- keep existing fields working, but mark legacy fields with `@deprecated` JSDoc and document planned removal in the next major release
- make option normalization prefer modern fields when both modern and legacy values are provided
- update legacy/unified config conversion and CLI overrides to emit the modern option shape
