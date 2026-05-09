# Knowledge Connect (وصلة المعرفة)

Interactive classroom team quiz game — React + TypeScript + Vite frontend with Firebase Realtime Database for all state management.

## Cursor Cloud specific instructions

### Services

| Service | Command | Notes |
|---------|---------|-------|
| Vite Dev Server | `pnpm dev` | Starts on port 3000 with HMR. `--host` flag is already included in the script. |

### Key commands

- **Type check:** `pnpm check` (runs `tsc --noEmit`)
- **Format:** `pnpm format` (runs `prettier --write .`); use `pnpm prettier --check .` for a dry-run
- **Build:** `pnpm build` (Vite client build + esbuild server bundle into `dist/`)
- **Dev server:** `pnpm dev` (Vite on port 3000)

No `lint` or `test` scripts are defined. `vitest` is in devDependencies but no test files exist yet.

### Firebase dependency

All game state is stored in Firebase Realtime Database. The app requires seven `VITE_FIREBASE_*` environment variables in a root `.env` file (see `README.md` § "إعداد Firebase"). Without them the app loads but shows a configuration notice on the host page and returns user-friendly errors on join/participant pages. The `isFirebaseConfigured()` guard in `client/src/lib/firebase.ts` controls this behavior.

### Codebase layout

- `client/` — React SPA (Vite root is `client/`, path alias `@` → `client/src/`)
- `server/` — Minimal Express static-file server (production only)
- `shared/` — Shared constants (path alias `@shared`)
- `patches/` — pnpm patch for `wouter@3.7.1`

### Gotchas

- pnpm may warn about "ignored build scripts" for `esbuild`, `@tailwindcss/oxide`, `@firebase/util`, `protobufjs`. These packages still work correctly via pre-built binaries; do not run `pnpm approve-builds` interactively.
- Existing code has Prettier formatting issues (89 files). This is the baseline state — do not reformat the entire codebase.
- The Vite config includes third-party plugins (`vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`) that are non-essential for local dev and run without configuration.
