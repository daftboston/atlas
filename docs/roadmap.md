# Atlas Language Roadmap

Decided by Daniel Santoyo, 2026-10-01.

## v0 (current)
- Learners: English speakers.
- Target language: Spanish.
- UI language: English.

## Next languages (planned, after Spanish)
1. Japanese (ja-JP)
2. Korean (ko-KR)
3. French (fr-FR)

The order of these three is not fixed yet.

## Engineering requirement: language-agnostic from v0
Adding a language must only mean new content and a config entry. It must not need a schema migration or a rewrite. To make that possible:

- **Courses:** items and decks belong to a course with `source_lang` and `target_lang` (BCP-47 codes). Nothing in the code is hard-coded to `es`.
- **Speech recognition:** the STT locale is chosen per course (es-MX by default, es-ES as an option, then ja-JP, ko-KR, fr-FR).
- **Scoring:** text matching is Unicode-aware, with NFC/NFKC normalization and diacritic rules per language (French accents count). It must not assume words are separated by spaces, since Japanese text isn't. It treats kana and kanji as equivalent, accepts optional romaji, and handles hangul.
- **Content schema:** seed phrases have optional `reading` and `romanization` fields.
- **Acceptance criterion:** a test course in a second language loads and scores with no schema change.

## Open items for future languages
- **Japanese:** treating kana and kanji as equivalent means converting the kanji that speech recognition returns into kana readings. That probably needs a dictionary dependency. We'll evaluate size and licensing when Japanese is scheduled.
- **Korean:** choose the unit used for scoring: syllable block, jamo (individual letters), or eojeol (space-separated words).
