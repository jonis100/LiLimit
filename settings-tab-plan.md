# Settings Tab — Implementation Plan

## Motivation

Both `chrome.tabs.onUpdated` (URL navigation) and `chrome.tabs.onActivated` (tab switching) call `handleHostname()`, which increments `visitCounts[hostname]` whenever `lastHandle[tabID] != hostname`.

This means switching to an already-open tab can count as a new visit. Additionally, because `lastHandle` is in-memory only, any MV3 service worker restart resets it — so the very next tab activation after a restart counts as a fresh visit even without any navigation.

Users should be able to choose what counts as a visit: new URL navigations only, or tab switches too.

---

## New Setting

| Key | Type | Default | Description |
|---|---|---|---|
| `countSwitchAsVisit` | `boolean` | **`true`** | When `false`, switching to an existing tab does **not** count as a new visit and does **not** restart the timer. Only navigating to a new URL (via `onUpdated`) triggers `handleHostname()`. |

**Scope:** Global (applies to all tracked hostnames).

---

## Behavior Alignment

Both visit counting and timer start share the **same** guard condition in `handleHostname()` ([background.ts:196-218](src/background/background.ts#L196-L218)):

```ts
// visit counting
if (visitLimits[hostname] && lastHandle[tabID] != hostname) {
  visitCounts[hostname]++;
}
// timer start
if (timeLimits[hostname] && lastHandle[tabID] !== hostname) {
  setTimerForTab(tabID, hostname, timeLimit);
}
```

Because both use the same `lastHandle` check, the setting controls **both** in one shot:
- `countSwitchAsVisit = false` → `onActivated` **skips** `handleHostname()` entirely → no visit increment, no timer restart on tab switch.
- `countSwitchAsVisit = true` → `onActivated` calls `handleHostname()` as it does today → visit count and timer both fire on switch.

Timers are already persisted via `timerStartTimes` in storage and restored on service-worker wake by `restoreTimers()` ([background.ts:169-191](src/background/background.ts#L169-L191)), so skipping `handleHostname()` on activation doesn't break ongoing time tracking.

---

## Implementation Steps

### 1. Types — `src/background/background.ts` (local interfaces)

`StorageData` and `MessageRequest` are defined **locally** in [background.ts:28-40](src/background/background.ts#L28-L40), not in `types.ts`.

Add a `Settings` interface and update `StorageData`:

```ts
interface Settings {
  countSwitchAsVisit: boolean;
}

const DEFAULT_SETTINGS: Settings = { countSwitchAsVisit: true };
```

Add `settings?: Settings` to `StorageData`.

Also export `Settings` from `src/shared/types.ts` so the popup can use it for the message response type.

### 2. Background state — `src/background/background.ts`

Add a module-level variable after the existing state declarations (line ~60):

```ts
let settings: Settings = { ...DEFAULT_SETTINGS };
```

#### 2a. Load settings on startup

Update `initializeFromStorage()` ([background.ts:65-106](src/background/background.ts#L65-L106)) to include `'settings'` in the keys array:

```ts
chrome.storage.local.get(
  ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes', 'settings'],
  ...
)
```

And in the result handler:

```ts
if (result && result.settings) Object.assign(settings, result.settings);
```

> **Do NOT add settings to `updateStorage()`** — settings rarely change (user action only), while `updateStorage()` runs on every timer tick. Keep them separate.

#### 2b. Guard `onActivated`

In `chrome.tabs.onActivated` ([background.ts:309-325](src/background/background.ts#L309-L325)):

```ts
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await initializeFromStorage();
    if (!settings.countSwitchAsVisit) return;   // ← new guard

    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (typeof tab.pendingUrl == 'undefined' && tab.url && tab.id) {
        const hostname = extractHostname(tab.url);
        handleHostname(hostname, tab.id);
      }
    });
  } catch (error) {
    console.log("Can't handle in onActivated:", error);
  }
});
```

#### 2c. Message handlers

Add to the `switch` in `onMessage` ([background.ts:338-430](src/background/background.ts#L338-L430)):

```ts
case 'getSettings': {
  sendResponse({ settings });
  break;
}

case 'setSettings': {
  if (request.settings) {
    Object.assign(settings, request.settings);
    chrome.storage.local.set({ settings });
  }
  sendResponse({ success: true });
  break;
}
```

Update `MessageRequest` to accept an optional `settings` field:

```ts
interface MessageRequest {
  type: string;
  hostname?: string;
  visitLimit?: number;
  timeLimit?: number;
  settings?: Settings;   // ← add
}
```

### 3. Popup UI — `public/popup.html`

Add a 4th tab button to the `<nav>` (after "All Limits", [popup.html:48-52](public/popup.html#L48-L52)):

```html
<button class="tab-btn" data-tab="settings">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l..."/>  <!-- gear icon -->
  </svg>
</button>
```

Add the settings panel (after the "all-limits" div, [popup.html:210](public/popup.html#L210)):

```html
<!-- Settings Tab -->
<div id="settings" class="tab-content">
  <div class="settings-container">
    <h3 class="settings-title">Settings</h3>
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Count tab switch as new visit</span>
        <span class="setting-desc">When off, only navigating to a URL counts as a visit</span>
      </div>
      <label class="toggle">
        <input type="checkbox" id="countSwitchAsVisit" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>
</div>
```

Existing tab system in `initTabs()` ([popup.ts:10-34](src/popup/popup.ts#L10-L34)) already handles any `data-tab` / `.tab-content` pairs — no JS change needed for tab switching itself.

### 4. Popup logic — `src/popup/popup.ts`

Add a `loadSettings()` function and a change listener:

```ts
async function loadSettings(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'getSettings' });
  const toggle = document.getElementById('countSwitchAsVisit') as HTMLInputElement;
  if (toggle && response?.settings) {
    toggle.checked = response.settings.countSwitchAsVisit;
  }
}
```

Wire it up in `initTabs()` — when `targetTab === 'settings'`, call `loadSettings()`.

Add toggle change handler in `DOMContentLoaded`:

```ts
const switchToggle = document.getElementById('countSwitchAsVisit') as HTMLInputElement;
if (switchToggle) {
  switchToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'setSettings',
      settings: { countSwitchAsVisit: switchToggle.checked },
    });
  });
}
```

### 5. Styles — `public/popup.css`

- `.settings-container`, `.setting-row` (flex row with space-between)
- `.setting-label`, `.setting-desc` (text styles)
- `.toggle` / `.toggle-slider` (CSS-only toggle switch)
- Use existing theme variables (`--bg`, `--text`, `--border`, etc.) — no new colors needed.

### 6. Tests — `__tests__/`

- `onActivated` skips `handleHostname()` when `countSwitchAsVisit = false`.
- `onActivated` calls `handleHostname()` when `countSwitchAsVisit = true` (default).
- Settings default to `{ countSwitchAsVisit: true }` when storage is empty.
- `setSettings` message persists to `chrome.storage.local`.
- `getSettings` message returns current settings.

---

## Future / Optional Settings

Not in scope now — candidates for this same settings tab later:

| Setting | Key | Type | Default | Description |
|---|---|---|---|---|
| Daily reset time | `resetHour` | `number` (0–23) | `0` | Hour when visit counts and timers reset |
| Grace period | `gracePeriodSeconds` | `number` | `0` | Extra seconds past limit before block triggers |
| Show badge count | `showVisitBadge` | `boolean` | `true` | Show remaining visits on extension icon badge |
| Snooze duration | `snoozeDurationMinutes` | `number` | `5` | How long "snooze" postpones the block page |
| Block strictness | `blockStyle` | `'hard' \| 'soft'` | `'hard'` | `hard` = redirect, `soft` = overlay with "continue anyway" |
| Pause all limits | `pauseAll` | `boolean` | `false` | Temporarily disable all tracking without deleting limits |
| Notification before limit | `notifyBeforeLimit` | `boolean` | `false` | Browser notification when approaching a limit threshold |
