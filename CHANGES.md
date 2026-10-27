# Changes Log 1.4.3 version

## Branch: main

### Features

- **Time Left tab:** A new popup tab shows how much time is left on each limited site. In per-visit mode it lists the sites with a running timer; in daily mode it lists every site with a time limit. A time limit can be removed from here while keeping the site's visit limit. (#37)
- **"Count tab switches as visits" setting:** Switching back to an already-open tab no longer counts as a new visit by default. Turn this setting on to count tab switches as visits, as before. (#41)

### Bug Fixes

- **Toolbar icon matches browser theme:** The toolbar icon now switches between light and dark versions to match the browser's theme, so it stays visible in dark mode. (#42, #43)
- **Timers stop when they should:** Timers now pause when Chrome loses focus and stop when a limited tab is closed. (#37)

- **Daily limits now reset reliably:** Limits previously reset only if Chrome was open at midnight. A missed reset now happens the first time Chrome starts on a new day, so there's no need to remove and re-add sites. (#39)
- **Time limits are enforced on time:** Time limits now use Chrome alarms, so a limit expires even while you stay on the same page without switching tabs or navigating. (#40)
- **Daily time budget counts correctly:** Switching tabs pauses the daily timer again after Chrome restarts the extension in the background, and time while Chrome was closed is no longer counted against the budget. (#39)
- **Per-visit timers no longer restart:** Returning to a tab no longer restarts its per-visit timer or counts an extra visit after the extension was restarted in the background. (#39)

---

**Last Updated:** 2026-10-27
