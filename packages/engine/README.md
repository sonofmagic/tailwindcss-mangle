# @tailwindcss-mangle/engine

Tailwind CSS candidate extraction and style generation engine for
tailwindcss-mangle.

This package contains the reusable engine pieces shared by
`tailwindcss-patch` and downstream integrations. It does not patch a local
Tailwind CSS installation or write patch artifacts by itself.

## Install

```bash
pnpm add @tailwindcss-mangle/engine
```

Tailwind CSS is a peer dependency. Install the Tailwind version that your
project needs:

```bash
pnpm add tailwindcss
```

## Usage

### Extract candidates

```ts
import { extractSourceCandidates } from "@tailwindcss-mangle/engine";

const candidates = await extractSourceCandidates(
  '<view class="text-red-500 rounded-[18px]"></view>',
  "wxml",
);

console.log(candidates);
```

Collect explicit candidates and candidates extracted from source snippets:

```ts
import { collectTailwindStyleCandidates } from "@tailwindcss-mangle/engine";

const tokens = await collectTailwindStyleCandidates({
  candidates: ["text-red-500"],
  sources: [
    {
      content: '<view class="min-h-screen rounded-[18px]"></view>',
      extension: "wxml",
    },
  ],
});
```

### Generate Tailwind v4 CSS

```ts
import { generateTailwindStyle } from "@tailwindcss-mangle/engine";

const result = await generateTailwindStyle({
  version: 4,
  css: '@import "tailwindcss";',
  candidates: ["text-red-500"],
  sources: [
    {
      content: '<view class="rounded-[18px]"></view>',
      extension: "wxml",
    },
  ],
});

console.log(result.css);
```

Reuse a Tailwind v4 compilation session when an integration needs structured
PostCSS artifacts and explicit invalidation:

```ts
import {
  createTailwindGenerationSession,
  resolveTailwindV4Source,
} from "@tailwindcss-mangle/engine";

const source = await resolveTailwindV4Source({
  projectRoot: process.cwd(),
  css: '@import "tailwindcss";',
});
const session = createTailwindGenerationSession(source);
const artifact = await session.generate({
  candidates: ["text-red-500"],
  sourceEntries: [
    {
      id: "virtual:page.wxml",
      extension: "wxml",
      content: '<view class="rounded-[18px]"></view>',
    },
  ],
});

console.log(artifact.fragments[0]?.root.toString());
session.invalidate({ type: "dependencies" });
session.dispose();
```

### Generate Tailwind v3 CSS

```ts
import { generateTailwindStyle } from "@tailwindcss-mangle/engine";

const result = await generateTailwindStyle({
  version: 3,
  candidates: ["text-red-500"],
  config: {
    corePlugins: {
      preflight: false,
    },
  },
});

console.log(result.css);
```

### Generate custom CSS

```ts
import { generateTailwindStyle } from "@tailwindcss-mangle/engine";

const result = await generateTailwindStyle({
  version: "custom",
  candidates: ["token-card"],
  generate({ tokens }) {
    return [...tokens]
      .map((token) => `.${token}{--tw-token:"${token}"}`)
      .join("\n");
  },
});
```

## Entry Points

- `@tailwindcss-mangle/engine`: public extraction and style generation APIs.
- `@tailwindcss-mangle/engine/v3`: Tailwind v3-specific style generation.
- `@tailwindcss-mangle/engine/v4`: Tailwind v4-specific source resolution and style generation.

## Development

```bash
pnpm --filter @tailwindcss-mangle/engine build
pnpm --filter @tailwindcss-mangle/engine test
pnpm --filter @tailwindcss-mangle/engine test:types
```
