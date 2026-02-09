# LiLimit - User Feedback & Uninstall Strategy

> **📦 ARCHIVED** - This document describes a proposed feedback feature that was not implemented. Kept for future reference.
>
> **Date Archived:** 2026-02-09
> **Status:** Not implemented, may be reconsidered in future releases

---

## Goal

Understand _why users uninstall or stop using LiLimit_ **without adding a backend**, and use that signal to improve UX, stability, and perceived value.

This strategy focuses on **early intent detection**, **low-friction feedback**, and **privacy-first design**.

---

## Constraints

- No backend / server
- No uninstall callback UI (Chrome limitation)
- No tracking users across devices
- Local storage allowed (`chrome.storage.sync` for cross-reinstall persistence)
- External links allowed (Google Form for anonymous feedback)

---

## Key Reality

Chrome does **not** provide:

- Uninstall reason
- Uninstall event with UI
- Access to Chrome's uninstall dialog

Therefore, feedback must be collected **before uninstall**.

---

## Strategy Overview

We collect feedback using **signals of uninstall intent**, not uninstall itself.

### Intent Signals

Trigger feedback prompt **once** when any of these happen:

- User hasn't opened the popup in **7+ days** (inactivity)
- User **deletes all their limits** via the popup UI

### What We Don't Detect

These signals are **not technically feasible** for a Chrome extension to detect about itself:

- Extension being disabled (code stops running)
- Permissions being revoked
- Extension being uninstalled

---

## Feedback Prompt Design

### Rules

- Show **once only** per install
- Always allow **Skip**
- Never block user action
- No guilt or dark patterns

### Copy

> "Not finding LiLimit helpful? We'd love to hear why. (1 click, anonymous)"

### Options (Clickable Chips)

- Hard to use
- Broke a website
- Too many interruptions
- Don't need it
- Other

---

## Where Feedback Goes

### Primary: Google Form (Anonymous)

On chip click, open a Google Form in a new tab with the selected reason pre-filled as a URL parameter. The form is:

- Anonymous (no sign-in required)
- Zero-friction (reason is pre-filled)
- External (no backend needed)

### Secondary: Local Storage (Reinstall Detection)

All feedback data is also stored locally in `chrome.storage.sync`:

```json
{
  "feedbackMeta": {
    "installDate": 1700000000000,
    "firstLimitSetDate": 1700000100000,
    "lastPopupOpenDate": 1700000200000,
    "limitsDeletedCount": 2,
    "feedbackShownDate": 1700000300000,
    "feedbackSubmitted": true,
    "feedbackReason": "Broke a website",
    "feedbackSkipped": false,
    "welcomeBackShown": false,
    "version": "1.4.0"
  }
}
```

`chrome.storage.sync` persists across uninstall/reinstall (when user is signed into Chrome), enabling reinstall detection.

---

## Reinstall Handling

If a user reinstalls and previous feedback exists in `chrome.storage.sync`:

> "Last time you stopped using LiLimit because: 'Broke a website'. This may be fixed now!"

This targets _returning users_, who are the most valuable. The welcome-back banner:

- Shows once (tracked via `welcomeBackShown` flag)
- Takes priority over the feedback banner
- Has a "Got it" dismiss button

---

## Passive Metrics (No User Interaction)

Tracked automatically in `chrome.storage.sync`:

| Metric               | What It Tells You                               |
| -------------------- | ----------------------------------------------- |
| `installDate`        | How long the user had the extension             |
| `firstLimitSetDate`  | Whether they ever engaged with the core feature |
| `lastPopupOpenDate`  | When they last interacted                       |
| `limitsDeletedCount` | Signal of frustration or changing needs         |
| `feedbackShownDate`  | When feedback prompt was displayed (or null)    |

### Insights You Can Infer

- `firstLimitSetDate` is null -> onboarding failure (never set a limit)
- Install to first limit > 24h -> unclear value proposition
- `limitsDeletedCount` high -> limits aren't working as expected
- Feedback after 7 days inactive -> gradual abandonment
- Feedback after deleting all limits -> active decision to stop

---

## What NOT To Do

- Ask repeatedly (once per install, period)
- Hide feedback behind many clicks
- Pretend you know why they uninstalled
- Add telemetry without clear user benefit
- Block any user action with the feedback prompt
- Use dark patterns or guilt-tripping copy

---

## Implementation

### Trigger Points

1. **Inactivity**: Popup opened after 7+ days of no opens
2. **All limits deleted**: User deletes their last remaining limit

### Data Flow

```
Popup opens -> getFeedbackMeta from chrome.storage.sync
            -> Check: welcomeBackShown? feedbackShown? inactive?
            -> Show appropriate banner (or nothing)
            -> Update lastPopupOpenDate

User clicks chip -> Store reason locally
                 -> Open Google Form in new tab
                 -> Mark feedbackShown = true

User clicks Skip -> Mark feedbackShown = true
                 -> No form opened
```

### Storage

Uses `chrome.storage.sync` (not `.local`) because:

- Persists across uninstall/reinstall
- Covered by existing `"storage"` permission
- Well under quota limits (~1KB vs 102KB max)

---

## Success Criteria

This strategy is working if:

- You see repeated patterns in Google Form responses
- Reinstalling users see the welcome-back banner and re-engage
- Passive metrics reveal common drop-off points
- You can prioritize fixes based on real feedback data

---

## Future Improvements

- 30-second onboarding flow (highest impact on retention)
- Feature usage hints before churn signals appear
- Per-site auto-disable suggestions for compatibility issues

---

**Principle:**

> Ask early. Ask once. Respect privacy. Learn aggressively.
