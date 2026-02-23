---
"tailwindcss-patch": patch
---

Refactor command-layer internals for clearer module boundaries while preserving CLI behavior.

- Split command internals into focused modules for context creation, metadata/definition resolution, migration argument parsing, and migration/status output rendering.
- Strengthen module-level coverage for CLI factory wiring, command metadata/definitions, runtime/context memoization, default handler maps, migration argument normalization, and output rendering.
- Keep public command names, options, and runtime behavior unchanged while reducing internal coupling for future maintenance.
