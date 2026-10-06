# Atlas — Learning Loop Spec v0

Status: v0.2, revised for Daniel's OQ-1/3/10 decisions, pending lead review · Owner: Atlas Product Architect · Reviewer: Apple Senior Dev
Companion doc: `docs/architecture.md` (routes, layers, service contracts)

## 1. Problem

Learners forget most of what they study passively, and they rarely speak enough to build pronunciation or recall. Atlas makes every session short and spoken, grades each spoken attempt, schedules the next review at the point the learner is about to forget, and rewards completed practice with a temporary unlock. The unlock reinforces the habit. It is never the product, and it never stands in for learning.

## 2. The loop, stage by stage

| # | Stage | What happens | Entity written | Owner layer |
|---|---|---|---|---|
| 1 | Active Learning | A new item is introduced. The learner hears it (TTS) and repeats it aloud. | PracticeAttempt (`listen-repeat`), KnowledgeItem `new → learning` | domain/session, state |
| 2 | Knowledge Stored | The item and its first outcome are persisted, and a ReviewQueueEntry is created. | KnowledgeItem, ReviewQueueEntry, ReviewLog | data |
| 3 | Reinforcement Queue | FSRS assigns `due` from the graded result. | ReviewQueueEntry | domain/scheduler |
| 4 | Reactive Learning | When a session starts, the builder picks the most at-risk due items and adds new ones. In v0 the trigger is opening the app; notifications come later (OQ-9). | PracticeSession | domain/session |
| 5 | Practice | Active recall: the learner sees the meaning and says the target aloud. Mic first, typed as fallback. | PracticeAttempt (`recall-speak`) | UI, services/speech |
| 6 | Feedback | Score, word-level diff, one hint, TTS replay, optional retry. | Feedback | domain/scoring, domain/scheduler |
| 7 | Temporary Unlock | A qualifying completed session earns an UnlockGrant. | UnlockGrant | domain/unlock |
| 8 | Long-Term Memory | An item whose stability passes the threshold is promoted to `mastered` and keeps sparse maintenance reviews. | KnowledgeItem `review → mastered` | domain/memory |

## 3. Entities (SQLite tables, Drizzle)

Conventions: `id` is a UUID text primary key, timestamps are integer ms (UTC), and enums are text with a CHECK constraint.

