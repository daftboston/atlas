# Atlas — Architecture v0

Status: v0.2, revised for Daniel's OQ-1/3/10 decisions, pending lead review · Owner: Atlas Product Architect · Reviewer: Apple Senior Dev
Companion doc: `docs/learning-loop.md` (entities, scheduling, unlock rules)

## 1. Purpose and scope

This doc defines how the Atlas app is laid out: routes, layers, folders, and the contracts for the two native-dependent services (speech and Screen Time). It is meant to be specific enough that Frontend and Backend can start without further clarification, except for the items in section 9.

Out of scope for v0: accounts, cloud sync, analytics, push notifications, real FamilyControls integration, content authoring tools.

## 2. Constraints (from lead)

- Expo 57 / React Native 0.86, Expo Router with routes in root `app/`, TypeScript strict.
- SQLite + Drizzle for persistence, Zustand for client state, NativeWind for styling, Reanimated for animation.
- Bundle ID `daft.atlas`, EAS dev builds.
- Daniel has a Mac, no iPhone, and no paid Apple Developer account. iOS Simulator is the first target. Anything that needs a paid entitlement or a physical device (FamilyControls, DeviceActivity) stays behind a stub.
- Local-first. v0 must work with no network, except for anything the speech decision (OQ-2) puts in the cloud.

## 3. Route map (Expo Router, root `app/`)

```
app/
  _layout.tsx                 Root stack. Providers, DB open + migrations, service registry, onboarding gate.
  (onboarding)/
    _layout.tsx               Stack, no tabs, no back to app until complete.
    welcome.tsx               Value prop: speak from minute one, short daily sessions.
    language.tsx              Pick a course and its speech locale. v0 ships one course (English → Spanish), so this screen only offers es-MX (default) or es-ES. With more courses it becomes a picker, with no route changes.
    mic.tsx                   Explains why we need the mic, then triggers the system prompt.
    first-session.tsx         Hosts the onboarding PracticeSession (3 items; see learning-loop §6).
    habit.tsx                 Intro to unlocks / Screen Time. Shows "coming soon" while the stub is active. Skippable.
    done.tsx                  "N reviews scheduled for tomorrow." Sets onboardingCompleted.
  (tabs)/
    _layout.tsx               Tab bar: Learn, Review, Unlock, Settings.
    learn.tsx                 Home. Primary CTA "Start session" (daily mode). Shows today's due + new counts and streak.
    review.tsx                Due queue overview, upcoming load (next 7 days), mastered count, "Review only" CTA.
    unlock.tsx                Earned / active / expired UnlockGrants, activate button, Screen Time status.
    settings.tsx              Daily new-item limit, session length, desired retention (advanced), mic/Screen Time status, dev menu in __DEV__.
  practice/
    [sessionId].tsx           Full-screen modal, no tabs. Runs the session: prompt → listen → feedback → next.
    summary/[sessionId].tsx   Session results, unlock earned (if any), "Done" back to Learn.
```

Navigation rules:
- The root layout reads `onboardingCompleted` from settings. If false, it renders `<Redirect href="/(onboarding)/welcome" />`. Once onboarding is complete, onboarding routes redirect to `/(tabs)/learn`.
- The session is created **before** navigating: the CTA calls `sessionService.start(mode)` and then `router.push('/practice/<id>')`. This lets a killed app resume an `active` session.
- Resume and start both run the 2-hour stale check first (learning-loop §3.4). When Learn finds an `active` session, it offers "Resume" only if `started_at` is within 2 hours. Otherwise it marks the session `abandoned` and offers "Start session".
- Leaving `practice/[sessionId]` mid-session shows a confirmation. Confirming marks the session `abandoned` (learning-loop §5.4). Attempts already graded stay graded.
- The deep link scheme is `atlas://`. Only `atlas://practice/<id>` and `atlas://unlock` are reserved for v0, for future notifications.

## 4. Layers

```
UI (app/, src/components)
  │  reads via hooks, dispatches intents
State (src/state — Zustand)
  │  orchestrates; calls domain + data + services
Domain (src/domain — pure TS)        Services (src/services — interfaces + impls)
  │  rules, no I/O                      speech, screenTime, haptics
Data (src/data — Drizzle/SQLite)
```

