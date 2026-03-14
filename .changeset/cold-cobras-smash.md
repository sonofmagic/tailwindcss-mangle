---
"tailwindcss-patch": major
"@tailwindcss-mangle/config": major
---

Require modern `tailwindcss-patch` options and an explicit `tailwindcss.version`, removing support for legacy constructor aliases like `cwd`, `tailwind`, `features`, `output`, `overwrite`, and `patch`.

Workspace registry loading now rejects deprecated `registry.output`, `registry.tailwind`, and `registry.patch` fields. Use `registry.extract`, `registry.tailwindcss`, and `registry.apply` instead.

The default generated config now includes `registry.tailwindcss.version = 4`.

`@tailwindcss-mangle/config` now types only the modern `registry` shape. Deprecated aliases like `registry.output`, `registry.tailwind`, `tailwindcss.package`, `tailwindcss.legacy`, `tailwindcss.classic`, and `tailwindcss.next` are no longer part of the public type surface.
