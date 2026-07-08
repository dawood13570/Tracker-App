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

## Notification Strategy
- One morning digest, not per-task pings.
- Morning summary: "5 tasks today, 2 carried over, 1 deadline this week."
- One evening optional prompt: "You have 2 unfinished tasks. Mark done, skip, or move?"
- Background midnight job is silent — no notification for the rollover itself.
- Milestone 3+ feature: smart nudge if a high-priority task hasn't been touched by 3 PM.

---

## Views
- **Today** — default home. All tasks for today. Swipe to complete.
- **Week** — tasks grouped by day for current week.
- **Month** — high-level summary view.
- **Goals** — progression tasks only, with pace bars.
- **Journal** — daily freetext note, optionally auto-seeded with the day's summary.
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
