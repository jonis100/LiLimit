# Settings Tab — Implementation Plan

## Motivation

Currently, the time limit per website resets on every visit — each time you navigate to a site, you get the full X minutes fresh. This means you can visit a site 20 times and never accumulate more than X minutes of time pressure.

The settings tab lets users switch to **daily time limit mode**, where time spent on a website accumulates across all visits throughout the day. Once you've used up your X-minute budget for the day, you're blocked — regardless of how many separate visits it took.

---

## New Setting

| Key              | Type      | Default     | Description                                                                                                                            |
| ---------------- | --------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `dailyTimeLimit` | `boolean` | **`false`** | When `true`, time spent on a site accumulates across all visits today. When `false` (default), each visit gets a fresh X-minute timer. |

**Scope:** Global (applies to all tracked hostnames).

---

## Behavior

### Per-visit mode (`dailyTimeLimit = false`, default)

Existing behavior: each new navigation to a tracked hostname starts a fresh timer. Switching to the tab or re-opening it resets nothing — the same visit's timer keeps running.

### Daily mode (`dailyTimeLimit = true`)

- A `dailyTimeSpent[hostname]` counter (in ms) accumulates time across all visits.
- When you navigate to or activate a tracked tab: check remaining = `timeLimit * 60000 - dailyTimeSpent[hostname]`. If ≤ 0, redirect immediately. Otherwise start a timer for the remaining time.
- When you switch away from a tab (another tab activated): add elapsed ms to `dailyTimeSpent[hostname]` and pause the timer.
- When you navigate to a different URL in the same tab: add elapsed ms before clearing the timer.
- When the timer fires (time runs out mid-visit): mark `dailyTimeSpent[hostname] = timeLimit * 60000` so any new visit is blocked immediately.
- At midnight daily reset: `dailyTimeSpent` is cleared along with visit counts and timers.
- On service worker restart (`restoreTimers`): elapsed time since the interrupted session start is added to `dailyTimeSpent` before resuming.

---

## Implementation

### 1. Types — `src/shared/types.ts`

```ts
export interface Settings {
  dailyTimeLimit: boolean;
}
```

### 2. Background state — `src/background/background.ts`

```ts
interface Settings {
  dailyTimeLimit: boolean;
}
const DEFAULT_SETTINGS: Settings = { dailyTimeLimit: false };
```

New module-level state:

```ts
const dailyTimeSpent: { [hostname: string]: number } = {};
let currentActiveTabId: number | null = null;
```

Add `dailyTimeSpent` to `StorageData`, `initializeFromStorage` (keys + result handler), `updateStorage`, and the daily reset alarm handler.

### 3. `handleHostname()` — time limit branch

```ts
if (timeLimits[hostname]) {
  if (settings.dailyTimeLimit) {
    if (!timers[tabID]) {
      // no active timer = tab was inactive or first visit
      const remainingMs = timeLimits[hostname] * 60000 - (dailyTimeSpent[hostname] || 0);
      if (remainingMs <= 0) {
        redirectTabToTimeExceeded(tabID);
        return;
      }
      setTimerForTab(tabID, hostname, remainingMs / 60000);
    }
  } else if (lastHandle[tabID] !== hostname) {
    setTimerForTab(tabID, hostname, timeLimits[hostname]);
  }
}
```

### 4. `onActivated` — pause previous tab in daily mode

```ts
if (
  settings.dailyTimeLimit &&
  currentActiveTabId !== null &&
  currentActiveTabId !== activeInfo.tabId
) {
  if (timerStartTimes[prevTabId]) {
    const elapsed = Date.now() - timerStartTimes[prevTabId].startTime;
    dailyTimeSpent[hostname] = (dailyTimeSpent[hostname] || 0) + elapsed;
    clearTimeout(timers[prevTabId]);
    delete timers[prevTabId];
    delete timerStartTimes[prevTabId];
    updateStorage();
  }
}
currentActiveTabId = activeInfo.tabId;
```

### 5. `onUpdated` — accumulate before clearing timer

When navigating away from a hostname in daily mode, add elapsed time before the existing timer-clear logic.

### 6. `setTimerForTab` — mark hostname fully spent on expiry

```ts
const timer = setTimeout(() => {
  if (settings.dailyTimeLimit) dailyTimeSpent[hostname] = timeLimits[hostname] * 60000;
  // ... existing cleanup + redirect
}, remainingMinutes * 60000);
```

### 7. `restoreTimers` — daily mode path

Accumulate elapsed time from the interrupted segment, then resume or block:

```ts
if (settings.dailyTimeLimit) {
  dailyTimeSpent[hostname] += Date.now() - startTime;
  delete timerStartTimes[tabID];
  const remainingMs = timeLimit * 60000 - dailyTimeSpent[hostname];
  remainingMs > 0
    ? setTimerForTab(tabID, hostname, remainingMs / 60000)
    : redirectTabToTimeExceeded(tabID);
}
```

### 8. Popup UI — `public/popup.html`

Settings panel row:

```html
<div class="setting-row">
  <div class="setting-info">
    <span class="setting-label">Daily time limit</span>
    <span class="setting-desc"
      >When on, time accumulates across all visits today instead of resetting each visit</span
    >
  </div>
  <label class="toggle">
    <input type="checkbox" id="dailyTimeLimit" />
    <span class="toggle-slider"></span>
  </label>
</div>
```

### 9. Popup logic — `src/popup/popup.ts`

`loadSettings()` reads `response.settings.dailyTimeLimit` into `#dailyTimeLimit` checkbox.
Change listener sends `{ type: 'setSettings', settings: { dailyTimeLimit: toggle.checked } }`.

### 10. Tests — `__tests__/`

- Default `settings.dailyTimeLimit` is `false`.
- `setSettings` persists `dailyTimeLimit` to `chrome.storage.local`.
- `getSettings` returns current settings.
- `onActivated` in daily mode pauses the previous tab's timer and accumulates elapsed time.
- `handleHostname` in daily mode redirects immediately when `dailyTimeSpent >= timeLimit`.
- Storage keys include `dailyTimeSpent`.

---

## Future / Optional Settings

Not in scope now — candidates for this same settings tab later:

| Setting                   | Key                     | Type               | Default  | Description                                                |
| ------------------------- | ----------------------- | ------------------ | -------- | ---------------------------------------------------------- |
| Daily reset time          | `resetHour`             | `number` (0–23)    | `0`      | Hour when visit counts and timers reset                    |
| Grace period              | `gracePeriodSeconds`    | `number`           | `0`      | Extra seconds past limit before block triggers             |
| Show badge count          | `showVisitBadge`        | `boolean`          | `true`   | Show remaining visits on extension icon badge              |
| Snooze duration           | `snoozeDurationMinutes` | `number`           | `5`      | How long "snooze" postpones the block page                 |
| Block strictness          | `blockStyle`            | `'hard' \| 'soft'` | `'hard'` | `hard` = redirect, `soft` = overlay with "continue anyway" |
| Pause all limits          | `pauseAll`              | `boolean`          | `false`  | Temporarily disable all tracking without deleting limits   |
| Notification before limit | `notifyBeforeLimit`     | `boolean`          | `false`  | Browser notification when approaching a limit threshold    |
