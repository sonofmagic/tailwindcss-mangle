---
"tailwindcss-patch": patch
---

Make `tw-patch migrate` file writes transactional by default.

- rollback already written migration files when a later write fails
- improve migration error messages to include rollback status
- add tests covering failure rollback behavior
