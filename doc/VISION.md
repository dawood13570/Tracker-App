# App Vision Document
> This is a living document. Every time you have a new idea, add it here.
> Every time an idea gets rejected or changed, note why. Future-you will thank present-you.

---

## What This App Is

A personal productivity OS that lives on your phone. It combines a to-do list, a goal tracker,
a journal, and a calendar into one system that thinks ahead for you — auto-managing your day
based on what you've committed to, how you're progressing, and what you've been putting off.

The core philosophy: **the app does the logistics, you do the living.**

---

## Who It's For (Right Now)

You. One user. Personal use on Android.
Eventually: public, cross-platform (iOS, desktop), multi-user with accounts.

---

## The Three Task Types

### Simple Task
- Binary: done or not done.
- No measurable progress.
- Examples: "Reply to email", "Buy groceries", "Call the dentist"
- Can still have priority, recurrence, and rollover enabled.

### Progression Task
- Has a numeric target and a unit (pages, km, minutes, sessions, words).
- User logs incremental progress over time.
- App tracks pace and tells you if you're on track, behind, or ahead.
- Has a deadline (daily, weekly, monthly, yearly, or custom date).
- Examples: "Read 300 pages by end of month", "Run 50km this week"

### Hybrid Task
- Has sub-tasks (checklist style).
- Each sub-task is a Simple Task internally.
- Completing all sub-tasks auto-completes the parent.
- Progress on parent is shown as X/Y sub-tasks done.
- Examples: "Finish Chapter 3" (scenes as sub-tasks), "Prepare presentation" (slides as sub-tasks)

---

## Other Entity Types
*Added: 2026-07-18 — these are separate entities, not Task variants.*

Tasks are procrastination-tracked and rollover-aware. Habits and Events don't behave
that way, so they get their own tables instead of being forced into the Task shape.

### Habit
- Cadence-based, not deadline-based: "do X daily" or "do X N times a week."
- Tracked by **streak**, not `procrastination_count` — habits reward consistency,
  they don't punish delay the way tasks do.
- Own `habit_logs` table: one row per completion (date, habit_id).
- Missing a day breaks the streak. It doesn't roll forward like a task does.
- Examples: "Read Quran", "Journal before bed", "No sugar"

### Event
- Point-in-time, not a to-do. Has a start time (and optional end time).
- No completion state, no rollover, no procrastination count — it either happened
  or it's scheduled.
- Examples: "Meeting with Ali at 3pm", "Dentist appointment"

### Note
- One entity, multiple scopes: `daily | weekly | monthly | yearly`.
- Replaces the old "Journal" idea in Views — same freetext + auto-seeded-summary
  pattern, just at different cadences.
- Daily: seeded with the day's task/habit summary. Weekly/monthly/yearly: seeded
  with rollups (completion rate, streaks, procrastination trends).
- This is where the muhasabah framing lives — a reflection prompt at each cadence
  boundary, not just a log.

### Activity
*Added: 2026-07-18, decided: 2026-07-18 (Option A — new entity, not a Habit variant)*
- No fixed schedule, no cadence target, no streak. Just a name and a log of
  dates/notes each time it's touched.
- Purpose: "when did I last do X, and what happened that time" — Python
  practice, drawing, reading an Arabic book, expanding story lore.
- Own `activity_logs` table: one row per touch (date, activity_id, note?).
- Different from Habit specifically because Habit implies a target cadence
  (3x/week) and a streak; Activity has neither — it's pure recall, no
  pressure, no target.

*Status: Not yet built. Schema sketch planned alongside Milestone 5 (Habits, Events, Tags).*

---

## Tags
*Added: 2026-07-18*

- User-defined, freeform (e.g. "Deen", "Creativity", "Study", "Career") — not a
  fixed list. The user creates their own tags as they go.
- Many-to-many: one Task can carry multiple tags, one tag applies to many tasks.
- **Primary use case is Tasks.** Habits and Events could carry tags too via the
  same join-table pattern, but that's not an MVP priority — build it for Tasks
  first, extend later if it's actually needed.
