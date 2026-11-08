# Batch 5 live verification — 2026-11-08 (Taiwan)

Pages build 9725d8d5190f846e6beab82cde7feec5cdebce70 completed successfully.

- Public HTTPS bytes matched all 11 new cover WebP files and all 11 replacement book binaries (22/22).
- Browser homepage showed four cover cards before the compact check-in and weekly-goal row; topic/sample picker followed the featured story and sponsor slot.
- Dark toggle switched the app to `theme-night` with computed background rgb(23,24,32), retained its preference after reload, and switched back to paper from the mobile header.
- At 390px wrapper width both progress panels had equal y=990.06 and width=166.5, height=167.34. Body client/scroll widths matched at wrappers 360 (345/345), 390 (375/375), 768 (753/753). These are viewport checks, not physical device tests.
- New 3A first chapter loaded actual English prose and translation controls. Its visible reading time also triggered the existing daily check-in, reflected in both tabs; this is a test browser's record, not a student result.
- All initial popularity counters were empty, so cards accurately showed editorial selection labels rather than fabricated popularity.
- Screenshot records desktop dark homepage. Source manuscript checks and import selection are documented in IMPORT_BATCH5.md and content-import-batch5.json.
