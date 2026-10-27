This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` (repo root) — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils, tests) outside `app/`, under `src/` (see the folder layout below).
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Atlas

Project-specific rules for this repo (override the generic guidance above where they conflict).

- **Source of truth:** [`ATLAS.md`](ATLAS.md) (project overview, v0 scope, current state, next work) and the specs in [`docs/`](docs/) (`architecture.md`, `learning-loop.md`, `roadmap.md`). Read them before starting a task. They supersede any older local `ATLAS.md`, `beginner-build-guide.md`, or `com.atlas.app` references.
- **Branching:** always branch from the updated `main` (`git fetch && git switch -c daniel/<short-description> origin/main`, or an agent branch from the same base). Never push to `main` directly. Open PRs with `gh pr create --fill`; the lead reviews and merges.
- **Simulator-first dev builds.** The owner develops on a Mac with no physical iPhone and no paid Apple Developer account. Target the iOS Simulator with a development build: `npx expo run:ios` locally, or `eas build --profile development` (the `development` profile builds for the simulator). Do not assume Expo Go, device signing, or TestFlight.
- **Bundle ID** is `daft.atlas` (iOS and Android); the fallback is `com.daft.atlas`. Do not change it.
- **FamilyControls / Screen Time is deferred.** These entitlements need a real device and a paid account. Keep any such functionality behind a stub/no-op interface until both are available; do not add the entitlement or native targets yet.
- **Before declaring a task done**, run and pass: `npm run lint`, `npm run typecheck`, `npm test` (and `npm run doctor` after dependency changes).
- **No new dependencies without lead approval.** When a dependency is approved, add it with `npx expo install`. `expo-sqlite`, `drizzle-orm` and `drizzle-kit` (dev) are approved for on-device persistence.
- Node 22 (`.nvmrc`); install with `npm ci`.

### Folder layout

The `@/*` import alias points to `./src/*` (`tsconfig.json`; Jest picks it up through `jest-expo`). This map describes what is on `main` today. The target layout, with the files still to come (`queueRepo`, `attemptRepo`, `modules/`), is in [architecture §5](docs/architecture.md#5-folder-convention).

```
app/                        Routes only. Thin: compose components, call state hooks.
  (onboarding)/             welcome, language, mic, habit, first-session, done.
  (tabs)/                   learn, review, unlock, settings.
  practice/                 [sessionId].tsx and summary/[sessionId].tsx.
src/
  components/
    ui/                     Glass.tsx (liquid-glass surfaces), Wash.tsx (background), ios.tsx (iOS-style primitives). Plain StyleSheet; no NativeWind.
    practice/               PracticeSession, SessionHome, SessionSummary, FeedbackPanel, WordDiff.
    (root)                  Template-era Themed.tsx, useColorScheme, useClientOnlyValue, plus LanguageSetup, SampleLesson, Placeholder.
  constants/Colors.ts       Harbor palette (light and dark).
  content/sample-lesson.ts  V0_COURSE and the sample lesson (teaches seed item `es-v0-001`).
  state/                    Hand-rolled useSyncExternalStore stores, not Zustand: learnerStore, sessionStore, reviewStore, settingsStore, unlockStore; bootstrap.ts (DB open, migrations, seed, hydrate), accent.ts, devSpeechScript.ts.
  domain/                   Pure TS, injected `now`, Jest-tested.
    types.ts, config.ts     Shared types and every tunable constant.
    scoring/                textMatch.ts (language-agnostic scorer), feedback.ts, types.ts.
    language/               types.ts (LanguageProfile), registry.ts, words.ts, profiles/es.ts (v0), profiles/fr.ts (test fixture).
    scheduler/              fsrs.ts (wraps ts-fsrs), grading.ts (score to rating).
    session/                buildSession.ts, sessionRules.ts.
    unlock/                 unlockRules.ts.
    memory/                 promotion.ts, suspend.ts.
    settings/               limits.ts (clamps for the settings screen).
  data/
    db.ts, client.ts        Opens expo-sqlite and applies Drizzle migrations.
    schema.ts               Drizzle tables.
    migrations/             drizzle-kit output, committed.
    repositories/           courseRepo, knowledgeRepo, learnerRepo, reviewRepo, savedWordRepo, sessionRepo, settingsRepo, unlockRepo.
    seed/                   loadSeed.ts (idempotent, keyed by seedId), seedSchema.ts, courses.ts. Imports `content/seed/seed-phrases-v0.json` (schema: learning-loop §11).
    testDatabase.ts         Test-only Drizzle driver on node:sqlite.
  services/
    speech/                 types.ts, mock.ts (default on Simulator and Jest), ios.ts (placeholder until OQ-8), registry.ts (picks the impl from EXPO_PUBLIC_SPEECH_IMPL).
    screenTime/             types.ts, stub.ts (later ios.ts, needs a real iPhone and a paid account).
  lib/                      time.ts (local-day boundary), id.ts (UUIDs via expo-crypto).
content/seed/               seed-phrases-v0.json (60 Spanish phrases).
docs/                       architecture.md, learning-loop.md, roadmap.md.
```

Persistence (on-device, expo-sqlite + Drizzle):

- `src/data/schema.ts` is the source for the tables. After changing it, run `npm run db:generate` (drizzle-kit, `driver: 'expo'`) and commit the new `.sql` file, `meta/` (journal and snapshot) and the regenerated `migrations.js` under `src/data/migrations/`. Never edit generated migrations by hand. Drizzle is pinned to the stable line (drizzle-orm 0.45.x, drizzle-kit 0.31.x).
- `.sql` migrations reach the bundle through `babel-plugin-inline-import` (`babel.config.js`) and `sourceExts.push('sql')` (`metro.config.js`), as Drizzle's Expo guide documents.
- Repositories (`src/data/repositories/`) take an `AtlasDatabase`, so the same code runs on expo-sqlite in the app and in Jest. `src/data/testDatabase.ts` (test-only) runs Drizzle's expo-sqlite driver, its migrator and the bundled `migrations.js` on top of Node's built-in `node:sqlite`, through a small adapter that supplies the synchronous expo-sqlite calls the driver uses. UI code goes through `src/state/` and never imports `src/data` directly.
- `src/state/learnerStore.ts` mirrors the learner profile and saved words from SQLite. Like the other stores in `src/state/`, it is a hand-rolled `useSyncExternalStore` store. Zustand and NativeWind are not adopted in v0 (architecture §2).
- UI tests replace the repository with `__tests__/support/memoryLearnerRepo.ts` (Jest can't run native SQLite).

Route tests live in `__tests__/` at the repo root, because Expo Router treats every file in `app/` as a route. Everything else is colocated as `*.test.ts`.
