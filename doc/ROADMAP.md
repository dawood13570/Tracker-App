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

- [ ] 2.1.1 — Install `expo-sqlite` and `drizzle-orm`
- [ ] 2.1.2 — Write the `tasks` table schema in `/db/schema.ts` using all fields from the spec
- [ ] 2.1.3 — Write the `progress_logs` table schema
- [ ] 2.1.4 — Write the `goals` table schema (even if empty — defines the shape now)
- [ ] 2.1.5 — Set up the DB connection and run initial migration on app start
- [ ] 2.1.6 — Verify tables exist using a DB browser (install `DB Browser for SQLite` on PC)
- [ ] 2.1.7 — Sketch (schema only, no UI/logic yet) `habits`, `habit_logs`, `events`, `notes`, `tags`, and `task_tags` table shapes in `/db/schema.ts` — cheap to define now, expensive to retrofit later

---

### 2.2 — Create Tasks
**Done when:** Submitting the New Task form saves a real row to SQLite.

- [ ] 2.2.1 — Write an `insertTask` function in `/db/queries.ts`
- [ ] 2.2.2 — Wire the form's Submit button to call `insertTask` instead of `console.log`
- [ ] 2.2.3 — Generate a UUID for each new task (`crypto.randomUUID()` or `uuid` package)
- [ ] 2.2.4 — Set `scheduled_date` to today, `status` to 'todo', `procrastination_count` to 0 on creation
- [ ] 2.2.5 — After save, navigate back to Today screen
- [ ] 2.2.6 — Confirm row appears in DB Browser

---

### 2.3 — Read Tasks
**Done when:** Today screen loads real tasks from DB on mount.

- [ ] 2.3.1 — Write a `getTasksByDate(date)` function in `/db/queries.ts`
- [ ] 2.3.2 — Replace hardcoded task array in `today.tsx` with a `useEffect` that calls `getTasksByDate`
- [ ] 2.3.3 — Handle loading state: show a spinner while tasks load
- [ ] 2.3.4 — Handle empty state: show a friendly message if no tasks today

---

### 2.4 — Update Task Status
**Done when:** Marking done/undone writes to DB and persists after app restart.

- [ ] 2.4.1 — Write an `updateTaskStatus(id, status)` function in `/db/queries.ts`
- [ ] 2.4.2 — Replace the local `useState` toggle with a call to `updateTaskStatus`
- [ ] 2.4.3 — Re-fetch tasks after update so UI reflects DB truth
- [ ] 2.4.4 — Confirm status persists after closing and reopening app

---

### 2.5 — Edit and Delete Tasks
**Done when:** Long-press opens edit options. Edit pre-fills form. Delete removes from list.

- [ ] 2.5.1 — Write `updateTask(id, fields)` and `deleteTask(id)` in `/db/queries.ts`
- [ ] 2.5.2 — Add long-press handler on TaskCard that opens an action sheet (Edit / Delete / Cancel)
- [ ] 2.5.3 — Edit navigates to the New Task form pre-filled with existing task data
- [ ] 2.5.4 — Delete removes the task and updates the list immediately
- [ ] 2.5.5 — Add a confirmation dialog before delete ("Are you sure?")

---

### 2.6 — Zustand State Management
**Done when:** Task state lives in the store, not in individual screen components.

- [ ] 2.6.1 — Install `zustand`
- [ ] 2.6.2 — Create `taskStore.ts` with state: `tasks`, `isLoading`, `selectedDate`
- [ ] 2.6.3 — Create actions: `loadTasks`, `addTask`, `updateTask`, `removeTask`
- [ ] 2.6.4 — Replace all direct DB calls in screens with store actions
- [ ] 2.6.5 — Confirm Today screen and any other screen that uses tasks stays in sync automatically

---

## Milestone 3 — Task Intelligence
**Target: ~2 weeks**
**Done when:** Midnight rollover works, recurring tasks self-regenerate, procrastination counter is live.

