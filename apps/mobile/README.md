# apps/mobile (Expo + React Native)

This folder is deliberately empty. Expo pins React Native, React and dozens of native
modules to one SDK version, so generate the app with Expo's own tool rather than copying
a hand-written package.json that will drift out of date.

## One-time setup (Sprint 2, before story #4)

From the repo root:

```bash
pnpm dlx create-expo-app@latest apps/mobile --template blank-typescript --no-install
```

Then in `apps/mobile/package.json`:

1. Rename the package to `"name": "@loadwise/mobile"`.
2. Add scripts so Turborepo picks it up:
   ```json
   "dev": "expo start",
   "typecheck": "tsc --noEmit",
   "lint": "expo lint"
   ```
3. Add `"@loadwise/shared": "workspace:*"` to dependencies to reuse the Zod schemas.

Finally run `pnpm install` from the root and `pnpm --filter @loadwise/mobile dev`.

If Metro can't resolve workspace packages, add `node-linker=hoisted` to a root `.npmrc`
and reinstall. Record whatever you end up doing in `docs/decision-log.md`.

Planned additions: `expo-sqlite` offline queue (#6, after the Sprint 2 spike) and
Firebase Auth sign-in (#1).