| Layer | Owns | May import | Must not |
|---|---|---|---|
| UI | Screens, components, animation, accessibility | state hooks, domain **types**, `src/lib` | Call Drizzle or native modules directly |
| State | In-flight session state, UI flags, orchestration actions (`startSession`, `submitAttempt`, `activateUnlock`) | domain, data repositories, service registry | Hold the source of truth for persisted learning data |
| Domain | Scheduler (FSRS wrapper), session builder, grading map, text-match scoring, unlock rules, LTM promotion | `src/lib`, `ts-fsrs` | Import React, React Native, Expo, Drizzle, or services |
| Data | Drizzle schema, migrations, repositories, seed loader | domain types | Contain business rules (no scheduling math in SQL) |
| Services | Interfaces in `types.ts`, implementations (`mock`, `ios`, `stub`, later `cloud`) | `src/lib`, native modules | Contain learning rules |

Key rules:
- **SQLite is the source of truth** for KnowledgeItems, queue state, attempts, feedback, grants, and settings. Zustand stores mirror what the UI needs and rehydrate from repositories on launch. Live lists can use Drizzle's `useLiveQuery` for `expo-sqlite`.
- **Domain is pure and Jest-tested** with injected time (`now: number`). No `Date.now()` inside domain functions.
- **Composition root:** `src/services/registry.ts` picks implementations once at startup from `EXPO_PUBLIC_SPEECH_IMPL` (`mock` | `ios` | `cloud` | `unavailable`) and `EXPO_PUBLIC_SCREENTIME_IMPL` (`stub` | `ios`). Tests always use `mock` / `stub`. When `EXPO_PUBLIC_SPEECH_IMPL` is unset, development builds (`__DEV__`) and Jest use `mock`, and a release build uses `unavailable` (`stt: false`, `tts: false`), so the UI offers typed answers only and a shipped build can never pass a step with scripted speech.
- **Writes for one attempt happen in one transaction:** PracticeAttempt, Feedback, ReviewQueueEntry update, ReviewLog row, and the KnowledgeItem status change. Either all are saved or none are.

## 5. Folder convention

```
app/                        Routes only. Thin: compose components, call state hooks.
src/
  components/
    ui/                     Primitives (Button, Card, ProgressRing). NativeWind only.
    practice/               MicButton, PromptCard, WordDiff, FeedbackPanel, SessionProgress.
    unlock/                 GrantCard, ScreenTimeStatus.
  state/                    sessionStore.ts, settingsStore.ts, unlockStore.ts
  domain/
    types.ts                Shared domain types (mirrors learning-loop entities).
    scheduler/              fsrs.ts (wraps ts-fsrs), grading.ts (score → rating)
    session/                buildSession.ts, sessionRules.ts
    scoring/                textMatch.ts (engine-independent baseline scorer, language-agnostic)
    language/               types.ts (LanguageProfile), registry.ts, profiles/es.ts (v0), profiles/fr.ts (test fixture). See §10
    unlock/                 unlockRules.ts
    memory/                 promotion.ts (Long-Term Memory criteria)
    config.ts               All tunable constants in one place (thresholds, limits, durations).
  data/
    db.ts                   Opens expo-sqlite, applies Drizzle migrations.
    schema.ts               Drizzle tables (learning-loop §3).
    migrations/             drizzle-kit output, committed.
    repositories/           knowledgeRepo.ts, queueRepo.ts, sessionRepo.ts, attemptRepo.ts, unlockRepo.ts, settingsRepo.ts
    seed/                   loadSeed.ts (idempotent, keyed by seedId). Imports `content/seed/seed-phrases-v0.json` from the repo root (schema: learning-loop §11)
  services/
    registry.ts
    speech/                 types.ts, mock.ts, ios.ts (later cloud.ts)
    screenTime/             types.ts, stub.ts (later ios.ts)
  lib/                      time.ts (local-day boundary), id.ts (UUIDs via expo-crypto), text.ts (normalize)
modules/                    Expo local native modules (future: atlas-speech, atlas-screen-time)
docs/
```

Naming: components and screens in `PascalCase.tsx`, everything else in `camelCase.ts`. Tests are colocated as `*.test.ts`.

**IDs:** UUID v4 strings from `Crypto.randomUUID()` in `expo-crypto`, wrapped in `lib/id.ts` as `newId()`. Don't add a `uuid` package. Tests can mock `newId` for deterministic IDs.

**Time and the local day:** timestamps are stored as integer milliseconds since the epoch (UTC). The local day rolls over at 04:00 device time. `lib/time.ts` exposes `localDayKey(nowMs)` (for example `"2026-10-01"`) and `nextRolloverMs(nowMs)`, and both read the device's current timezone **every time they are called**. No timezone offsets or day keys are stored. When the device changes timezone (travel or a manual change), "today" is recomputed from the new zone on the next call. As a result, the daily new-item count and the unlock caps follow the new local day, and a day can end up a few hours shorter or longer. That's accepted for v0. Stored UTC timestamps never change, so FSRS `due` values are unaffected. Covered by unit tests with injected timezones.

