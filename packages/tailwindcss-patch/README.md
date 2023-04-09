# tailwindcss-patch

get tailwindcss context at runtime!

## Setup

1. Install package

```sh
<yarn|npm|pnpm> add -D ts-patch
```

2. Patch tailwindcss

```sh
npx tw-patch
```

3. Add `prepare` script (keeps patch persisted after npm install)

`package.json`

```json
{
 /* ... */
 "scripts": {
   "prepare": "tw-patch"
 }
}
```
