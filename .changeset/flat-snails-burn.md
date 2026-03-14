---
'@tailwindcss-mangle/config': patch
'tailwindcss-patch': patch
---

Restore automatic Tailwind CSS major version detection when `registry.tailwindcss.version` is omitted, while keeping strict validation for explicitly configured versions. This also removes the default config value that forced version `4` during install-time prepare scripts in Tailwind v3 demo apps.