### 5.1 Migrating from the template layout
The repo starts from the stock Expo tabs template, which keeps `components/`, `constants/`, and `hooks/` at the root. As part of the first UI task, Frontend:
1. Moves those folders under `src/` (`src/components/`, `src/constants/`, `src/hooks/`). `app/` stays at the root, because that's where Expo Router routes live.
2. Changes the `tsconfig.json` path alias to `"@/*": ["./src/*"]` and fixes the imports.
3. Updates `AGENTS.md` (and any lint/Jest path config) so its folder map matches §5 exactly.
4. Deletes unused template screens and assets.

## 6. Speech service contract

`src/services/speech/types.ts`:

```ts
export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface SpeechCapabilities {
  stt: boolean;                 // speech-to-text available
  tts: boolean;                 // text-to-speech available
  scoring: 'text-match' | 'phoneme';
  onDevice: boolean;
  locales: string[];            // BCP-47, e.g. 'en-US'
}

export interface ListenOptions {
  locale: string;
  maxDurationMs?: number;       // default 8000
  silenceTimeoutMs?: number;    // default 1500 after first speech
  contextPhrases?: string[];    // bias recognition toward the target text when the engine supports it
}

export interface ListenResult {
  transcript: string;           // '' when nothing was heard
  confidence: number | null;    // 0..1 if the engine reports it
  durationMs: number;
  endedBy: 'silence' | 'maxDuration' | 'user' | 'error';
  audioUri: string | null;      // only when audio retention is allowed (OQ-5); default null
  error?: SpeechError;
}

export interface ListenSession {
  onPartial(cb: (partialTranscript: string) => void): () => void;
  onLevel(cb: (level0to1: number) => void): () => void;   // drives the mic animation
  stop(): void;                 // user ends early → endedBy 'user'
  cancel(): void;               // discard → result rejects with 'cancelled'
  result: Promise<ListenResult>;
}

export interface ScoreInput {
  target: string;              // canonical Spanish target
  variants: string[];          // other accepted answers (learning-loop §11)
  transcript: string;          // STT output, or the typed text
  inputMode: 'speech' | 'typed';
  locale: string;              // active course's speech locale (BCP-47), e.g. 'es-MX'; selects the LanguageProfile
  reading: string | null;      // optional kana/phonetic reading (§10)
  romanization: string | null; // optional romanized form (§10)
  audioUri: string | null;
}

export interface WordScore {
  expected: string | null;      // null for extra words
  heard: string | null;         // null for missing words
  status: 'correct' | 'close' | 'missing' | 'extra';
  score: number | null;         // 0..100, phoneme scoring only
}

export interface ScoreResult {
  overall: number;              // 0..100
  accuracy: number;             // 0..100, word-level match
  pronunciation: number | null; // 0..100 when scoring === 'phoneme', else null
  words: WordScore[];
  method: 'text-match' | 'phoneme';
  matchedText: string;          // the target or variant that scored best; the word diff is shown against it
  accentHints: string[];        // diacritic tips when the language profile treats them as lenient (e.g. es); always [] for strict languages
}

export type SpeechError = 'permissionDenied' | 'unavailable' | 'noSpeech' | 'network' | 'interrupted' | 'unknown';

export interface SpeechService {
  capabilities(): Promise<SpeechCapabilities>;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  listen(opts: ListenOptions): ListenSession;      // only one at a time; a second call cancels the first
  speak(text: string, opts: { locale: string; rate?: number }): Promise<void>;  // resolves when playback ends
  stopSpeaking(): Promise<void>;
  score(input: ScoreInput): Promise<ScoreResult>;
}
```

