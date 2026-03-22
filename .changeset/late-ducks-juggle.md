---
'tailwindcss-patch': patch
---

Preserve original runtime candidate tokens when collecting the class set for Tailwind CSS v2/v3 projects, so shorthand and full hex arbitrary color classes remain distinct and only match when the exact source token is present.