- Needs a `tags` table (id, name, color?) and a `task_tags` join table
  (task_id, tag_id).

*Status: Not yet built. Schema sketch planned in Milestone 2 (2.1.7), full
implementation in Milestone 5.*

---

## Core Behaviours

### Procrastination Counter
- Every task has a `procrastination_count` starting at 0.
- Each time the midnight engine moves an incomplete task to the next day, count goes up by 1.
- Displayed as a badge on the task card (e.g. "+3 days").
- Only resets when the task is marked done.
- Manual reschedule by the user does NOT reset the counter — only completion does.
- Skipped tasks freeze their count in history; they don't keep climbing.

### Rollover System
- Each task has a toggle: "Move to next day if not completed."
- At midnight, the engine checks all of yesterday's incomplete tasks.
- High priority + rollover enabled → moves to today, count +1.
- Normal priority + rollover enabled → moves to today, count +1.
- Low priority OR rollover disabled → marked as skipped, stays in history.
- Rule: history is never rewritten. Completed/skipped entries stay as-is.

### Recurrence
- When a recurring task is marked done, the engine creates a NEW task entry for the next
  occurrence. The completed one stays in history untouched.
- Recurrence types: daily, every N days, specific weekdays, weekly.
- Recurring tasks with rollover: if missed, they carry forward AND still regenerate
  for the next scheduled occurrence (so you don't lose the cycle).

---

## Progression Task Intelligence

### Pace Tracking
The engine computes daily:
- **Target rate**: `remaining_target / remaining_days`
- **Actual rate**: rolling average from recent `progress_logs`
- **Status**: one of → On Track / Slightly Behind / Behind / Critical / Ahead

Displayed on task card in plain language:
> "Need 8 pages/day · You're averaging 5 · 3 days behind pace"

---

### IDEA: Above-Average Progress Modes [v1.1 candidate]
*Added: 2026-07-07*

When a user logs significantly more progress than their required daily rate,
the app currently does nothing special. Proposal: let the user choose a
"surplus behaviour" per task from three options:

**Mode A — Breathing Room (default)**
Surplus progress reduces tomorrow's required amount.
Example: Need 10 pages/day. Log 18 today. Tomorrow the requirement drops to ~2.
Feel: the app rewards hustle with rest.
Risk: user may exploit it to avoid the task entirely the next day.
Mitigation: cap the reduction at 50% of the original daily target.

**Mode B — Raise the Bar**
Surplus progress causes the app to increase the total target proportionally,
assuming the user is clearly capable of more than originally planned.
Example: Need 10 pages/day, log 18 consistently → app suggests raising goal to 400 pages.
Requires explicit user confirmation before changing target — never auto-changes.
Feel: the app grows with you.

**Mode C — Bank It (buffer days)**
Surplus is saved as "banked days." Instead of changing daily requirements,
it shows: "You have 2 days of buffer." If you miss a day, a buffer day is consumed
before the procrastination counter starts.
Feel: like saving up vacation days.

**User control:**
- Set per task at creation or edit time.
- Default is Mode A (Breathing Room) but can be changed in app settings globally.
- A fourth option: "None — just track, don't adjust anything."

**Thresholds (to be tuned):**
- Surplus is triggered when logged value > 130% of daily target for that day.
- Significant surplus (Mode B trigger suggestion) = >200% for 3 consecutive days.

*Status: Not yet built. Add to Milestone 4 spec when ready.*

---

### IDEA: Evolving Priority System [Milestone 3.5 candidate]
*Added: 2026-08-07, expanded: 2026-07-18*

A Low priority task that keeps getting procrastinated on should gradually raise
its own priority — Low → Medium → High — the longer it sits undone. At the
extreme, a low-turned-high task can push other Low priority tasks for that day
into archive/delayed status until it's done.

**Toggleable, not forced:**
- Global setting, off or on by default (TBD).
- Per-task override — same pattern as the surplus modes above.

**Open questions to resolve before building:**
- Threshold: how many days of `procrastination_count` before Low → Medium?
  Medium → High?
- Does "archive other low tasks" apply only that day, or does it keep affecting
  future days until the evolved task is done?
- Do archived tasks' own `procrastination_count` freeze, or keep climbing while
  archived?

*Status: Not yet built. Depends on the Priority System (3.5) and Procrastination
Counter (3.1) both being live first.*

---

## Notification Strategy
- One morning digest, not per-task pings.
- Morning summary: "5 tasks today, 2 carried over, 1 deadline this week."
- One evening optional prompt: "You have 2 unfinished tasks. Mark done, skip, or move?"
- Background midnight job is silent — no notification for the rollover itself.
- Milestone 3+ feature: smart nudge if a high-priority task hasn't been touched by 3 PM.

---

## Views
- **Today** — default home. All tasks, habits, and events for today. Swipe to complete.
- **Week** — tasks (and events) grouped by day for current week.
- **Month** — high-level summary view.
- **Goals** — progression tasks only, with pace bars.
- **Notes** — freetext reflection at daily/weekly/monthly/yearly scope, auto-seeded
  with that period's summary. (Replaces "Journal" — same concept, multiple cadences.)
- **History/Archive** — browse any past date.

---

## Data Principles
- Offline-first. App works 100% without internet.
- Cloud sync is additive, not required.
- History is never deleted by the engine, only by the user explicitly.
- Export to JSON/CSV available from day one (validates schema health).

---

## Platform Targets
| Platform | Priority | Notes |
|---|---|---|
| Android | Now | Development target |
| iOS | Phase 2 | Same codebase via React Native |
| Desktop | Phase 3 | React Native Windows/macOS or web |

---

## Future Ideas Parking Lot
> Dump ideas here. No idea is too rough. Date them so you know when you thought of it.

- **2026-07-07** — App/website usage tracking. Track how long spent in apps.
  correlate with task completion rates. Deferred to post-MVP.

- **2026-07-07** — Weekly review ritual screen. Sunday prompt: "Here's your week.
  What moved? What did you finish? What's still hanging?" 2-minute reflection built in.

- **2026-07-07** — "Renegotiate" a goal without it feeling like failure. Extend
  deadline or lower target with a clear log of the change and the reason.

- **2026-07-07** — Correlation insights: "On days you log 2+ hours of social media,
  you complete 40% fewer tasks." Long-term feature, needs usage tracking first.

- **2026-08-07** - One to-do list is daily, and one is weekly , there could also be monthly and yearly, and there should be an option to connects these 2 or 4 tabs , so like today's to-do is connected to the week's to-do. Weekly to-do's might be progression based and have sub task which you do daily.

- **2026-08-07** - Being able to set some tasks to evolve, from low to high as days pass and you don't do them, it becomes high like 'yoo you havent draw in a bazillion days even though you wanted to. so draw something today". this feature might also cause other 'high' priority tasks to be skipped for the sake of the evolved task.
  *(Promoted to full spec — see "IDEA: Evolving Priority System" under Core Behaviours.)*

- **2026-07-18** — "Last time I did X" / activity history, not just a future to-do list.
  Came from describing an actual workflow: gym exercises tracked in dated notes
  folders (Monday/Wednesday/Friday etc.), looked back on the following week to
  adjust weights. Generalizes past gym: "when did I last work on my Python
  project," "when did I last draw," "when did I last read that Arabic book,"
  "when did I last expand my story's lore." None of these are on a fixed
  schedule and none have a numeric target — they're just things the user wants
  to log whenever touched, and recall the most recent entry (and ideally full
  history) on demand.

  This doesn't fit any current entity cleanly:
  - **Task** — tied to one scheduled day, wrong shape for "no fixed day."
  - **Habit** — closest fit, but implies a cadence target (3x/week). These
    activities have no target, just irregular touch-and-log.
  - **Progression Task** — has the right idea (logged entries over time) but
    is tied to a deadline and a numeric goal, which doesn't apply to "drew
    something" or "read some pages" with no target in mind.

  **Decided 2026-07-18:** Option A — new "Activity" entity, not a stretched
  Habit. See "Activity" under Other Entity Types.

  *(Related to the earlier gym-exercise note under Decisions Log about
  `progress_logs` being tied to a single dated Task — same root gap: history
  needs to be decoupled from "today's schedule.")*

---

### IDEA: Goal Decomposition Engine (Week/Month/Year → Today) [big rock]
*Added: 2026-07-18*

Week/Month/Year screens aren't read-only summaries — they're where a target
gets set, and the app auto-generates Today's task from what's left, so nothing
has to be manually typed out day to day.

Two decomposition strategies depending on task type:

- **Count-based (Simple tasks):** e.g. "Draw, 8 times this month." Month view
  shows a tally: "0/8 this month." Open question: which days get a generated
  "Draw" task — spread evenly, adaptive to what else is scheduled that day,
  or user-adjustable?
- **Quantity-based (Progression tasks):** e.g. "Read 20 pages this week."
  Each day: `(target − done so far) ÷ days remaining` = today's number.
  Recalculates daily — overshoot today, tomorrow's number drops.

Both connect to systems already speced: skipping a generated daily task
increases `procrastination_count` like any Task, which can trigger the
Evolving Priority System (low-priority tasks pushed aside for the neglected one).

**This is the same underlying idea as Activity and Evolving Priority, from a
different angle** — something with no fixed schedule that the app nags about
with escalating urgency, decomposed from a higher-level target into daily
nudges. Worth designing as one coherent system, not three overlapping ones,
before building any of them.

This also means the `goals` table (2.1.4, currently just `id, title,
description`) is a placeholder in the truest sense — it'll need real shape:
target amount or count, cadence, decomposition strategy, and a way to trace
which Task rows a goal generated.

**Open questions:**
- Does a goal-generated Task need a `sourceGoalId` to trace it back, or is it
  indistinguishable from a manually created one?
- Editing today's auto-generated amount — does it recompute tomorrow's target
  immediately, or only at the next daily generation run?
- How do Activity, Evolving Priority, and this engine reconcile into one
  system rather than three?

*Status: Not yet built. Milestone 4+ concept (Progression Task Intelligence).
Reshapes the `goals` table. Revisit before building the real Goals screen.*

---

## Decisions Log
> When you make an architectural or product decision, write it here with the reason.
> This prevents re-arguing the same decisions six months later.

| Date | Decision | Reason |
|---|---|---|
| 2026-07-07 | React Native over Flutter | Already set up and working. Cross-platform covered. |
| 2026-07-07 | Supabase over Firebase | Postgres-based, open, self-hostable later. |
| 2026-07-07 | App usage tracking deferred | Complexity too high for MVP. Personal use first. |
| 2026-07-07 | History is never mutated by engine | Preserves honest log. Rollover creates forward, not edits. |
| 2026-07-07 | Manual reschedule doesn't reset procrastination count | Only completion resets it. Honest accounting. |
| 2026-07-18 | Habits and Events are separate entities, not Task variants | Procrastination/rollover logic doesn't apply to habits (streak-based) or events (point-in-time). Keeping them separate avoids polluting the Task schema and logic. |
| 2026-07-18 | Tags are many-to-many, freeform, Task-first | Matches the real categorization need (Deen/Creativity/Study/Career). Habits/Events can extend to tags later via the same join-table pattern if needed. |
| 2026-07-18 | Notes replace Journal, with a `scope` field instead of separate screens | Daily/weekly/monthly/yearly reflection is one entity type at different cadences, not four different features. |
| 2026-07-18 | Activity is a new entity, not a Habit variant | Habit implies a cadence target and streak; Activity has neither — keeps Habit's semantics clean instead of overloading it with an optional-everything config. |