# Offline repair pass

This pass replaces completion/recurrence/rollover writes with transactional lifecycle operations and adds explicit occurrence identity. It retains historical rows instead of deleting a task because its title matches another task. A migration separates legacy rollover links from decomposition links, preserves notes, and adds progress dates, movement/completion history, pursuit links, and supporting indexes.

Pursuits now link tasks, habits, events, activities, and notes. Their status remains a user decision. Notes support local drafts, titles, pursuit membership, and explicit summary snapshots; opening a note never regenerates or rewrites it. Task/goal/habit/event editors save their associated tags and subtasks atomically. Progress, undo, generated milestone templates, stable targets, strict tag matching, calendar projections, date rollover, settings persistence, backups, first-run guidance, swipe actions, and local reminder settings are included.

## Regression coverage

`npm run check` runs TypeScript and the SQLite regression suite. The suite covers recurrence idempotency, rollover metadata and identity, completion/undo propagation, stable started targets, cascade deletion and pursuit unlinking, reversible habits, night-owl dates and persistence, atomic editor rollback, recurring milestone copies, backup validation and rollback, automatic bank coverage and corrections, legacy migration preservation, sequential milestone guards, carried-progress aggregation, skipping/postponing, and input validation.

The native Expo SQLite adapter is replaced by Node's SQLite adapter in tests. SQL migrations, Drizzle queries, transaction boundaries, constraints, and lifecycle code are real. Native file pickers, background tasks, gestures, and notification delivery still require the device checks below.

## Device checks before release

1. Upgrade a development installation containing existing tasks, subtasks, notes, tags, and pursuits. Verify counts and links, including notes titled “Reflection.” Keep an external backup first.
2. Create two independent tasks with the same title. Enable Repeat and Rollover on one, log partial progress, miss an app day, and resume. Verify one carried occurrence and the unrelated task; complete/undo/complete and confirm one successor.
3. Complete and reopen sequential milestones from Today and Pursuits. Test a recurring milestone group independently from its template. Verify sliders and the log sheet offer the same surplus choices.
4. Log 10 pages against a 5-page allocation and select Bank. Open the next day and verify 5 pages are covered with zero actual progress. Log 5 pages there and verify coverage moves forward. Correct the original 10 to 5 and verify the bank is reversed. Repeat with 7 pages to test partial coverage. Test a December–January week and an old split-week migration.
5. Save a draft, close the sheet, force-stop/reopen, and recover it. Open a weekly or custom note from history and confirm the correct note and scope. Toggle theme while editing and confirm the form survives.
6. Link and unlink each entity type in a pursuit. Delete the pursuit and verify its tasks, habits, events, activities, and notes remain.
7. Export to Files, make a change, import, and verify records/tags/settings/drafts. Recover the pre-import copy. Try a malformed backup; live data must remain intact.
8. Test denied and granted notification permission. Schedule a morning reminder and disable it. Verify opening the app still rolls over tasks when notifications are denied.
9. Test night-owl cutoff, manual finalization, foreground midnight, timezone travel, and a daylight-saving transition. Event times remain civil calendar times; task/habit/activity logs use app days.
10. Test swipe complete/reopen, postpone, and skip, plus screen-reader actions. Browse future Horizon dates; projections should not turn into stored work until explicitly scheduled or the day arrives.

## Deferred

Cloud accounts, authentication, remote backup, bidirectional sync, conflict resolution, and online services are deliberately outside this pass. A live background-generated morning agenda is not promised by the local check-in reminder. Device checks and a production binary are release validation, not evidence provided by a Metro export.
