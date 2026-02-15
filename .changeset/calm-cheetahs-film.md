---
"tailwindcss-patch": patch
---

Improve `tw-patch migrate` with CI-friendly and machine-readable output modes.

- add `--check` to fail when migration changes are still required
- add `--json` to print structured migration reports
- make `--check` run in dry-run mode automatically
