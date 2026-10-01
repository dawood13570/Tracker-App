# Reckon / Tracker-App

An offline personal tracker built with Expo SDK 57, React Native, SQLite/Drizzle, and Zustand.

- **Today:** tasks, reversible habit logs, events, and activity logs.
- **Horizon:** weekly, monthly, yearly, and custom goals, with generated daily work and read-only projections.
- **Pursuits:** user-declared status and an overview linking tasks, habits, events, activities, and reflections.
- **Notes:** editable titles, local drafts, correct period routing, and explicitly saved summary snapshots.
- **Account:** persistent preferences, optional local reminders, task history, JSON export/import, and recovery from the last restore.

## Development

Use Node 24 (the regression harness uses built-in SQLite).

```sh
npm ci
npm run check
npm start
```

Use a native development build for device testing:

```sh
npm run android
# macOS + Xcode:
npm run ios
```

The backup picker/sharing and notification integrations need their native modules. Rebuild the development client after dependency changes. Web is not the supported verification target for the native SQLite app.

```sh
EXPO_OFFLINE=1 CI=1 npm run bundle:android
```

`npm test` exercises the real Drizzle queries against an in-memory SQLite database, applying all SQL migrations. CI runs type checks, regression tests, and an Android Metro export. A successful export does not replace a device smoke test.

## Behavior that matters

Rollover preserves the old history row and carries unfinished work into one new occurrence with its metadata, progress, and milestones. Identity comes from a series ID, never the title. With Repeat and Rollover together, the carried occurrence stays a single task; completing it schedules the next repeat. Repeated done/undo/done does not create extra copies. Skipping a recurring occurrence schedules its successor without counting the skipped occurrence as completed.

Completion, numeric progress, subtask completion, and ancestor updates share transactional lifecycle code. Generated targets stop changing once work has started. Sequential milestones enforce their order in the database write path. Carried progress is excluded from aggregate totals when its original logs are already included.

Surplus choices share one path for the slider and progress sheet. “Keep pace” retains the baseline, “Ease pace” lowers future allocations with a 50% floor, “Bank” earns explicit rest days, and “Raise target” requires a deliberate choice. Rest days pause existing generated allocations through the next app-day boundary.

Night-owl cutoff, rollover, logging, and date refresh use the same app-day convention. Background execution is opportunistic; opening/resuming the app also reconciles rollover. Local reminder delivery depends on device permission and OS scheduling. The morning notification is a check-in reminder, not a live background-generated agenda.

## Data and recovery

Migrations are bundled in `drizzle/migrations.js`. Foreign keys are enabled after legacy table-rebuild migrations. New multi-record task, goal, habit, event, and activity saves use synchronous transactions: never put an async callback inside Expo's synchronous Drizzle transaction.

Export backups from Account and save them outside the app. Import validates the schema, relationships, cycles, and preferences, writes a recovery copy, then replaces records in one transaction. “Recover before last restore” restores that copy. Device-local drafts and settings are included. Uninstalling the app can erase both live data and the local recovery copy.

Historical completion times cannot be reconstructed. New history records carry exact timestamps and app dates. Legacy progress logs use their local calendar date because the historical night-owl settings were not recorded. Previously hidden notes are preserved and exposed as editable reflections.

See [offline repair notes and device checks](doc/OFFLINE_REPAIR.md). The original [roadmap](doc/ROADMAP.md) is a historical planning record. Cloud accounts, sync, and online services remain deferred.
