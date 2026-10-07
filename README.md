# Atlas

Atlas is a speaking-first language learning app. It is built with Expo / React Native (Expo Router, TypeScript) with native iOS capabilities added through development builds.

## Requirements

- Node 22 (see `.nvmrc`; `nvm use`)
- macOS with Xcode and the iOS Simulator for running the app

## Setup

```bash
nvm use            # Node 22
npm ci             # install exact locked dependencies
npx expo run:ios   # build the dev client and launch it in the iOS Simulator
```

After the first native build, `npm start` starts the Metro dev server for the installed dev client. Rebuild with `npx expo run:ios` whenever native dependencies or `app.json` native config change.

Cloud alternative (requires an Expo account and linking the project with EAS): `npx eas-cli@latest build --profile development` produces a simulator build.

## Scripts

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm start`         | Start the Expo dev server                      |
| `npm run ios`       | Start the dev server and open the iOS Simulator |
| `npm run lint`      | ESLint (`expo lint`, eslint-config-expo)       |
| `npm run typecheck` | TypeScript (`tsc --noEmit`)                    |
| `npm test`          | Jest (jest-expo preset + Testing Library)      |
| `npm run db:generate` | Generate a Drizzle migration after editing `src/data/schema.ts` |
| `npm run doctor`    | `expo-doctor` dependency/config checks         |

CI is not set up yet. Until it is, run `npm run lint`, `npm run typecheck` and `npm test` locally before every pull request.

## License

Proprietary. Copyright (c) 2026 Daniel Santoyo. All rights reserved. See `LICENSE`.
