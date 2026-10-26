# Changes Log 1.4.3 version

## Branch: main

### Bug Fixes

- **Daily limits now reset reliably:** Limits previously reset only if Chrome was open at midnight. A missed reset now happens the first time Chrome starts on a new day, so there's no need to remove and re-add sites. (#39)
- **Time limits are enforced on time:** Time limits now use Chrome alarms, so a limit expires even while you stay on the same page without switching tabs or navigating. (#40)
- **Daily time budget counts correctly:** Switching tabs pauses the daily timer again after Chrome restarts the extension in the background, and time while Chrome was closed is no longer counted against the budget. (#39)
- **Per-visit timers no longer restart:** Returning to a tab no longer restarts its per-visit timer or counts an extra visit after the extension was restarted in the background. (#39)

---

**Last Updated:** 2026-10-26
