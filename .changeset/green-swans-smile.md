---
'tailwindcss-patch': patch
---

Fix workspace installs for monorepo consumers by making the local `tailwindcss-patch` entrypoint usable before `dist` is built. This keeps app-level `prepare` scripts working during fresh installs while preserving published package outputs via `publishConfig`.
