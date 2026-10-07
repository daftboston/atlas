# Atlas

Atlas is a speaking-first language learning app for iOS, built with Expo SDK 57 / React Native. Sessions are short and spoken: you hear a phrase, say it aloud, get immediate feedback, and Atlas schedules the next review right before you would forget it. Completing short speaking practice can earn a temporary screen-time unlock. The unlock reinforces the daily habit; it is never the product and never stands in for learning.

**This file is the entry point. The docs in this GitHub repo are the source of truth.** Any older local `ATLAS.md`, `beginner-build-guide.md`, or references to the `com.atlas.app` bundle ID are superseded by this file and `docs/`.

| Doc | What it covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Routes, layers, folder layout, speech and Screen Time service contracts, languages |
| [`docs/learning-loop.md`](docs/learning-loop.md) | Entities (SQLite tables), FSRS scheduling, session rules, feedback, unlocks, seed schema, open questions |
| [`docs/roadmap.md`](docs/roadmap.md) | Planned languages and the language-agnostic engineering requirement |
| [`content/seed/seed-phrases-v0.json`](content/seed/seed-phrases-v0.json) | The v0 deck: 60 Spanish phrases, A1–A2 |
| [`AGENTS.md`](AGENTS.md) | Rules for coding agents working in this repo |

## v0 scope

- **One course: English speakers learning Spanish.** The UI is in English. No other source or target languages in v0.
- **General/neutral Spanish.** Each phrase has one canonical target; regional variants (and formal/informal, gendered, digit forms) are accepted as answers.
- **Speech locale:** `es-MX` by default, `es-ES` selectable.
- **On-device speech recognition + text-match scoring.** No cloud scoring in v0 (a possible v1 opt-in).
- **Typed answers are allowed** as a fallback and **count toward unlocks**. They cap at a "Good" rating, so speaking stays the best path.
- **Local-only, single user, single device.** No accounts, no sync.
- **No audio retention.** Recordings are never kept.

Details: [learning-loop §10](docs/learning-loop.md#10-open-questions-and-decisions).

## Roadmap languages

After Spanish: **Japanese (ja-JP), Korean (ko-KR), French (fr-FR)**, in no fixed order yet. The schema and scorer must be language-agnostic from v0: adding a language means new content plus a config entry, with no schema migration and no scorer rewrite. See [`docs/roadmap.md`](docs/roadmap.md).

## Constraints

- **Bundle ID `daft.atlas`** (iOS and Android), with `com.daft.atlas` as the fallback. Don't use any other ID.
- **Simulator-first.** There is no physical iPhone and no paid Apple Developer account yet. Target the iOS Simulator with a development build (`npx expo run:ios` or `eas build --profile development`). Don't assume Expo Go, device signing, or TestFlight.
- **Family Controls / Screen Time is deferred.** It stays behind a stub (`unavailable` by default). Don't add the entitlement or any native target yet. Unlocks are still earned and shown as a visible timer.

## Current build state

This is what's on `main` today (PR #1 foundation + PR #2 first lesson + the `src/` layout move + on-device persistence):

- Foundation: bundle ID `daft.atlas`, EAS config, dev client, ESLint, TypeScript typecheck, Jest + Testing Library, `expo-build-properties` with iOS scene support enabled.
- Layout: app code lives under `src/` and the `@/*` alias points to `./src/*` ([architecture §5.1](docs/architecture.md#51-migrating-from-the-template-layout)). Routes stay in `app/` at the repo root. The folder map is in [`AGENTS.md`](AGENTS.md#folder-layout).
- Routes: every route in [architecture §3](docs/architecture.md#3-route-map-expo-router-root-app) exists. Tabs are **Learn**, **Review**, **Unlock**, **Settings**. The `(onboarding)` stack, **Unlock**, `practice/[sessionId]` and `practice/summary/[sessionId]` are placeholders that say they're not built yet, and the onboarding gate isn't wired up.
- Learn shows the single course ("You speak English, you're learning Spanish") with a Continue button, then one **sample lesson**: seed item `es-v0-001`, "Hola" ("Hello"), from the seed deck. Saving it marks it *ready to review* (not mastered), and the **Review** tab lists it.
- **Persistence:** the chosen course and saved words are stored on the device with `expo-sqlite` + Drizzle and survive restarts. Tables so far: `courses`, `knowledge_items`, `app_settings` ([learning-loop §3](docs/learning-loop.md#3-entities-sqlite-tables-drizzle)), plus `saved_words`, which keeps the saved-word fields §3 has no column for. On every launch the app applies migrations and seeds the v0 course and all 60 seed phrases idempotently.
- **What it doesn't do yet:** there is only the sample lesson, with no real lesson list (the 60 seed phrases are in the database but nothing shows them yet). There is **no audio** (no TTS, no mic), **no scoring**, **no review queue**, and **no app lock / unlock**.

## Next work, in order

1. **Listening & speaking.** TTS playback and mic capture through the speech service contract ([architecture §6](docs/architecture.md#6-speech-service-contract)), with on-device STT and text-match scoring, and the mock implementation for the simulator and tests.
2. **Real lesson list** built from [`content/seed/seed-phrases-v0.json`](content/seed/seed-phrases-v0.json), already loaded idempotently into SQLite ([learning-loop §11](docs/learning-loop.md#11-seed-content-schema-contentseedseed-phrases-v0json)).
3. **Review & unlock.** FSRS review queue, session rules, and unlock grants ([learning-loop §4–8](docs/learning-loop.md#4-scheduling-algorithm-fsrs-recommended-over-sm-2)), with the Screen Time **stub** only ([architecture §7](docs/architecture.md#7-screen-time-service-contract-stub-able)).

## Workflow rules

- **Branch from the updated `main`:** `git fetch && git switch -c daniel/<short-description> origin/main` (agents use their own branch name, also from the updated `main`). Never push to `main` directly.
- Use Node 22 (`.nvmrc`) and install with `npm ci`.
- Before opening a PR, run and pass `npm run lint`, `npm run typecheck`, and `npm test`. After any dependency change, also run `npm run doctor`.
- Open the PR with `gh pr create --fill`. The lead reviews and merges.
- **No new dependencies without lead approval.** Once one is approved, add it with `npx expo install`.
- **Read the Expo SDK 57 docs** (https://docs.expo.dev/versions/v57.0.0/) before touching any Expo, EAS, or React Native API. Don't rely on memory, because APIs change every SDK.
