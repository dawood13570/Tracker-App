# Development Roadmap
> Format: Milestone → Goal → Task (1 → 1.1 → 1.1.1)
> Update status as you go: [ ] todo · [x] done · [~] in progress · [!] blocked/skipped

---

## Milestone 1 — Learn the Tools While Building Real UI
**Target: ~1-2 weeks**
**Done when:** Fake Today screen looks correct, three task types are visually distinct,
form works, pressing a task toggles its visual state. Zero real data yet.

---

### 1.1 — Set Up Project Structure
**Done when:** All folders exist, no empty crashes, you understand what each folder is for.

- [x] 1.1.1 — Create `/app` folder with placeholder `today.tsx`, `week.tsx`, `month.tsx`, `goals.tsx`
- [x] 1.1.2 — Create `/components` folder with empty `TaskCard.tsx`, `ProgressBar.tsx`, `ProcrastinationBadge.tsx`
- [x] 1.1.3 — Create `/store` folder with empty `taskStore.ts`
- [x] 1.1.4 — Create `/db` folder with empty `schema.ts`, `queries.ts`, and a `/migrations` subfolder
- [x] 1.1.5 — Create `/engine` folder with empty `rollover.ts`, `recurrence.ts`, `pace.ts`
- [x] 1.1.6 — Create `/services` folder with empty `notifications.ts`, `sync.ts`
- [x] 1.1.7 — Create `/docs` folder and move VISION.md and ROADMAP.md into it
- [x] 1.1.8 — Confirm app still launches with no errors after restructure

---

### 1.2 — Build a Static Today Screen
**Done when:** Today screen renders a hardcoded list of tasks. Scrollable. Looks intentional.

- [x] 1.2.1 — Create a hardcoded array of 5-6 fake tasks in `today.tsx` with varied types and priorities
- [x] 1.2.2 — Render the list using `FlatList` (not `ScrollView` — learn why FlatList is better for lists)
- [x] 1.2.3 — Add a date header at the top showing today's date ("Tuesday, July 7")
- [x] 1.2.4 — Add a basic count summary: "4 tasks · 1 high priority"
- [x] 1.2.5 — Make it not ugly: consistent padding, readable font sizes, clear hierarchy

---

### 1.3 — Build the TaskCard Component
**Done when:** TaskCard renders all three types visually differently. Pass it any task object, it renders correctly.

- [x] 1.3.1 — Create `TaskCard.tsx` that accepts a `task` prop
- [x] 1.3.2 — Simple task: plain card, checkbox on the left, title, priority indicator
- [x] 1.3.3 — Progression task: same as simple but with a thin progress bar at the bottom and "X / Y unit" label
- [x] 1.3.4 — Hybrid task: same as simple but with a sub-task count badge ("3/5 done")
- [x] 1.3.5 — High priority tasks get a distinct visual treatment (color accent, bold, or icon — pick one and commit)
- [x] 1.3.6 — Add `ProcrastinationBadge` to TaskCard: only shows if `procrastination_count > 0`, displays "+N days"
- [x] 1.3.7 — Replace the hardcoded rendering in `today.tsx` with `<TaskCard task={item} />` inside FlatList

---

### 1.4 — Build the New Task Form
**Done when:** You can open a form, fill it in, and see the values in console.log. Nothing saves yet.

- [x] 1.4.1 — Create `new-task.tsx` screen (or a bottom sheet modal — your choice, bottom sheet feels better)
- [x] 1.4.2 — Add a text input for task title
- [x] 1.4.3 — Add a type selector: Simple / Progression / Hybrid (three tappable options, not a dropdown)
- [x] 1.4.4 — Show/hide progression fields (target value, unit, deadline) based on selected type
- [x] 1.4.5 — Add priority selector: Low / Normal / High
- [x] 1.4.6 — Add a toggle for "Move to next day if not completed" (rollover)
- [!] 1.4.7 — Add a recurrence selector: None / Daily / Every N days / Weekly
- [x] 1.4.8 — Add a Submit button that `console.log`s the full form state
- [x] 1.4.9 — Add a button on the Today screen that navigates to this form

---

### 1.5 — Local Visual Interaction
**Done when:** Tapping a task visually marks it done/undone. No DB involved.

- [x] 1.5.1 — Add `useState` to track which task IDs are "done" in the Today screen
- [x] 1.5.2 — Pass an `onToggle` callback from Today into TaskCard
- [x] 1.5.3 — When toggled, apply a visual done state: strikethrough title, reduced opacity, checkbox filled
- [x] 1.5.4 — Tapping again undoes it
- [!] 1.5.5 — Done tasks sink to the bottom of the list automatically (sort by status)

---

## Milestone 2 — Real Data with SQLite
**Target: ~1-2 weeks**
**Done when:** Full CRUD works, data survives app restarts, Zustand manages shared state.

---

### 2.1 — Database Setup
**Done when:** DB initialises on app launch, table exists, no errors. 