Behavior requirements:
- `speak()` and `listen()` never overlap. Starting `listen()` stops any TTS first.
- Implementations whose `scoring === 'text-match'` delegate `score()` to `domain/scoring/textMatch.ts`, so the baseline works the same on every engine. The scorer contains no language-specific code. Every language rule comes from the `LanguageProfile` that `language/registry.ts` returns for `input.locale` (§10). Algorithm:
  1. **Normalize:** Unicode NFC, then the profile's `normalize()` (NFKC folding, case folding, punctuation stripping such as `¿ ¡ 。 、`, and whitespace collapse).
  2. **Diacritics:** the profile's `diacritics` policy. `es` is `lenient-with-hint`: á/é/í/ó/ú/ü fold for matching and ñ stays distinct. Accent-only misses count as correct and go into `accentHints`. `fr` is `strict` (accents count). Languages without diacritics use `none`.
  3. **Tokenize:** the profile's `tokenize()`. `es` and `fr` split on whitespace. Languages written without spaces (ja) align by grapheme instead. Nothing assumes spaces.
  4. **Align** units by edit distance. A unit is `close` when its character edit distance is at most `max(1, floor(len/4))`. Single graphemes are only ever `correct` or not.
  5. **Score candidates:** the target, every variant, and `reading` and `romanization` when present. Keep the highest. `accuracy = 100 × (correct + 0.5 × close) / expectedUnitCount`. When pronunciation is null, `overall = accuracy`.
  6. **Numbers:** the profile's optional `numberWords` map (es: 0–100) turns digits into words before alignment.
- Audio interruptions (calls, Siri, route change) end the session with `endedBy: 'error'` and `error: 'interrupted'`. The UI offers a retry, and the interrupted attempt is not graded.
- **`mock.ts`** is deterministic. It takes a scripted queue of results (`transcript`, delay, error) so the simulator and Jest can drive every feedback path: perfect, close, wrong, silence, denied, interrupted. The dev menu in Settings can switch between scripts.
- Locale: `listen()` and `speak()` always use the active course's `speech_locale`. In v0 that's `es-MX` by default, with `es-ES` selectable in onboarding and Settings. The UI copy is English.
- **`ios.ts`** wraps Apple's on-device speech recognizer and system TTS (OQ-2 decided: on-device + text-match for v0). It reports `scoring: 'text-match'` and `onDevice: true`, and it must report honestly what the simulator supports, since STT behavior there still needs verifying (OQ-8). `cloud.ts` is a v1 opt-in.

## 7. Screen Time service contract (stub-able)

`src/services/screenTime/types.ts`:

```ts
export type ScreenTimeAvailability = 'unavailable' | 'notAuthorized' | 'authorized';

export interface ShieldSelection { token: string; appCount: number; categoryCount: number; } // opaque, from the native picker

export type ScreenTimeEvent =
  | { type: 'shieldLifted'; until: number }
  | { type: 'shieldRestored' }
  | { type: 'authorizationChanged'; availability: ScreenTimeAvailability };

export interface ScreenTimeService {
  availability(): Promise<ScreenTimeAvailability>;
  requestAuthorization(): Promise<ScreenTimeAvailability>;
  pickSelection(): Promise<ShieldSelection | null>;     // null if the user cancels
  getSelection(): Promise<ShieldSelection | null>;
  applyShield(selection: ShieldSelection): Promise<void>;
  liftShield(untilMs: number): Promise<void>;           // temporary unlock window
  restoreShield(): Promise<void>;
  onEvent(cb: (e: ScreenTimeEvent) => void): () => void;
}
```

- **`stub.ts`** (the v0 default) returns `'unavailable'`. In `__DEV__`, a dev-menu toggle simulates `'authorized'` with a fake selection, and it records lift/restore calls with timestamps in memory so the unlock flow can be tested end to end in the simulator.
- The rest of the app treats `'unavailable'` as normal: grants are still earned and shown, and activating one just starts a visible timer.
- **Hard rule:** no domain function reads Screen Time state. Screen Time is downstream of `UnlockGrant` and never upstream of learning progress.
- The real `ios.ts` (FamilyControls + DeviceActivity + ManagedSettings, via a local Expo module in `modules/atlas-screen-time`) is deferred until there is a device and a paid developer account. Atlas iOS Native owns it, and Atlas Security reviews it before it ships.

## 8. Acceptance criteria for this doc

