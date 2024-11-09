---
"@tailwindcss-mangle/core": patch
---

feat: add `twIgnore` for ignore mangle


## Example

### Input

```js
const twIgnore = String.raw
const className =  `${twIgnore`gap-y-4`} bg-zinc-800/30` 
```

### Output

```js
const twIgnore = String.raw
const className =  `${twIgnore`gap-y-4`} tw-a` 
```