---

### 3.1 — Procrastination Counter Display
**Done when:** Tasks that have been moved show correct count visually.

- [ ] 3.1.1 — Manually update a test task's `procrastination_count` to 3 via DB Browser
- [ ] 3.1.2 — Confirm `ProcrastinationBadge` renders "+3 days" on that task
- [ ] 3.1.3 — Badge is invisible when count is 0
- [ ] 3.1.4 — Choose a visual design: subtle for +1, more prominent for +3, alarming for +7+

---

### 3.2 — Rollover Logic (Pure Function First)
**Done when:** The rollover function produces correct output given test inputs, no DB or background job yet.

- [ ] 3.2.1 — Write `processRollover(tasks, today)` in `/engine/rollover.ts`
- [ ] 3.2.2 — It takes an array of yesterday's tasks and returns an array of mutations (what to update, what to skip)
- [ ] 3.2.3 — Rule: todo + rollover enabled + high/normal priority → schedule for today, count +1
- [ ] 3.2.4 — Rule: todo + rollover disabled OR low priority → set status to 'skipped'
- [ ] 3.2.5 — Rule: already done/skipped → do nothing
- [ ] 3.2.6 — Write 5 manual test cases (plain JS objects as input, assert on output). No test framework needed yet, just `console.log` and check.

---

### 3.3 — Rollover as Background Job
**Done when:** App runs the rollover at midnight without being open.

- [ ] 3.3.1 — Install `expo-task-manager` and `expo-background-fetch`
- [ ] 3.3.2 — Register a background task named `MIDNIGHT_ROLLOVER`
- [ ] 3.3.3 — Inside the task: fetch yesterday's tasks from DB, run `processRollover`, apply mutations
- [ ] 3.3.4 — Schedule the task to run once daily (as close to midnight as Android allows)
- [ ] 3.3.5 — Test by temporarily setting the trigger to 1 minute and confirming tasks move
- [ ] 3.3.6 — Send a local notification after rollover: "Good morning. X tasks carried over."
- [ ] 3.3.7 — Restore trigger to daily / midnight after testing

---

### 3.4 — Recurrence Engine
**Done when:** Completing a recurring task automatically creates the next occurrence.

- [ ] 3.4.1 — Install `date-fns` for date arithmetic
- [ ] 3.4.2 — Write `getNextOccurrence(task, fromDate)` in `/engine/recurrence.ts`
- [ ] 3.4.3 — Handle daily: next day
- [ ] 3.4.4 — Handle every_n_days: fromDate + N
- [ ] 3.4.5 — Handle weekly with specific days: find next matching weekday
- [ ] 3.4.6 — Hook into `updateTaskStatus`: when a recurring task is marked done, call `getNextOccurrence` and insert a new task row (clone of the current with new date, status 'todo', count 0)
- [ ] 3.4.7 — Confirm the original completed task is untouched in DB

---

### 3.5 — Priority System
**Done when:** Priority is assignable, visually meaningful, and affects rollover behaviour.

