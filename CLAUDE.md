# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build          # Compile TypeScript + copy static files to dist/
npm run watch          # Continuous compilation (tsc --watch)
npm run clean          # Remove dist/

# Lint & Format
npm run lint           # ESLint + Prettier check
npm run lint:fix       # ESLint auto-fix + Prettier format

# Test
npm test               # Run Jest tests
npm run test:watch     # Jest watch mode
npm run test:coverage  # Jest with coverage report
```

To load the extension in Chrome: go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `dist/` directory.

## Architecture

LiLimit is a Chrome Extension (Manifest V3) written in TypeScript. The extension has three main runtime contexts:

**Background Service Worker** (`src/background/background.ts`)
The core logic. Listens to Chrome tab events (`onUpdated`, `onActivated`, `onRemoved`) to track visits and enforce time limits. Uses `chrome.alarms` for daily midnight resets (survives service worker restarts). Communicates with the popup via `chrome.runtime.onMessage`.

**Popup UI** (`src/popup/popup.ts` + `public/popup.html`)
The user-facing interface with three tabs: "Set Limits", "Live Stats", and "All Limits". Sends messages to the background worker to read/write limits and stats. Handles settings, theme toggle (dark/light via localStorage), stats export, and search/filter.

**Blocked Pages** (`public/pages/time-exceeded.html`, `public/pages/visits-exceeded.html`)
Static pages the background redirects tabs to when a limit is exceeded. `src/pages/countdown.ts` is injected to show time until daily reset.

**Shared** (`src/shared/`)
`types.ts` — TypeScript interfaces for limits, stats, settings, and message types.
`utils.ts` — `extractHostname()` and `limits_to_string()` helpers.

### Data Flow

```
Chrome tab events → Background → chrome.storage.local
Popup form submit → chrome.runtime.sendMessage → Background → Storage
Limit exceeded → Background redirects tab to blocked page
chrome.alarms ("dailyReset") → Background resets visitCounts, dailyTimeSpent, and active timers.
```

### Storage Schema

All data is persisted to `chrome.storage.local`:

- `timeLimits` — `{[hostname]: minutes}`
- `visitLimits` — `{[hostname]: maxVisits}`
- `visitCounts` — `{[hostname]: currentCount}`
- `timerStartTimes` — `{[tabId]: {hostname, startTime}}`
- `dailyTimeSpent` — `{[hostname]: milliseconds}` (accumulated time today; only used when `dailyTimeLimit` is on)
- `settings` — `{dailyTimeLimit: boolean}`

## Testing

Tests live in `__tests__/`. The test environment is jsdom with Chrome extension APIs mocked. Coverage threshold is 50% (currently ~83%).

The background tests address service worker initialization race conditions — the background uses a promise-based init pattern (`isInitialized` promise) to prevent concurrent storage access during startup.

Test manually: ensure no CSP violations, verify background service worker functionality, and check popup/content scripts work correctly after manifest changes.

## Build System

TypeScript compiles `src/` → `dist/`. Static files (`manifest.json`, HTML, CSS, images) are copied from `public/` to `dist/` via `npm run copy:static`. There is no bundler (webpack/vite) — the extension uses native ES modules.

CI runs lint → test → build sequentially via GitHub Actions (`.github/workflows/ci.yml`).

## Git Workflow

- Main branch: `main`
- Create feature branches from main with descriptive names (e.g., `fix/csp-violations`, `feature/dark-mode`)
- Do not include Claude as co-author in commits or add "Generated with Claude Code" messages

## PR Review Process

- Use `gh pr view <PR_NUMBER>` to see PR details
- Check comments with `gh api repos/jonis100/LiLimit/pulls/<PR_NUMBER>/comments`
- Address all feedback by fixing issues or responding to discuss, then push to the PR branch

## Release Process

1. Increment version in `manifest.json` following semantic versioning and commit
2. Push all changes to the target branch
3. Use `gh release create v<VERSION>` with release notes covering features, bug fixes, and other changes
4. Target `main` for production releases

## Code Style

- Only add comments for complex logic, important warnings/edge cases, or JSDoc — not to restate what code does
- Run `npm run lint:fix` before committing