- [x] 2.1.1 — Install `expo-sqlite` and `drizzle-orm`
- [x] 2.1.2 — Write the `tasks` table schema in `/db/schema.ts` using all fields from the spec
- [x] 2.1.3 — Write the `progress_logs` table schema
- [x] 2.1.4 — Write the `goals` table schema (even if empty — defines the shape now)
- [x] 2.1.5 — Set up the DB connection and run initial migration on app start
- [x] 2.1.6 — Verify tables exist
- [x] 2.1.7 — Sketch (schema only, no UI/logic yet) `habits`, `habit_logs`, `events`, `notes`, `tags`, and `task_tags` table shapes in `/db/schema.ts` — cheap to define now, expensive to retrofit later

---

### 2.2 — Create Tasks
**Done when:** Submitting the New Task form saves a real row to SQLite.

- [x] 2.2.1 — Write an `insertTask` function in `/db/queries.ts`
- [x] 2.2.2 — Wire the form's Submit button to call `insertTask` instead of `console.log`
- [x] 2.2.3 — After save, navigate back to Today screen
- [x] 2.2.4 — Confirm row appears

---

### 2.3 — Read Tasks
**Done when:** Today screen loads real tasks from DB on mount.

- [x] 2.3.1 — Replace hardcoded task array in today.tsx with a call to the DB on mount
- [x] 2.3.2 — Filter by scheduled_date. Current query (db.select().from(tasksTable)) has no WHERE clause — it pulls every task ever created, not just today's. Invisible now with a handful of test tasks; will misbehave once tasks accumulate across days. Priority item.
- [x] 2.3.3 — Handle loading state: show a spinner while tasks load
- [x] 2.3.4 — Handle empty state: show a friendly message if no tasks today

---

### 2.4 — Update Task Status
**Done when:** Marking done/undone writes to DB and persists after app restart.

- [x] 2.4.1 — Write a `toggleTaskStatus(id, currentStatus)` function in `/db/queries.ts` (schema uses boolean isCompleted, not a status string — function name/shape matches that)
- [x] 2.4.2 — Replace the local `useState` toggle with a call to `toggleTaskStatus`
- [x] 2.4.3 — Reflect the change in UI immediately (optimistic local update rather than a full re-fetch — fine, since the DB write already succeeded first)
- [x] 2.4.4 — Confirm status persists after closing and reopening app

---

### 2.5 — Edit and Delete Tasks
**Done when:** Long-press opens edit options. Edit pre-fills form. Delete removes from list.

- [x] 2.5.1 — Write `updateTask(id, fields)` and `deleteTask(id)` in `/db/queries.ts`
- [x] 2.5.2 — Add long-press handler on TaskCard that opens an action sheet (Edit / Delete / Cancel)
- [x] 2.5.3 — Edit navigates to the New Task form pre-filled with existing task data
- [x] 2.5.4 — Delete removes the task and updates the list immediately
- [x] 2.5.5 — Add a confirmation dialog before delete ("Are you sure?")

---

### 2.6 — Zustand State Management
**Done when:** Task state lives in the store, not in individual screen components.

- [x] 2.6.1 — Install `zustand`
- [x] 2.6.2 — Create `taskStore.ts` with state: `tasks`, `isLoading`, `selectedDate`
- [x] 2.6.3 — Create actions: `loadTasks`, `addTask`, `updateTask`, `removeTask`
- [x] 2.6.4 — Replace all direct DB calls in screens with store actions
- [x] 2.6.5 — Confirm Today screen and any other screen that uses tasks stays in sync automatically

---

## Milestone 3 — Task Intelligence
**Target: ~2 weeks**
**Done when:** Midnight rollover works, recurring tasks self-regenerate, procrastination counter is live.

---

### 3.1 — Procrastination Counter Display
**Done when:** Tasks that have been moved show correct count visually.

- [x] 3.1.1 — Manually update a test task's `procrastination_count` to 3
- [x] 3.1.2 — Confirm `ProcrastinationBadge` renders "+3 days" on that task
- [x] 3.1.3 — Badge is invisible when count is 0
- [x] 3.1.4 — Choose a visual design: subtle for +1, more prominent for +3, alarming for +7+

---

### 3.2 — Rollover Logic (Pure Function First)
**Done when:** The rollover function produces correct output given test inputs, no DB or background job yet.

**Note**: no status field exists (schema stays 2-state: isCompleted boolean only — decided 2026-07-18). "Skipped" isn't a stored state — a task that isn't rolled forward just keeps its original scheduledDate and naturally stops appearing on Today once the day passes. There's only one kind of mutation: roll forward. Everything else is simply left untouched.