### 3.0 Course (`courses`)
| Column | Type | Notes |
|---|---|---|
| id | text PK | e.g. `en-es-v0` (matches the seed file's `courseId`) |
| source_lang | text | BCP-47, the learner's language. `en` in v0 |
| target_lang | text | BCP-47, the language being learned. `es` in v0 |
| speech_locale | text | The user's chosen STT/TTS locale for this course, e.g. `es-MX` |
| speech_locales | text (JSON array) | Selectable locales, e.g. `["es-MX","es-ES"]` |
| title | text | English display name, e.g. "Spanish" |
| created_at | int | |

The language rules (normalization, diacritics, tokenization) come from the `LanguageProfile` for `target_lang`, not from columns (architecture §10). Planned future courses are listed in [`roadmap.md`](./roadmap.md).

### 3.1 KnowledgeItem (`knowledge_items`)
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| seed_id | text unique null | Stable ID from the seed file, for idempotent seeding |
| kind | enum `word` \| `phrase` \| `sentence` | |
| target_text | text | What the learner says, e.g. "Could you repeat that?" |
| meaning | text | Prompt in the learner's L1 |
| course_id | text FK → courses | The language comes from the course. Items carry no language code |
| reading | text null | Optional phonetic reading (e.g. kana for ja). Null for es |
| romanization | text null | Optional romanized form (e.g. romaji). Null for es |
| variants | text (JSON array) | Other accepted Spanish answers (§11) |
| level | enum `A1` \| `A2` | CEFR level |
| topic | text | e.g. `greetings`, `food` |
| notes | text null | Usage hint shown after feedback |
| tags | text (JSON array) | |
| status | enum, see 3.1.1 | |
| status_before_suspend | enum null | Set when an item is suspended, cleared when it is unsuspended |
| created_at, introduced_at (null), mastered_at (null), updated_at | int | |

#### 3.1.1 KnowledgeItem states
```
new ──(first Active Learning attempt)──▶ learning
learning ──(FSRS state → Review)──▶ review
review ──(rating Again)──▶ relearning ──(FSRS state → Review)──▶ review
review ──(LTM criteria met, §8)──▶ mastered
mastered ──(rating Again)──▶ relearning      (mastered_at kept as history; it is set again on re-promotion)
any ──(user suspends)──▶ suspended ──(unsuspend)──▶ status_before_suspend
```
Suspend copies the current `status` into `status_before_suspend`, then sets `status = suspended`. Unsuspend restores `status` from `status_before_suspend` and clears it. The ReviewQueueEntry is left untouched, so if the item is overdue after unsuspend, it simply shows up as due. The status is stored rather than derived from `fsrs_state` because `mastered` and `new` don't map one-to-one to FSRS states.
`learning`, `review`, and `relearning` mirror the FSRS card state. `mastered` is Atlas's own flag layered on top of FSRS `Review`, and `suspended` items are never queued.

### 3.2 ReviewQueueEntry (`review_queue`) — one row per item
The queue is not a list of pending jobs. Each item has one FSRS card row, and "the queue" is the query `due <= now AND status not in (new, suspended)`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK, FK → knowledge_items | |
| due | int | |
| stability | real | days |
| difficulty | real | |
| elapsed_days, scheduled_days | real | |
| reps, lapses | int | |
| fsrs_state | enum `New` \| `Learning` \| `Review` \| `Relearning` | |
| last_review_at | int null | |

Index: `(due)`.

### 3.3 ReviewLog (`review_logs`) — append-only
`id, item_id, attempt_id, rating (1–4), fsrs_state_before, due_before, stability_before, difficulty_before, elapsed_days, scheduled_days, reviewed_at`. This history feeds future FSRS parameter optimization and makes debugging possible. Rows are never updated.

### 3.4 PracticeSession (`practice_sessions`)
| Column | Notes |
|---|---|
| id, started_at, ended_at (null) | |
| mode | `onboarding` \| `daily` \| `review-only` |
| status | `active` → `completed` \| `abandoned` |
| planned_item_ids | JSON array, fixed when the session is built |
| cursor | int index into the plan, for resume |

At most one session is `active` at a time. **Stale check:** an `active` session whose `started_at` is more than 2 hours ago gets marked `abandoned`. The check runs on both start and resume: when a new session starts, and when Learn (or a deep link) tries to resume an existing one. A stale session is never resumed.

### 3.5 PracticeAttempt (`practice_attempts`)
| Column | Notes |
|---|---|
| id, session_id, item_id | |
| prompt_type | `listen-repeat` (Active Learning) \| `recall-speak` (Practice) |
| input_mode | `speech` \| `typed` |
| try_number | 1 is the first try for this item and prompt in this session; retries are 2–3 |
| status | `pending` → `captured` → `scored` \| `failed` \| `skipped` |
| transcript | text null |
| duration_ms | int null |
| error | SpeechError null |
| graded | bool. True only for the attempt that updated FSRS (§5.3) |
| started_at, ended_at | |

`failed` means a technical failure (interrupted, engine error). It is never graded and does not count toward unlocks. `skipped` means the user tapped "I don't know" and is graded as Again.

### 3.6 Feedback (`feedback`) — one per scored attempt
`id, attempt_id (unique), overall, accuracy, pronunciation (null), words_json, method, matched_text, accent_hints_json, rating (1–4 or null if not graded), hint_key, created_at`.

### 3.7 UnlockGrant (`unlock_grants`)
| Column | Notes |
|---|---|
| id, session_id (unique) | One grant per session at most |
| minutes | int |
| status | `earned` → `active` → `expired`; `earned` → `forfeited` |
| earned_at, activated_at (null), expires_at (null) | |
| expires_unused_at | End of the local day it was earned (04:00 rollover) |
| screen_time_applied | bool. Whether `liftShield` succeeded (false under the stub) |

### 3.8 Settings (`app_settings`, key/value)
`onboardingCompleted`, `uiLanguage` (`en` in v0), `activeCourseId` (`en-es-v0`). The speech locale lives on the course row, `dailyNewLimit` (default 5), `sessionSize` (default 8), `desiredRetention` (default 0.90), `screenTimeEnabled`.

## 4. Scheduling algorithm: FSRS (recommended over SM-2)

**Decision: use FSRS through the `ts-fsrs` library (MIT-licensed, pure TypeScript), pinned to an exact version and wrapped in `domain/scheduler/fsrs.ts`.**

Reasoning:
- **Better recall prediction.** Open-spaced-repetition's published benchmarks show FSRS predicting recall more accurately than SM-2, which means fewer wasted reviews for the same retention. That matters for short sessions.
- **One product knob.** `desiredRetention` (default 0.90) maps directly to "how hard should Atlas push." SM-2 has no equivalent.
- **No ease hell.** SM-2's ease factor shrinks after repeated failures and can leave items stuck at short intervals. FSRS models difficulty separately from stability.
- **Gets better with data.** ReviewLog keeps exactly what FSRS parameter optimization needs, so we can personalize later without a migration.
- **Fits the stack.** It is pure TypeScript, runs offline, is deterministic with injected `now`, and is easy to Jest-test.

Cost and risks: the parameters are less intuitive than SM-2's. To mitigate, use the default parameters in v0, pin the version, and keep the wrapper as the only import site. Frontend and Backend should confirm that `ts-fsrs` runs under Hermes on RN 0.86 when they first integrate it (it is pure TS, so problems are not expected). If it fails, SM-2 is a fallback behind the same wrapper interface:

```ts
schedule(card: QueueCard, rating: 1|2|3|4, now: number): { card: QueueCard; log: ReviewLogRow }
retrievability(card: QueueCard, now: number): number   // 0..1, used by the session builder
initCard(now: number): QueueCard
```

### 4.1 Grading: score → FSRS rating (`domain/scheduler/grading.ts`)
| Condition | Rating |
|---|---|
| skipped, no speech, or overall < 50 | 1 Again |
| 50 ≤ overall < 75 | 2 Hard |
| 75 ≤ overall < 90 | 3 Good |
| overall ≥ 90, `recall-speak`, first try, speech input | 4 Easy |

Caps:
- A `listen-repeat` attempt caps at Good, since repeating isn't recall.
- Typed input caps at Good, because Easy requires speech and that keeps speaking the best path. Graded typed attempts **do** count toward unlock eligibility (OQ-10, §8.1).
- Accent-only mistakes in typed answers never lower the rating. They show up as a spelling tip instead (architecture §6).

All thresholds live in `domain/config.ts`.

## 5. Session rules (Reactive Learning + Practice)

### 5.1 Building a session (`buildSession(now, settings, repos)`)
1. `due` = reviewable items with `due <= now`, sorted by retrievability ascending (most at risk first).
2. `newToday` = items introduced since the last local-day rollover. `newBudget = max(0, dailyNewLimit − newToday)`. If more than 30 items are due, `newBudget = 0` so the backlog clears first.
3. Take up to `sessionSize` reviews. Fill any remaining slots with up to `newBudget` new items, in seed order.
4. If both are empty, the Learn screen shows "All caught up" with the next due time. No empty sessions are created.
5. Interleave: each new item gets a `listen-repeat` step, and its `recall-speak` step comes at least 2 steps later.
6. `review-only` mode skips steps 2–3 for new items. `onboarding` mode is always 3 new items.

### 5.2 A step
Prompt (meaning shown; TTS plays for `listen-repeat`) → mic auto-arms → `listen()` → `score()` → Feedback → Retry (up to 2 more tries) or Next.

### 5.3 What gets graded
Only **try 1** of each step updates FSRS. Retries exist for feedback only, so scheduling reflects what the learner actually produced on the first try. `failed` attempts are never graded, and the step can be retried as a fresh try 1.

**New items are graded twice in their first session, and that's intended.** For a new item:
1. Try 1 of `listen-repeat` creates the card (`initCard`) and immediately schedules it with its rating, capped at Good. That writes ReviewLog row #1, and the card moves to FSRS `Learning`.
2. Try 1 of the later `recall-speak` step (at least 2 steps later) schedules the card again with its own rating. That writes ReviewLog row #2.

This is how FSRS normally handles short-term (same-day) learning steps. Two same-session reviews are what move a card out of `Learning` with a meaningful first stability. Review items get exactly one graded step per session.

### 5.4 Ending
- `completed`: every planned step has a graded attempt or a skip.
- `abandoned`: the user exits, or a session stays `active` for more than 2 hours. Graded attempts stay graded, and no unlock is earned.

## 6. First session (onboarding mode)
Welcome → course and accent (v0 has one course, English → Spanish, so this is only the accent choice: Latin America `es-MX` by default or Spain `es-ES`) → mic explanation → system permission → 3 new items (listen-repeat, then recall-speak) → summary ("3 phrases saved, first review tomorrow") → habit intro (Screen Time "coming soon" while stubbed) → Learn.

If mic permission is denied, the user continues on the typed path, which can still earn unlocks. Learn shows a persistent "Turn on mic" banner that deep-links to iOS Settings. Onboarding still completes.

Target: the user hears their first spoken feedback within 90 seconds of opening the app.

## 7. Feedback rules
- With text-match, feedback appears within 1 s of the end of speech. The cloud budget is TBD (OQ-2).
- Show three things: a pass or try-again state, a word diff (correct / close / missing), and **one** hint, chosen from the first missing word, the first close word, or the item's notes.
- Always offer "Hear it" (TTS) and "Try again". Never show a score without a next action.
- Copy is short and never shaming. Error states (silence, interrupted, denied) get their own messages and are not shown as a low score.

## 8. Temporary Unlock and Long-Term Memory

### 8.1 Unlock rules (`domain/unlock/unlockRules.ts`)
- **Earn:** a session reaches `completed` with at least 5 graded attempts (or 3 in onboarding mode). Speech and typed attempts both count (OQ-10). Skipped and failed attempts don't count.
- **Minutes:** 10 base, plus 5 if the mean `overall` of graded attempts is at least 80. Capped at 20 per grant and 60 per local day. Once the daily cap is reached, the session still completes and simply shows "daily unlock limit reached."
- **Expire unused:** grants that are still `earned` move to `forfeited` at `expires_unused_at`. There is no banking across days, because the habit is daily.
- **Activate:** `earned → active`, `expires_at = now + minutes`, then call `screenTime.liftShield(expires_at)`. On success, set `screen_time_applied = true`. If the call fails or is unavailable, the grant still activates and shows a timer.
- **Expire:** at `expires_at`, `active → expired` and `restoreShield()` is called. The check runs on app foreground and on a timer while the app is open. Real background enforcement waits for DeviceActivity.
- **Invariants:** grants never change KnowledgeItem, ReviewQueueEntry, or ratings. No Screen Time state is ever read by domain code. Typed-only sessions earn exactly what speech sessions do, except that typed answers can never reach an Easy rating.

### 8.2 Long-Term Memory promotion (`domain/memory/promotion.ts`)
After each graded review, an item in `review` is promoted to `mastered` when FSRS `stability ≥ 60` days **and** the last graded rating is Good or better **and** `lapses ≤ 3`.

Mastered items keep FSRS scheduling and are only queued when due, which keeps maintenance sparse. A rating of Again moves them to `relearning`. The Review tab shows the mastered count as the headline long-term progress number.

## 9. Acceptance criteria
- [ ] Each entity and state in §3 exists as a Drizzle table or enum, with a migration committed.
- [ ] Every attempt write is atomic: attempt + feedback + queue + log + item status, all or nothing.
- [ ] After the first completed Active Learning step, the item has a ReviewQueueEntry with a future `due`.
- [ ] Only try 1 of a step changes FSRS state, and retries never write a ReviewLog row. Covered by a unit test.
- [ ] A new item that completes its first session has exactly 2 ReviewLog rows: listen-repeat try 1 (rating ≤ Good) and then recall-speak try 1. A review item has exactly 1. Covered by a unit test.
- [ ] Suspending and then unsuspending restores the exact previous status, `mastered` included, and leaves the ReviewQueueEntry unchanged. Covered by a unit test.
- [ ] The stale-session check runs on both start and resume: a session older than 2 hours is never resumed. Covered by a unit test.
- [ ] `buildSession` is a pure function, unit-tested for these cases: empty queue, due only, new only, mixed, backlog over 30, daily new limit, and the interleave gap.
- [ ] The grading table and caps (§4.1) are unit-tested at every boundary (49/50, 74/75, 89/90).
- [ ] Unlock rules are unit-tested: earn thresholds, minutes formula, per-grant and daily caps, forfeit at rollover, activate/expire, and that typed graded attempts count toward eligibility.
- [ ] With the Screen Time stub `unavailable`, the full loop works end to end in the iOS Simulator, including earning and activating a grant.
- [ ] No domain module imports `services/screenTime`. Enforced by lint.
- [ ] Scoring accepts any listed variant, keeps the best match, and stores `matched_text`. Typed answers that only lack accents score as correct and produce accent hints. Covered by unit tests.
- [ ] **Second-language test (roadmap):** a fixture course in another language loads and scores with no schema change or migration (architecture §8).
- [ ] [`content/seed/seed-phrases-v0.json`](../content/seed/seed-phrases-v0.json) validates against §11 (schema test in CI) and loads idempotently: running the seed twice creates no duplicates.
- [ ] The onboarding first session reaches spoken feedback in 90 s or less on the simulator with mock speech.

## 10. Open questions and decisions

### 10.1 Decided by lead (v0, reversible)
- **OQ-2 Speech.** On-device STT with text-match scoring for v0. Cloud pronunciation scoring is evaluated as an opt-in for v1, and the contract in architecture §6 already supports it.
- **OQ-4 Thresholds.** The grading cut-offs (50/75/90), unlock minutes (10 base, +5 bonus, 20 per grant, 60 per day), and LTM criteria (stability ≥ 60 days, ≤ 3 lapses) are the v0 defaults. All of them are tunable in `domain/config.ts`.
- **OQ-5 Audio retention.** No recordings are kept in v0, and `audioUri` is always null.
- **OQ-6 Accounts/sync.** Local-only, single user, single device in v0.
- **OQ-7 Unlock currency while stubbed.** An unlock is a visible free-time timer only. There is no streak protection and no other reward.
- **OQ-9 Reactive triggers.** Local reminder notifications move to v1. In v0, reactive learning triggers only when the app is opened.

### 10.2 Decided by Daniel (v0, reversible)
- **OQ-1 Languages.** English speakers learning Spanish. The UI is in English and the target is Spanish. Speech defaults to `es-MX`, and `es-ES` is selectable in onboarding and Settings. Japanese, Korean, and French follow later; see [`roadmap.md`](./roadmap.md). The schema and scorer are language-agnostic from v0.
- **OQ-3 Content.** The team drafts the seed phrases. The v0 deck is 60 phrases at A1–A2 in [`content/seed/seed-phrases-v0.json`](../content/seed/seed-phrases-v0.json) (§11). That covers about 12 days at 5 new phrases per day.
- **OQ-10 Accessibility.** Typed answers can earn unlocks. Typed answers still cap at Good, so speaking stays the best path.

### 10.3 Open for engineering
- **OQ-8 Simulator STT.** iOS Native needs to verify mic input and on-device recognizer behavior in the iOS Simulator, including whether es-MX and es-ES recognition and TTS voices are available. Until then, mock speech is the guaranteed simulator path.
- **OQ-12 Future-language scoring (not v0).** For ja, matching STT kanji output against kana readings needs a reading converter, which likely means a dictionary dependency. Choose it, and check its bundle size and offline use, before the ja course starts. The ko and fr rules are specified in architecture §10.1. Both get decided before those courses start, and the `LanguageProfile` contract already leaves room for them.
- **OQ-11 Content review.** A fluent Spanish speaker should review the 60 seed phrases, especially the regional variants, before they go to real learners.

## 11. Seed content schema (`content/seed/seed-phrases-v0.json`)

```jsonc
{
  "schemaVersion": 1,
  "courseId": "en-es-v0",         // → courses.id
  "deckId": "es-a1a2-v0",
  "sourceLang": "en",              // BCP-47; prompt language
  "targetLang": "es",              // BCP-47; selects the LanguageProfile
  "speechLocales": ["es-MX", "es-ES"],
  "defaultSpeechLocale": "es-MX",
  "items": [
    {
      "seedId": "es-v0-001",        // stable and unique; never reuse or renumber
      "level": "A1",                // "A1" | "A2"
      "topic": "greetings",
      "kind": "word",               // "word" | "phrase" | "sentence"
      "prompt": "Hello",            // English meaning shown for recall-speak
      "target": "Hola",             // canonical Spanish, correctly accented, with ¿ ¡ where needed. Used for TTS and as the main answer
      "variants": [],               // other accepted Spanish answers (regional, formal/informal, gendered, digit forms). Never TTS'd
      "reading": null,              // optional phonetic reading (e.g. kana). Omit or set null for es
      "romanization": null,         // optional romanized form (e.g. romaji). Omit or set null for es
      "notes": null                 // optional English usage hint shown after feedback
    }
  ]
}
```

Rules:
- The array order is the introduction order. New items are introduced in this order (§5.1).
- `seedId` maps to `knowledge_items.seed_id`, `prompt` to `meaning`, `target` to `target_text`, and `variants`/`level`/`topic`/`notes` to the matching columns.
- Edits to an existing `seedId` update text fields only. They never reset scheduling.
- Variants can't duplicate the target or each other after normalization (architecture §6).
- Avoid English words inside Spanish targets, since STT would mangle them.
- The same schema serves every future course. A new language adds a file, not fields (see [`roadmap.md`](./roadmap.md)).
- `content/` must also contain a tiny fixture course for the second-language acceptance test, e.g. `content/test-fixtures/en-fr-fixture.json`.
