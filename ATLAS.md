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

This is what's on `main` today (foundation, `src/` layout, on-device persistence, then scoring, mock speech, daily sessions, FSRS, the unlock timer, onboarding, settings and the harbor/glass theme):

- **Foundation:** bundle ID `daft.atlas`, EAS config, dev client, ESLint, TypeScript typecheck, Jest + Testing Library, `expo-build-properties` with iOS scene support enabled (Xcode 27 needs it). No CI yet.
- **Layout:** app code lives under `src/`, the `@/*` alias points to `./src/*`, and routes stay in `app/` ([architecture §5.1](docs/architecture.md#51-migrating-from-the-template-layout)). The folder map is in [`AGENTS.md`](AGENTS.md#folder-layout).
- **Routes:** every route in [architecture §3](docs/architecture.md#3-route-map-expo-router-root-app) exists. Tabs are **Learn**, **Review**, **Unlock**, **Settings**, plus the `(onboarding)` stack and the `practice/[sessionId]` and `practice/summary/[sessionId]` screens.
- **Onboarding:** welcome, language/accent (es-MX default, es-ES selectable), mic explanation, habit, a 3-item first session, done. The root layout gates the app on `onboardingCompleted`.
- **Daily session:** built from the 60-phrase seed deck (`content/seed/seed-phrases-v0.json`, loaded idempotently into SQLite on launch). The session builder mixes due reviews with up to 5 new items a day and caps the session size ([learning-loop §5](docs/learning-loop.md)).
- **Practice loop:** hear the phrase (TTS), repeat it, or type it. The answer is scored by the language-agnostic text-match scorer (`src/domain/scoring/textMatch.ts`, driven by a `LanguageProfile`; Spanish is lenient with accents and gives a spelling hint) against the target and all accepted variants. Feedback shows a word diff.
- **Mock speech:** `src/services/speech/mock.ts` is the default speech service on the Simulator and in Jest. The `ios` implementation is a placeholder with all capabilities `false` until OQ-8 (real on-device es-MX/es-ES recognition) is settled on a physical iPhone. There is no real microphone path yet.
- **Review scheduling:** FSRS through `ts-fsrs` (`src/domain/scheduler/`), with score-to-rating grading, a Review tab that lists due and upcoming items, and Long-Term Memory promotion/suspend rules.
- **Unlock timer:** finishing a session can earn a temporary unlock (10 min base, +5 for a strong session, 20 per grant, 60 per day). The Unlock tab shows it as a visible timer. Screen Time stays behind `src/services/screenTime/stub.ts` (`unavailable`); no entitlement, no native target.
- **Settings:** daily new-item limit, session size, desired retention, accent, and the other practice settings.
- **Theme:** the harbor palette and liquid-glass surfaces (`expo-glass-effect`, `expo-symbols`) in `src/components/ui/` and `src/constants/Colors.ts`.
- **State:** hand-rolled `useSyncExternalStore` stores in `src/state/` mirror SQLite. **Zustand and NativeWind are not adopted in v0**; styling is plain React Native `StyleSheet` ([architecture §4](docs/architecture.md#4-layers)).
- **Persistence:** `expo-sqlite` + Drizzle, repositories in `src/data/repositories/`, migrations committed under `src/data/migrations/`.
- **Checks:** lint, typecheck, Jest (133+ tests) and `expo-doctor` (21/21) pass on `main`.

### Known open bugs

These were found in the repo review and are being fixed in the open PRs, so don't work around them elsewhere:

- [`fix/unlock-integrity`](https://github.com/daftboston/atlas/pull/13): unlock eligibility counted wrong answers and silence (it must count graded first attempts only); "Next" worked without a real answer (it needs a graded answer or an explicit Skip); double-tapping Check saved the answer twice; the mock speech service was the default in release builds (release builds must not use it).
- Database bootstrap and the Unlock screen (separate PR): a failed database open crashes the app instead of showing an error screen, and the Unlock timer re-renders every second even when no grant is active.
- Scoring: extra words are ignored, so "hola buenos días a todos" scores 100 against "Hola". It needs a penalty for unmatched extra words (a later PR).

## Next work, in order

1. **Unlock integrity** (`fix/unlock-integrity`, open): the four unlock bugs above, with tests.
2. **Reliability:** safe database startup with an error screen, and a battery-friendly Unlock timer (tick only while a grant is active).
3. **Scoring and spec alignment:** penalize extra words, then re-check the scorer and the docs against [learning-loop](docs/learning-loop.md).
4. **Real speech, device only.** The Simulator can't be relied on for Spanish speech recognition (Apple's own speech samples say it doesn't run there; tracked as OQ-8 in [learning-loop §10](docs/learning-loop.md#10-open-questions-and-decisions)). Keep `mock` as the Simulator/Jest default; when an iPhone is available, wire the `ios` service (`expo-speech` for TTS, `expo-speech-recognition` for STT). Both are new dependencies and need lead approval first.
5. **CI:** GitHub Actions running lint, typecheck, test and `expo-doctor` (needs a one-time repo permission from Daniel).
6. **Later:** Screen Time (needs a physical iPhone and a paid Apple Developer account), then the roadmap languages.

## Workflow rules

- **Branch from the updated `main`:** `git fetch && git switch -c daniel/<short-description> origin/main` (agents use their own branch name, also from the updated `main`). Never push to `main` directly.
- Use Node 22 (`.nvmrc`) and install with `npm ci`.
- Before opening a PR, run and pass `npm run lint`, `npm run typecheck`, and `npm test`. After any dependency change, also run `npm run doctor`.
- Open the PR with `gh pr create --fill`. The lead reviews and merges.
- **No new dependencies without lead approval.** Once one is approved, add it with `npx expo install`.
- **Read the Expo SDK 57 docs** (https://docs.expo.dev/versions/v57.0.0/) before touching any Expo, EAS, or React Native API. Don't rely on memory, because APIs change every SDK.