- [x] 3.2.1 — Write `processRollover(tasks, today)` in `/engine/rollover.ts`
- [x] 3.2.2 — It takes an array of yesterday's tasks and returns an array of mutations (only rollover tasks produce a mutation; everything else produces none)
- [x] 3.2.3 — Rule: `isCompleted === false` + `rolloverEnabled === true` → mutation: `scheduledDate` = today, `procrastinationCount` + 1 (priority irrelevant here — see decisions log, 2026-07-19)
- [x] 3.2.4 — Rule: `isCompleted === false` + `rolloverEnabled === false` → no mutation, left as-is on its original date
- [x] 3.2.5 — Rule: `isCompleted === true` → no mutation
- [x] 3.2.6 — Write 5 manual test cases (plain JS objects as input, assert on output). No test framework needed yet, just `console.log` and check.

---

### 3.3 — Rollover as Background Job
**Done when:** App runs the rollover at midnight without being open.

- [x] 3.3.1 — Install `expo-task-manager` and `expo-background-fetch`
- [x] 3.3.2 — Register a background task named `MIDNIGHT_ROLLOVER`
- [x] 3.3.3 — Inside the task: fetch yesterday's tasks from DB, run `processRollover`, apply mutations
- [x] 3.3.4 — Schedule the task to run once daily (as close to midnight as Android allows)
- [x] 3.3.5 — Test by temporarily setting the trigger to 1 minute and confirming tasks move
- [x] 3.3.6 — Send a local notification after rollover: "Good morning. X tasks carried over."
- [x] 3.3.7 — Restore trigger to daily / midnight after testing

---

### 3.4 — Recurrence Engine
**Done when:** Completing a recurring task automatically creates the next occurrence.

- [x] 3.4.1 — Install `date-fns` for date arithmetic
- [x] 3.4.2 — Write `getNextOccurrence(task, fromDate)` in `/engine/recurrence.ts`
- [x] 3.4.3 — Handle daily: next day
- [x] 3.4.4 — Handle every_n_days: fromDate + N
- [x] 3.4.5 — Handle weekly with specific days: find next matching weekday
- [x] 3.4.6 — Hook into the store's `toggleTask`: when a recurring task is marked done, call `getNextOccurrence` and insert a new task row (clone of the current with new date, `isCompleted: false`, `procrastinationCount: 0`)
- [x] 3.4.7 — Confirm the original completed task is untouched in DB

---
### 3.5 — Priority System
**Done when:** Priority is assignable, visually meaningful, and affects rollover behaviour.

