# Contributing

## Quality Gate

Before submitting changes, make sure the relevant checks pass:

- `pnpm lint`
- `pnpm lint:style`
- `pnpm test`
- `pnpm test:types` for packages that expose public types
- the touched app/package's own TypeScript validation command (`tsc`, framework typecheck, or build)

## AI-Generated Code

AI-generated code follows the same bar as any other contribution. If an AI-assisted change introduces or touches TypeScript, ESLint, Stylelint, or public type-surface code, the corresponding checks must be run and fixed before the change is considered ready.
