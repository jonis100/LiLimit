# Changes Log 1.4.1 version

## Branch: user-reject-feedback

### New Features

- **Logo Easter Egg:** Triple-clicking the LiLimit logo (3 clicks within 10 seconds) reveals a friendly message with feedback contact information. A subtle visual cue (cursor pointer and hover animation) hints at the logo's interactivity.
- **Next-Tip Button:** Added an interactive button next to footer tips allowing users to manually navigate through helpful tips instead of waiting for the automatic rotation. Tips include usage hints and the feedback email address.

### Bug Fixes

- **Clear form fields after setting a limit:** The hostname, time limit, and visit limit inputs are now cleared after submitting the form.
- **Remove active timers when a limit is deleted:** Deleting a host's limit now cancels any running timers for that host, preventing stale timeouts from firing after the limit no longer exists.

---

## Archived Documentation

### User Feedback Strategy (Not Implemented)

A comprehensive user feedback and retention strategy was designed but not implemented.

**Reference:** [`docs/FEEDBACK_STRATEGY.md`](docs/FEEDBACK_STRATEGY.md) (📦 Archived)

**Summary:**

- Proposed intent-based feedback collection system
- No backend, privacy-first design
- Anonymous feedback via Google Form
- Reinstall detection using `chrome.storage.sync`
- Trigger points: 7-day inactivity or deleting all limits

**Status:** Archived for potential future implementation

**Design Principle:** _"Ask early. Ask once. Respect privacy. Learn aggressively."_

---

**Last Updated:** 2026-02-09