- [x] 3.5.1 — Confirm priority field is in schema and form (done since Milestone 2)
- [x] 3.5.2 — High priority tasks: stronger visual treatment on TaskCard (confirm it's clearly distinct)
- [x] 3.5.3 — Today screen sorts: `High` priority first, then `Medium`, then `Low`, then `Done` at bottom
- [!] 3.5.4 — ~~Confirm rollover handles Low priority differently~~ N/A — rollover only checks `rolloverEnabled` now, not priority (2026-07-19). Priority's impact lives in sort order (3.5.3) and, later, Evolving Priority escalation.
- [x] 3.5.5 — Evolving Priority System: Low → Medium → High as procrastination_count climbs (`getEffectivePriority`), archive-other-low-tasks behaviour (`shouldArchiveTask`), global toggle (`evolvingPriorityEnabled` in `useStore`). Per-task override and a real settings UI for the toggle are deferred — see VISION.md.

---

## Milestone 4 — Progression Tasks and Goals
**Target: ~2 weeks**
**Done when:** You can track a book, log pages daily, see a pace bar, and the app tells you if you'll make it.

---

### 4.1 — Progress Logging UI
**Done when:** Tapping a progression task opens a log input and saves a progress entry.

- [x] 4.1.1 — Tapping a progression TaskCard opens a detail screen or bottom sheet
- [x] 4.1.2 — Detail shows: title, target (e.g. "300 pages"), current total, deadline, and log history
- [x] 4.1.3 — A numeric input lets user enter today's amount ("I read 22 pages")
- [x] 4.1.4 — Submitting writes a row to `progress_logs` table
- [x] 4.1.5 — Write `getCurrentProgress(taskId)` in `/db/queries.ts` — `SUM(amount)` over `progress_logs` for that task. Single source of truth for "how much progress exists" — used by the progress bar, pace calculator, and task detail. `tasks.currentProgress` stops being written to going forward (decided 2026-07-21 — same compute-don't-store pattern as skip/archive/effective priority; avoids the column ever going stale if a log entry is later edited or deleted)
- [x] 4.1.6 — Log history shows past entries: date, amount, optional note

---

### 4.2 — Progress Bar on TaskCard
**Done when:** Progression tasks show a visual progress bar reflecting actual completion percentage.

- [x] 4.2.1 — `ProgressBar.tsx` takes `current` and `target` as props, renders a filled bar
- [x] 4.2.2 — TaskCard renders ProgressBar at the bottom for progression tasks
- [x] 4.2.3 — Show percentage or "X / Y unit" label next to bar
- [x] 4.2.4 — Bar turns green when at 100%

---

### 4.3 — Pace Calculator
**Done when:** `calculatePace(task, logs)` returns a status object you can display.

- [x] 4.3.1 — Write `calculatePace(task, logs)` in `/engine/pace.ts`
- [x] 4.3.2 — Compute `target_rate`: `(target - current) / days_remaining`
- [x] 4.3.3 — Compute `actual_rate`: average daily value from last 7 days of logs
- [x] 4.3.4 — Compute `status`: On Track / Slightly Behind / Behind / Critical / Ahead (define thresholds)
- [x] 4.3.5 — Return `{ target_rate, actual_rate, status, days_remaining, days_of_buffer }`
- [x] 4.3.6 — Write 5 test cases with different scenarios (behind, way ahead, deadline tomorrow, etc.)

---

### 4.4 — Pace Display on TaskCard
**Done when:** Progression tasks show human-readable pace status.

- [x] 4.4.1 — Call `calculatePace` when loading tasks for Today and Goals views
- [x] 4.4.2 — Display on task detail screen: "Need 8 pages/day · Averaging 5 · Behind"
- [x] 4.4.3 — Small status indicator on TaskCard itself (color dot or short label)
- [x] 4.4.4 — Critical status triggers a daily notification nudge

---

### 4.5 — Above-Average Progress Modes
*See VISION.md for full spec of Modes A, B, C.*

- [x] 4.5.1 — Add `surplus_mode` field to tasks table: 'breathing_room' | 'raise_bar' | 'bank_it' | 'none'
- [x] 4.5.2 — Add surplus mode selector to New Task form (only shown for Progression type)
- [x] 4.5.3 — Implement Mode A (Breathing Room): after logging, recompute target_rate with surplus applied, capped at 50% reduction
- [x] 4.5.4 — Implement Mode C (Bank It): calculate buffer_days and store on task, show "2 days banked"
- [x] 4.5.5 — Implement Mode B (Raise the Bar): detect 3 consecutive days at 200%+ pace, surface a suggestion card ("You're consistently doing more — want to raise your goal?"), require explicit confirmation before changing target
- [x] 4.5.6 — Surplus threshold: triggered when logged value > 130% of that day's target_rate

---

### 4.6 — Hybrid Tasks
**Done when:** A hybrid task's subtasks are real, individually completable Task rows, and completing all of them auto-completes the parent.

**Decided 2026-07-21:** subtasks are `parent_id`-linked rows in the `tasks`
table itself, not a separate table. A subtask is just a Task — reuses
`toggleTask`, edit, and delete as-is, and gets mixed-type subtasks for free
(a subtask can be type `'Progression'` just like any other task, no extra
schema needed). What currently exists (`new-task.tsx`'s subtask drafts,
`subtasksTotal`/`subtasksCompleted` counts) is UI-only — drafted subtask
titles are thrown away on submit, nothing gets written with `parent_id` set.
This section replaces that with the real thing.

- [x] 4.6.1 — Write `insertSubtask(parentId, data)` in `/db/queries.ts` — wraps `insertTask` with `parentId` set
- [x] 4.6.2 — Write `getSubtasksByParent(parentId)` in `/db/queries.ts`
- [x] 4.6.3 — **Update `getTaskByDate` to exclude rows with a non-null `parent_id`** — subtasks must not appear as independent top-level tasks on Today
- [x] 4.6.4 — On the task detail screen for hybrid tasks, show a real sub-task checklist (pulled via `getSubtasksByParent`, not the old draft-only UI)
- [x] 4.6.5 — Rewire `new-task.tsx`'s Hybrid subtask drafts: on submit, actually call `insertSubtask` for each drafted item instead of just recording a count
- [x] 4.6.6 — Sub-task count badge on parent TaskCard: "3/5" — computed live from `getSubtasksByParent`, not from the `subtasksTotal`/`subtasksCompleted` columns (same compute-don't-store reasoning as 4.1.5)
- [x] 4.6.7 — When all sub-tasks are marked done, auto-mark parent as done
- [x] 4.6.8 — Extend recurrence (3.4.6): when a Hybrid parent recurs, also clone its subtasks under the new parent's id, fresh `isCompleted: false`

---

## Milestone 5 — Habits, Events, Tags
*Added: 2026-07-18*
**Target: ~1-2 weeks**
**Done when:** Habits track streaks, Events show on relevant views, Tags can be
created and applied to tasks.

### 5.1 — Habits
- [x] 5.1.1 — Write `habits` and `habit_logs` schema in `/db/schema.ts` (if not already sketched in 2.1.7)
- [x] 5.1.2 — `insertHabit`, `logHabitCompletion`, `getHabitsByDate` in `/db/queries.ts`
- [x] 5.1.3 — Habit card UI: distinct from TaskCard, shows current streak
- [x] 5.1.4 — Streak calculation: consecutive days/weeks logged, resets on a missed one
- [x] 5.1.5 — Habits appear on Today screen alongside tasks, visually distinct

### 5.2 — Events
- [x] 5.2.1 — Write `events` schema (title, start_time, end_time, location?) — already sketched in 2.1.7
- [x] 5.2.2 — `insertEvent`, `getEventsByDate`, `updateEvent`, `deleteEvent` in `/db/queries.ts`
- [x] 5.2.2b — Event creation/edit form (own bottom sheet, following the Habit pattern: own FAB, own store)
- [x] 5.2.3 — Event card UI: time-based, no checkbox/completion state
- [x] 5.2.3b — Long-press edit/delete on Event card
- [x] 5.2.4 — Events appear on Today, Week, and Month views

### 5.3 — Tags
- [x] 5.3.1 — Write `tags` and `task_tags` schema (many-to-many) — already sketched in 2.1.7, composite PK on task_tags fixed 2026-08-28
- [x] 5.3.2 — `createTag`, `assignTag`, `removeTag`, `renameTag`, `deleteTag`, `getTasksByTag` in `/db/queries.ts`
 - [x] 5.3.3 — Tag picker/creator in New Task form — multi-select, create-new-on-the-fly
 - [x] 5.3.4 — Small tag chips rendered on TaskCard
 - [x] 5.3.5 — Filter Today/Week/Month views by tag

### 5.4 — Activities

Added: 2026-07-18

- [x] 5.4.1 — Write activities and activity_logs schema in /db/schema.ts — done 2026-08-28
 - [x] 5.4.2 — insertActivity, logActivity, getLastActivityLog(activityId) in /db/queries.ts
 - [x] 5.4.3 — Activity card UI: name + "last done: [date]" + optional note, no checkbox, no streak
 - [x] 5.4.4 — Activity history view: full log list for one activity, most recent first
 - [x] 5.4.5 — Quick-log entry point (log now, optionally with a note) from Activity card

---

## Milestone 6 — Views and History
**Target: ~1-2 weeks**

### 6.1 — Weekly View
- [x] 6.1.1 — Week screen shows 7 columns or 7 grouped sections for current week
- [x] 6.1.2 — Each day shows tasks (and events) with status (done/todo/skipped/moved)
- [x] 6.1.3 — Navigate to previous/next weeks
- [x] 6.1.4 — Tapping a task opens its detail

### 6.2 — Monthly View
- [x] 6.2.1 — Calendar grid showing each day of month
- [x] 6.2.2 — Each day has a dot or count indicator (e.g. green = all done, red = incomplete)
- [x] 6.2.3 — Tapping a day shows that day's task summary

### 6.3 — Notes (multi-cadence)
- [x] 6.3.1 — Write `notes` schema with a `scope` field: daily | weekly | monthly | yearly (if not already sketched in 2.1.7)
- [x] 6.3.2 — Daily note: auto-seed with day's summary ("Completed 4 tasks · Logged 22 pages · 1 task moved")
- [x] 6.3.3 — Weekly/monthly/yearly notes: auto-seed with period rollups (completion rate, streaks, procrastination trends)
- [x] 6.3.4 — User can add their own reflection text below the auto-seeded summary
- [x] 6.3.5 — Browse past notes, filterable by scope

### 6.4 — History / Archive
- [x] 6.4.1 — Browse any past date's tasks
- [x] 6.4.2 — Filter by: completed / skipped / moved
- [x] 6.4.3 — See procrastination history for a specific task (how many times it moved, when it was done)

---

## Milestone 7 — Polish
**Target: ~1 week**

- [ ] 7.1 — Morning digest notification
- [ ] 7.2 — Swipe right to complete, swipe left to skip/postpone on TaskCard
- [~] 7.3 — Dark / light mode toggle — palette split (`lightPalette`/`darkPalette`), persisted `themeStore`, full-tree remount via `key` on root layout. Deliberately the "pragmatic" version, not the "correct" one — every component still reads `colors.X` as a mutated static object rather than through a `useTheme()` hook, so a full remount is required per toggle and any local component state not in a store resets on switch. Flagged for a real hook-based rewrite later; not urgent enough to block on now.
- [x] 7.4 — Global settings screen (`account.tsx`) — evolving priority toggle, auto-archive toggle, day-boundary-hour picker (see 9.1), dark mode toggle. Notification times and default surplus mode still outstanding.
- [ ] 7.5 — JSON export of all data
- [ ] 7.6 — Onboarding flow for first-time launch

---

## Milestone 8 — Cloud Sync
**Target: ~2 weeks**

- [ ] 8.1 — Set up Supabase project and mirror schema in Postgres
- [ ] 8.2 — Email / Google auth
- [ ] 8.3 — Upload local data to Supabase on first login
- [ ] 8.4 — Bidirectional sync: push local changes, pull remote changes
- [ ] 8.5 — Conflict resolution strategy: last-write-wins with timestamp comparison
- [ ] 8.6 — Test: uninstall app, reinstall, log in, confirm all data restored

---

## Milestone 9 — Goal Decomposition Engine
*Added: this cycle — promotes the long-parked VISION.md "big rock" idea to a real milestone.*
**Done when:** A monthly or yearly goal of any type auto-generates its own next-level-down children with zero manual re-entry, self-heals when occurrences are missed, and every scope (week/month/year) shares one engine.

### 9.1 — Foundations
- [x] 9.1.1 — `sourceTaskId`-linked children (already existed for weekly→daily; extended to monthly→weekly and yearly→monthly)
- [x] 9.1.2 — `getEffectiveProgress(taskId)` — recursive live sum over descendant progress, replacing any stored/synced progress field on parent-scope goals
- [x] 9.1.3 — `getChildTasks` / `getAllDescendantTasks` — generic parent→children and full-tree walks, scope-agnostic
- [x] 9.1.4 — `ensureDailyDecompositionForDate(dateStr)` — single idempotent entry point, called from every screen's focus effect (Today, Horizon); processes yearly→monthly→weekly→daily in order each call
- [x] 9.1.5 — In-flight lock + `dedupeDuplicateOccurrences()` safety net — fixes a real race condition where concurrent decomposition calls (mount + focus firing close together) could double-insert the same occurrence
- [x] 9.1.6 — `deleteTaskCascade(id)` — deleting a parent goal recursively deletes its decomposed children; deleting a leaf never touches its parent (parent progress is always recomputed live, never stale)

### 9.2 — Progression decomposition (quantity-based)
- [x] 9.2.1 — `decomposeMonthlyProgressionToWeekly` — adaptive: `ceil((total - doneSoFar) / periodsRemaining)`, recomputed every call, updates existing child instead of duplicating
- [x] 9.2.2 — `decomposeWeeklyProgressionToDaily` — same shape, one level down
- [x] 9.2.3 — `decomposeYearlyProgressionToMonthly` — same shape, one level up
- [x] 9.2.4 — Deleted the earlier competing static/upfront-split decompose function (`decomposeMonthlyToWeeklyAndDaily`) — non-adaptive, didn't recompute on overshoot, contradicted the "compute don't store" pattern used everywhere else

### 9.3 — Count-based recurring Simple goals
- [x] 9.3.1 — `maxGapDays` column on `tasks` — user-set ceiling on spacing between occurrences
- [x] 9.3.2 — `getCompletedOccurrenceCount(parentId)`
- [x] 9.3.3 — `decomposeCountGoalToNextOccurrence` — spacing = `min(maxGapDays, floor(daysLeft / remaining))`, recomputed fresh every call so a missed occurrence self-heals by pulling the next one closer, capped by `maxGapDays`; confirmed decision: a missed/deleted occurrence counts against the target (no forced catch-up, ends the period honestly short, e.g. "7/8")
- [x] 9.3.4 — `previewOccurrenceSchedule` — pure, non-writing projection used for live "on pace you'd see it on: ..." hint text in the creation modals, so the schedule isn't a black box before you even save
- [x] 9.3.5 — Wired into Monthly, Weekly, and Yearly creation/edit modals — "Repeat this goal" toggle, times-this-period input, max-gap slider (dynamically capped so an impossible combination can't be chosen)
- [ ] 9.3.6 — Ghost/projected occurrence dots on Horizon's calendar grids (hollow, visually distinct from real scheduled dots) — projection function exists (9.3.4), calendar-rendering wiring not yet built

### 9.4 — Correctness fixes found via real use
- [x] 9.4.1 — Recurring-task duplicate-on-toggle bug: `nextOccurrenceGenerated` sticky boolean added so done→undone→done can never spawn a second "tomorrow" instance
- [x] 9.4.2 — Recurring deadline never advanced with the schedule (a task due "tomorrow" stayed permanently due on its original date after regenerating) — fixed by computing the deadline offset once and reapplying it to each new occurrence
- [x] 9.4.3 — `getAppToday()` / day-boundary setting (see 10.1) — late-night task completion being blocked by a hard midnight cutoff
- [x] 9.4.4 — Editing a monthly/weekly/yearly count-based recurring goal previously silently dropped the recurring config (UI was gated `!editTask`, and edit-populate never read `occurrenceCount`/`maxGapDays` back out) — fixed across all three modals

---

## Milestone 10 — Settings & Accountability Tuning
*Added: this cycle*

### 10.1 — Day boundary
- [x] 10.1.1 — `dayBoundaryHour` setting (`useStore`, persisted) — "today" is computed as `now - boundaryHour` rather than the raw calendar date, so staying up past midnight doesn't lock you out of completing "today's" tasks
- [x] 10.1.2 — `getAppToday()` utility, swapped in everywhere `getLocalDateString(new Date())` was previously used as "today" (taskStore init, Today/Horizon `todayStr`, rollover cutoff)
- [x] 10.1.3 — Picker UI in Account settings

### 10.2 — Progression task interaction
- [x] 10.2.1 — `ProgressionSlider` rebuilt: drag commits to a draft value, explicit Confirm button required to persist (previously committed on release with no undo)
- [x] 10.2.2 — Tap-to-type exact value instead of only dragging
- [x] 10.2.3 — Slider gradient (red→green) reflecting percent complete, live while dragging
- [x] 10.2.4 — Marking a Progression task done asks for confirmation and sets progress to 100% of target; dragging a completed task's slider back down asks for confirmation and un-completes it
- [x] 10.2.5 — Fixed dead write path: slider/confirm previously called `taskStore.updateProgress`, which wrote to the unused `tasks.currentProgress` column — switched to `setAbsoluteProgress` (diffs against the live `progress_logs` sum and inserts a delta), the only column-of-truth per the Milestone 4 decision
- [x] 10.2.6 — `updateProgress` removed from `taskStore` entirely — one write path only, no dead code left to accidentally call
- [ ] 10.2.7 — **Known regression, not yet fixed:** the slider's write path and `ProgressLogSheet`'s write path have diverged — the sheet still checks `getSurplusChoices`/triggers the surplus-mode prompt, the slider does not. Since the slider is the everyday interaction, surplus-mode detection is effectively dead in practice. Needs unifying into one progress-write function that both paths call.

### 10.3 — Today screen restructure
- [x] 10.3.1 — Sectioned, collapsible layout: Events / Habits / Activities / Tasks / Completed, each independently collapsible, mirroring the old Week-view per-day expand pattern
- [x] 10.3.2 — "Completed" sub-section collapsed by default
- [x] 10.3.3 — Focus-reload fix: Today previously only reloaded on mount + AppState-active, so switching tabs to/from Today without a full app close never picked up changes made elsewhere (e.g. a goal created on Horizon). Added `useFocusEffect` calling the same `refreshDashboard`.
- [ ] 10.3.4 — Quick-nav shortcut below search bar — considered, deferred; nothing to jump to that isn't already one scroll away, revisit only if the new sectioning makes it feel actually necessary in practice

### 10.4 — Notes
- [x] 10.4.1–10.4.5 — see Milestone 6.3, all done; user subsequently reimplemented and improved their own version, superseding the original `NoteSheet`/`notesSeed.ts` sketch — no further roadmap action needed here

---

## Milestone 11 — Horizon (unified Week/Month/Year)
*Added: this cycle — replaces separate `week.tsx`, `month.tsx`, `year.tsx` route files with one zoomable screen.*
**Done when:** One screen covers week/month/year with a single `anchorDate` and a `zoomLevel`, drill-in/drill-out feels natural, and every goal type (Progression, Hybrid, count-based Simple) displays correctly at every zoom level.

- [x] 11.1 — Core architecture: `bounds` derived from `(zoomLevel, anchorDate)` via `startOf*`/`endOf*`, so zooming never resets your place — drill-out preserves context (the month you land on contains the week you were just looking at), not "jump to current period"
- [x] 11.2 — Week grid (day strip), Month grid (calendar w/ overflow days), Year grid (month cards) — one component branching on `zoomLevel` instead of three separate files
- [x] 11.3 — Tap-a-cell day/month summary panel
- [x] 11.4 — `GoalCard` list per period, reused verbatim across all three zoom levels (already scope-agnostic from prior work)
- [x] 11.5 — Consistent icon-based selection header (select-all / edit-single / delete-cascade) shared across all zoom levels — this also fixed a pre-existing Month-view bug where two different selection headers (an old text-based one and a new icon-based one) were both rendering simultaneously
- [x] 11.6 — Tap-to-edit removed from `GoalCard` at every zoom level — long-press → selection mode → pencil icon is now the only path to editing, consistent with Today's interaction model (previously Month/Week let a bare tap open the edit sheet, which also caused a "completing" goal card to vanish mid-period)
- [x] 11.7 — Header redesigned to fix overflow: removed the three-button zoom segment (was pushing content off-screen on longer date ranges like "Sep 7 – Sep 13, 2026"); period label itself is now the zoom-out control (tap to go week→month→year)
- [x] 11.8 — Zoom-in interactions: tap a month in Year view drills to that Month; a week-number column added alongside each row of the Month grid, tapping it drills to that Week (previously no way to reach Week from Month at all)
- [x] 11.9 — "Today" button fixed (previously a dead no-op) — now recenters `anchorDate` and `selectedDayStr` to the current app-day
- [x] 11.10 — Year-view density bug fixed: month cards were grouping by the yearly parent goal's own `scheduledDate` (always Jan 1, since that's where yearly goals are inserted), showing all activity dumped into January regardless of when work actually happened. Fixed via `getAllDescendantTasks` — walks each yearly goal's real daily leaves and buckets by the month they actually landed in.
- [x] 11.11 — Year-view counts are search/tag-aware for free, since the descendant walk (11.10) only runs over the already-filtered goal list — searching "draw" shows only Draw-related monthly counts, not the total of everything
- [x] 11.12 — Habits, Events, and Activities restored into the day-focus panel (Habits only for the current app-day, since a habit's "done today" state doesn't mean anything projected onto a past/future date; Events and Activities render for whichever day is selected, same as the old per-scope screens did)
- [x] 11.13 — Standalone Activity search block (independent of calendar bounds/zoom level) — answers "when did I last do X" directly, since Activity history is inherently not calendar-scoped
- [ ] 11.14 — Old `week.tsx`, `month.tsx`, `year.tsx`, `explore.tsx`, `goal.tsx` route files and their tab-bar entries to be deleted once Horizon is confirmed fully stable (goals.tsx was never built past the Milestone 1 stub; explore.tsx was an unused starter leftover)
- [ ] 11.15 — Beyond-Today "add" sheet (Week/Month/Year/Custom-date-range switcher, mirroring Today's Task/Habit/Event/Activity `AddTypeSwitcher`) — deferred until Horizon is fully settled

---

## Milestone 12 — Pursuits
*Added: this cycle*
**Done when:** A user can track an open-ended pursuit (gym routine, study topic, creative project — domain-agnostic) with a self-declared status (à la MAL watch-status), free-form notes, and loosely link tasks to it without any completion-percentage math being computed or implied.

- [x] 12.1 — `pursuits` table: title, `status` enum (plan_to_do / active / on_hold / dropped / completed), free-form `description`
- [x] 12.2 — `pursuitId` nullable column on `tasks`, `onDelete: 'set null'` — membership, not ownership; deleting a Pursuit never deletes or cascades to its linked tasks (deliberately the opposite of `sourceTaskId`'s cascade-delete semantics)
- [x] 12.3 — CRUD queries: `insertPursuit`, `getAllPursuits`, `updatePursuit`, `deletePursuit`, `getTasksByPursuit`, `setTaskPursuit`
- [x] 12.4 — `PursuitPicker` component — single-select, create-new-inline, same visual language as the existing `TagPicker`
- [ ] 12.5 — Wire `PursuitPicker` into all four task creation/edit modals (`new-task.tsx`, Weekly, Monthly, Yearly) — component built, modal integration still mechanical/pending
- [x] 12.6 — `pursuits.tsx` screen: status-filter chips, card list, create sheet, detail sheet (status switcher, editable notes, linked-task list with tap-through)
- [x] 12.7 — Deliberately no computed completion percentage anywhere in this feature — status is 100% user-declared, matching the MAL framing explicitly requested; a Pursuit can be "Completed" with unfinished linked tasks, or "Plan to Do" with none yet, without the app treating either as an inconsistency
- [ ] 12.8 — Tab bar entry / entry point from Account — screen exists, not yet wired into navigation

---

## Milestone 13 — Deferred / Designed-not-built
> Real design decisions were made on these; recorded here so the "why" survives even though nothing's built yet.

- [ ] 13.1 — **Sequential Hybrid milestones for higher-scope goals.** Hybrid at Week/Month/Year scope currently has no "trickle down" equivalent to Progression's — a 5-milestone yearly Hybrid goal just sits as a flat checklist with no daily presence. Designed direction: mark a Hybrid goal as sequential (ordered) or non-sequential; sequential goals surface only their current unfinished milestone as a real `scope: daily` proxy task (via the same `sourceTaskId`/`ensureDailyDecompositionForDate` engine, a third leaf-kind alongside quantity and count), auto-advancing to the next milestone on completion. Non-sequential goals get no auto-surfacing, stay visible only in the existing expandable checklist. Requires an explicit ordering field on subtasks (currently implicit via `id`/insertion order). Not started.
- [ ] 13.2 — **Flexible task shape** ("plain task can gain a progress bar, subtasks can gain their own progress bars, sheets become 'Add task' + 'Add more options'") — explicitly acknowledged as a future rigidity-removal pass over the whole task model. Nothing built yet; noted so `getCompletionFraction`-style centralization work (13.1, Pursuits rollups if ever added) is written in a way that survives this later without a second rewrite.
- [ ] 13.3 — Correct-but-expensive dark mode (per-component `useTheme()` hook instead of the mutated-static-object + full-remount approach in 7.3) — explicitly deferred, not forgotten.

---

## Completed
> Move items here when done so you can see how far you've come.

- [x] React Native project created
- [x] Independent APK running on Android device
- [x] Local notifications working
- [x] Background task running (1-minute timer notification)

---

- [x] Milestone 1 — Learn the Tools While Building Real UI
- [x] Milestone 2 — Real Data with SQLite
- [x] Milestone 3 — Task Intelligence
- [x] Milestone 4 — Progression Tasks and Goals
- [x] Milestone 5 — Habits, Events, Tags
- [x] Milestone 6 — Views and History
- [x] Milestone 9 — Goal Decomposition Engine
- [x] Milestone 11 — Horizon (unified Week/Month/Year)