- [ ] 3.5.1 — Confirm priority field is in schema and form (should be from Milestone 2)
- [ ] 3.5.2 — High priority tasks: stronger visual treatment on TaskCard (confirm it's clearly distinct)
- [ ] 3.5.3 — Today screen sorts: High priority first, then Normal, then Low, then Done at bottom
- [ ] 3.5.4 — Confirm rollover logic correctly handles low priority differently (3.2.4)
- [ ] 3.5.5 — *(Not started — open questions in VISION.md)* Evolving Priority System: Low → Medium → High as procrastination_count climbs, toggleable, with the archive-other-low-tasks behaviour

---

## Milestone 4 — Progression Tasks and Goals
**Target: ~2 weeks**
**Done when:** You can track a book, log pages daily, see a pace bar, and the app tells you if you'll make it.

---

### 4.1 — Progress Logging UI
**Done when:** Tapping a progression task opens a log input and saves a progress entry.

- [ ] 4.1.1 — Tapping a progression TaskCard opens a detail screen or bottom sheet
- [ ] 4.1.2 — Detail shows: title, target (e.g. "300 pages"), current total, deadline, and log history
- [ ] 4.1.3 — A numeric input lets user enter today's amount ("I read 22 pages")
- [ ] 4.1.4 — Submitting writes a row to `progress_logs` table
- [ ] 4.1.5 — `current_value` on the task updates to the sum of all `progress_logs` for that task
- [ ] 4.1.6 — Log history shows past entries: date, amount, optional note

---

### 4.2 — Progress Bar on TaskCard
**Done when:** Progression tasks show a visual progress bar reflecting actual completion percentage.

- [ ] 4.2.1 — `ProgressBar.tsx` takes `current` and `target` as props, renders a filled bar
- [ ] 4.2.2 — TaskCard renders ProgressBar at the bottom for progression tasks
- [ ] 4.2.3 — Show percentage or "X / Y unit" label next to bar
- [ ] 4.2.4 — Bar turns green when at 100%

---

### 4.3 — Pace Calculator
**Done when:** `calculatePace(task, logs)` returns a status object you can display.

- [ ] 4.3.1 — Write `calculatePace(task, logs)` in `/engine/pace.ts`
- [ ] 4.3.2 — Compute `target_rate`: `(target - current) / days_remaining`
- [ ] 4.3.3 — Compute `actual_rate`: average daily value from last 7 days of logs
- [ ] 4.3.4 — Compute `status`: On Track / Slightly Behind / Behind / Critical / Ahead (define thresholds)
- [ ] 4.3.5 — Return `{ target_rate, actual_rate, status, days_remaining, days_of_buffer }`
- [ ] 4.3.6 — Write 5 test cases with different scenarios (behind, way ahead, deadline tomorrow, etc.)

---

### 4.4 — Pace Display on TaskCard
**Done when:** Progression tasks show human-readable pace status.

- [ ] 4.4.1 — Call `calculatePace` when loading tasks for Today and Goals views
- [ ] 4.4.2 — Display on task detail screen: "Need 8 pages/day · Averaging 5 · Behind"
- [ ] 4.4.3 — Small status indicator on TaskCard itself (color dot or short label)
- [ ] 4.4.4 — Critical status triggers a daily notification nudge

---

### 4.5 — Above-Average Progress Modes
*See VISION.md for full spec of Modes A, B, C.*

- [ ] 4.5.1 — Add `surplus_mode` field to tasks table: 'breathing_room' | 'raise_bar' | 'bank_it' | 'none'
- [ ] 4.5.2 — Add surplus mode selector to New Task form (only shown for Progression type)
- [ ] 4.5.3 — Implement Mode A (Breathing Room): after logging, recompute target_rate with surplus applied, capped at 50% reduction
- [ ] 4.5.4 — Implement Mode C (Bank It): calculate buffer_days and store on task, show "2 days banked"
- [ ] 4.5.5 — Implement Mode B (Raise the Bar): detect 3 consecutive days at 200%+ pace, surface a suggestion card ("You're consistently doing more — want to raise your goal?"), require explicit confirmation before changing target
- [ ] 4.5.6 — Surplus threshold: triggered when logged value > 130% of that day's target_rate

---

### 4.6 — Hybrid Tasks
**Done when:** A hybrid task can have sub-tasks, completing all auto-completes the parent.

- [ ] 4.6.1 — `parent_id` field already in schema — confirm it's there
- [ ] 4.6.2 — On the task detail screen for hybrid tasks, show a sub-task checklist
- [ ] 4.6.3 — "Add sub-task" button creates a new Simple task with `parent_id` set
- [ ] 4.6.4 — Sub-task count badge on parent TaskCard: "3/5"
- [ ] 4.6.5 — When all sub-tasks are marked done, auto-mark parent as done

---

## Milestone 5 — Habits, Events, Tags
*Added: 2026-07-18*
**Target: ~1-2 weeks**
**Done when:** Habits track streaks, Events show on relevant views, Tags can be
created and applied to tasks.

### 5.1 — Habits
- [ ] 5.1.1 — Write `habits` and `habit_logs` schema in `/db/schema.ts` (if not already sketched in 2.1.7)
- [ ] 5.1.2 — `insertHabit`, `logHabitCompletion`, `getHabitsByDate` in `/db/queries.ts`
- [ ] 5.1.3 — Habit card UI: distinct from TaskCard, shows current streak
- [ ] 5.1.4 — Streak calculation: consecutive days/weeks logged, resets on a missed one
- [ ] 5.1.5 — Habits appear on Today screen alongside tasks, visually distinct

### 5.2 — Events
- [ ] 5.2.1 — Write `events` schema (title, start_time, end_time, location?)
- [ ] 5.2.2 — `insertEvent`, `getEventsByDate` in `/db/queries.ts`
- [ ] 5.2.3 — Event card UI: time-based, no checkbox/completion state
- [ ] 5.2.4 — Events appear on Today, Week, and Month views

### 5.3 — Tags
- [ ] 5.3.1 — Write `tags` and `task_tags` schema (many-to-many)
- [ ] 5.3.2 — `createTag`, `assignTag`, `removeTag`, `getTasksByTag` in `/db/queries.ts`
- [ ] 5.3.3 — Tag picker/creator in New Task form — multi-select, create-new-on-the-fly
- [ ] 5.3.4 — Small tag chips rendered on TaskCard
- [ ] 5.3.5 — Filter Today/Week/Month views by tag

---

## Milestone 6 — Views and History
**Target: ~1-2 weeks**

### 6.1 — Weekly View
- [ ] 6.1.1 — Week screen shows 7 columns or 7 grouped sections for current week
- [ ] 6.1.2 — Each day shows tasks (and events) with status (done/todo/skipped/moved)
- [ ] 6.1.3 — Navigate to previous/next weeks
- [ ] 6.1.4 — Tapping a task opens its detail

### 6.2 — Monthly View
- [ ] 6.2.1 — Calendar grid showing each day of month
- [ ] 6.2.2 — Each day has a dot or count indicator (e.g. green = all done, red = incomplete)
- [ ] 6.2.3 — Tapping a day shows that day's task summary

### 6.3 — Notes (multi-cadence)
- [ ] 6.3.1 — Write `notes` schema with a `scope` field: daily | weekly | monthly | yearly (if not already sketched in 2.1.7)
- [ ] 6.3.2 — Daily note: auto-seed with day's summary ("Completed 4 tasks · Logged 22 pages · 1 task moved")
- [ ] 6.3.3 — Weekly/monthly/yearly notes: auto-seed with period rollups (completion rate, streaks, procrastination trends)
- [ ] 6.3.4 — User can add their own reflection text below the auto-seeded summary
- [ ] 6.3.5 — Browse past notes, filterable by scope

### 6.4 — History / Archive
- [ ] 6.4.1 — Browse any past date's tasks
- [ ] 6.4.2 — Filter by: completed / skipped / moved
- [ ] 6.4.3 — See procrastination history for a specific task (how many times it moved, when it was done)

---

## Milestone 7 — Polish
**Target: ~1 week**

- [ ] 7.1 — Morning digest notification
- [ ] 7.2 — Swipe right to complete, swipe left to skip/postpone on TaskCard
- [ ] 7.3 — Dark / light mode toggle
- [ ] 7.4 — Global settings screen (default surplus mode, evolving priority toggle, notification times, etc.)
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

## Completed
> Move items here when done so you can see how far you've come.

- [x] React Native project created
- [x] Independent APK running on Android device
- [x] Local notifications working
- [x] Background task running (1-minute timer notification)

---

- [x] Milestone 1 — Learn the Tools While Building Real UI