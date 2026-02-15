---
"tailwindcss-patch": patch
---

Add layered validate exit codes for CI diagnostics.

- classify `tw-patch validate` failures into report incompatibility, missing backups, I/O, and unknown errors
- expose `VALIDATE_EXIT_CODES` and `ValidateCommandError` for host integrations
- set process exit code from validate failures in the standalone CLI entry