- [ ] All routes in §3 exist. The onboarding gate redirects correctly in both directions. A killed app with an `active` session under 2 hours old can resume from Learn, and an older one is marked `abandoned` instead.
- [ ] Template folders live under `src/`, the `@/*` alias points to `./src/*`, and `AGENTS.md` matches §5.
- [ ] IDs come only from `lib/id.ts` (`expo-crypto`), and no `uuid` dependency is present.
- [ ] The `lib/time.ts` tests cover the 04:00 rollover and a timezone change between calls.
- [ ] No file in `src/domain` imports react, react-native, expo-*, drizzle-orm, or `src/services`. This is enforced by an ESLint `no-restricted-imports` rule.
- [ ] Every Speech and Screen Time call goes through `registry.ts`, and the app runs fully on the simulator with `mock` + `stub`.
- [ ] The mock speech scripts cover perfect, close, wrong, silence, permission denied, and interrupted, and each produces the expected feedback state.
- [ ] Each attempt's writes are atomic (one transaction). There is a test that forces a failure mid-write and checks that nothing partial persists.
- [ ] Tunable numbers live only in `src/domain/config.ts`.
- [ ] Nothing outside `src/domain/language/profiles/` and the `content/` files mentions a specific language. A lint/grep check rejects `'es'`/`'es-MX'` literals elsewhere, except for the default course seed config.
- [ ] **Adding a language means content plus a config entry only.** A new course is a `LanguageProfile` file, a `content/` deck, and a course config entry. It needs no schema migration, no change to `textMatch.ts`, no route change, and no change to any other domain module.
- [ ] **Second-language test (roadmap):** a fixture course (`fr-FR`, a few items, strict accents) loads and scores through the same code path with no schema change, no migration, and no scorer edits. Only a new profile and new content are added.

## 9. Open questions

See `learning-loop.md` §10. For architecture, the lead has decided OQ-2 (on-device), OQ-5 (no audio retention), and OQ-6 (local-only). OQ-1 is now decided too (English UI, Spanish target, es-MX default, es-ES optional). Still open: OQ-8, which now also covers checking that es-MX and es-ES recognition and TTS voices exist on the simulator.

## 10. Languages and roadmap

The planned languages after Spanish (Japanese, Korean, French) and the language-agnostic engineering requirements are defined in [`docs/roadmap.md`](./roadmap.md). That doc is the source of truth, and its rules aren't repeated here. This is how the architecture meets them:

- **Course is the unit of language.** There's a `courses` table (learning-loop §3.0), and every item belongs to a course. No table or code path is keyed on a specific language.
- **`LanguageProfile` (`src/domain/language/types.ts`)** is the only place language rules live. It's pure TS, so it stays in the domain layer:
  ```ts
  export interface LanguageProfile {
    lang: string;                                   // BCP-47 primary tag, e.g. 'es'
    normalize(text: string): string;                // NFC/NFKC, case, punctuation
    diacritics: 'lenient-with-hint' | 'strict' | 'none';
    foldDiacritics?(text: string): string;          // required unless 'none'
    tokenize(text: string): string[];               // words or graphemes; never assume spaces
    numberWords?: Record<number, string>;
    altScripts?(item: { reading: string | null; romanization: string | null }): string[]; // extra accepted forms (kana, romaji, ...)
  }
  ```
  `registry.ts` maps a locale to a profile by its primary tag (`es-MX` and `es-ES` both use the `es` profile).
- **Roadmap languages** (not v0, order not fixed): Japanese (`ja-JP`), Korean (`ko-KR`), French (`fr-FR`). Details are in [`docs/roadmap.md`](./roadmap.md).
- **Adding a language** means a new profile file, a new `content/` deck, and a new course config entry. Nothing else: no schema migration, no scorer change, no route change.

### 10.1 Profile rules per language (planned)
| Profile | Normalize | Diacritics | Tokenize (alignment unit) | Alternate forms |
|---|---|---|---|---|
| `es` (v0) | NFC, casefold, strip `¿ ¡` and punctuation | `lenient-with-hint` (á é í ó ú ü fold; ñ distinct) | whitespace words | digits → number words |
| `fr` | NFC, casefold, split elisions (`l'`, `j'`, `qu'`), `œ`→`oe` and `æ`→`ae` | `strict`: accents count, so é ≠ e | whitespace words | digits → number words |
| `ja` | NFKC (full-width/half-width folding), katakana → hiragana, strip `。、「」` | `none` | graphemes, never spaces | Compares candidates in kana: the item `reading` vs. the transcript converted to kana, so kanji and kana spellings match. Typed romaji (Hepburn) is transliterated to kana first. The item `romanization` is also accepted |
| `ko` | NFC (composes jamo into hangul syllables), strip punctuation | `none` | whitespace-separated words (eojeol); `close` measured in syllable blocks | The item `romanization` (Revised Romanization) is accepted for typed input |

Converting STT kanji output to kana needs a reading dictionary. That dependency is chosen before the ja course starts (learning-loop OQ-12). The profile contract (`normalize` / `tokenize` / `altScripts`) already covers it, so nothing outside the profile changes.
- **Speech:** the speech locale is stored per course, and `SpeechCapabilities.locales` gates which courses can be picked on a given device.

The language-specific open items for future courses (ja kana/kanji matching, ko scoring units) are tracked in roadmap.md and learning-loop §10.3.
