# App Vision Document
> This is a living document. Every time you have a new idea, add it here.
> Every time an idea gets rejected or changed, note why. Future-you will thank present-you.

---

## What This App Is

A personal productivity OS that lives on your phone. It combines a to-do list, a goal tracker, and a calendar into one system that thinks ahead for you — auto-managing your day based on what you've committed to, how you're progressing, and what you've been putting off.

The core philosophy: **the app does the logistics, you do the living.**

**Scope discipline (added this cycle):** this is a productivity / second-brain / muhasabah tool, not an all-purpose app. Notes and Pursuits both earned their place because they're accountability/logging mechanisms in service of that goal, not because they added surface area. Future feature ideas get evaluated against this bar before being added — "is this within arm's reach of tracking something over time and staying honest about it" — not "is this a neat thing an app could do."

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
- **Extended this cycle:** a Simple task can also carry a count-based recurrence target at Week/Month/Year scope ("do X 8 times this month") — see Goal Decomposition Engine below. This is still a binary-completion task; the count lives on the parent goal, not on the individual occurrence.

### Progression Task
- Has a numeric target and a unit (pages, km, minutes, sessions, words).
- User logs incremental progress over time.
- App tracks pace and tells you if you're on track, behind, or ahead.
- Has a deadline (daily, weekly, monthly, yearly, or custom date).
- Examples: "Read 300 pages by end of month", "Run 50km this week"
- **Critical scoping rule, established this cycle:** Progression's pace/behind/ahead/surplus math makes an honest promise only when the unit itself is uniform effort — a page, a km, a minute. It should NOT be used for goals whose "unit" secretly varies in size or difficulty (see "Progression vs Hybrid: choosing the right tool" below). Misusing Progression for uneven units doesn't just give bad pace numbers — it can create a false sense of "on track" right before a disproportionately hard chunk of work.

### Hybrid Task
- Has sub-tasks (checklist style).
- Each sub-task is a Simple Task internally (real `parent_id`-linked rows, not just a count).
- Completing all sub-tasks auto-completes the parent.
- Progress on parent is shown as X/Y sub-tasks done.
- Examples: "Finish Chapter 3" (scenes as sub-tasks), "Prepare presentation" (slides as sub-tasks)
- **This is the correct tool for uneven-effort multi-part goals** — e.g. "read 5 chapters" where chapters vary wildly in length/difficulty should be 5 titled Hybrid milestones, not a Progression task with `total: 5`. See below.
- **Not yet built, designed only:** sequential vs non-sequential milestone ordering, with sequential Hybrid goals at Week/Month/Year scope surfacing only their current milestone as a real daily task (see Roadmap 13.1).

### Progression vs Hybrid: choosing the right tool
*Added this cycle, after real friction hit while planning a history-study goal.*

The dividing line isn't "does effort vary day to day" (it always does — that's what pace tracking is *for*, noticing you slipped). The dividing line is: **do you know, before starting, that the unit itself carries unequal weight?** If "chapter 9" is knowably 5x the work of "chapter 2," the unit was never honest as a linear measure, no matter how countable it looks.

Worked examples (kept here as reference, not to be re-litigated every time a new goal is planned):
- "Run 10km this week" / "Practice guitar 30 min daily" / "Read 300 pages of one evenly-typeset book this month" → **Progression.** Unit really is close to uniform.
- "Read 5 chapters" (uneven lengths) / "Map Berke Khan's reign" (5 genuinely distinct, unevenly-sized sub-topics) → **Hybrid**, ideally sequential once that's built.
- "Save $2000 this month" → **Progression**, even though daily income/spending is lumpy — because the metric itself (dollars in the account) is what's actually being tracked, and a dollar is worth exactly a dollar regardless of which day it arrived. Don't over-correct into Hybrid just because daily effort is uneven; the question is whether the *unit* is uneven.
- "Finish this 12-chapter textbook" where chapter count is uniform but *cognitive load* isn't (intro fluff vs. hard proofs) → acknowledged as a case **no unit system fully solves**. Not a task-modeling gap to chase with more schema — a real limit of what "progress" as a concept can measure. Hybrid's binary "did the work session happen" is the honest ceiling here; the app doesn't claim to measure comprehension.
- "Ship v2" (backend/UI/testing, wildly unequal share of real work) → the one case where flat Hybrid genuinely undersells reality (checking off "testing" jumps the bar the same as checking off "backend"). This is the only scenario that would justify **weighted subtasks** (each subtask carrying its own progress fraction, parent computed as a weighted sum) — deferred, not built; see the old "Hybrid subtasks with mixed types" parking-lot entry below, which this supersedes as the concrete trigger case.

**A cheap, not-yet-built idea that would make this app noticeably smarter without new engine work:** at task creation, flag likely-uneven units (a small denylist like "chapters"/"milestones"/"sections", or a low target count paired with a plural noun-ish unit) and nudge toward Hybrid instead of silently accepting a Progression goal that's likely to lie to you later. Not built. Cheap when it happens — a string-match heuristic, not a schema change.

---

## Other Entity Types

Tasks are procrastination-tracked and rollover-aware. Habits and Events don't behave that way, so they get their own tables instead of being forced into the Task shape.

### Habit
- Cadence-based, not deadline-based: "do X daily" or "do X N times a week."
- Tracked by **streak**, not `procrastination_count` — habits reward consistency, they don't punish delay the way tasks do.
- Own `habit_logs` table: one row per completion (date, habit_id).
- Missing a day breaks the streak. It doesn't roll forward like a task does.
- Examples: "Read Quran", "Journal before bed", "No sugar"
- **Display rule, established this cycle:** a habit's "done today" state is only meaningful projected onto the *current* app-day. Views that let you browse other dates (Horizon's day-focus panel) intentionally do not show Habits for past/future days — showing one there would misrepresent what a habit even is.

### Event
- Point-in-time, not a to-do. Has a start time (and optional end time).
- No completion state, no rollover, no procrastination count — it either happened or it's scheduled.
- Examples: "Meeting with Ali at 3pm", "Dentist appointment"

### Note
- One entity, multiple scopes: `daily | weekly | monthly | yearly`.
- Auto-seeded-summary + free-text reflection pattern; this is where the muhasabah framing lives.
- **Built, then rebuilt by hand:** the original sketch (`NoteSheet`/`generateDailySeed`/`generatePeriodSeed`) shipped and works; the user subsequently reimplemented their own improved version. Current Note implementation is user-authored and considered the source of truth going forward — don't re-derive from the original sketch described in earlier roadmap entries.

### Activity
- No fixed schedule, no cadence target, no streak. Just a name and a log of dates/notes each time it's touched.
- Purpose: "when did I last do X, and what happened that time."
- Own `activity_logs` table: one row per touch (date, activity_id, note?).
- **Two legitimate display modes, both now built:** (1) calendar-scoped — shown on whatever day it was actually logged, inside Horizon's day-focus panel, same as the original Week view always did; (2) retrospective search — a standalone, calendar-independent search box ("when did I last use shampoo") that queries across all history regardless of what week/month/year is currently in view. These aren't in tension — an Activity genuinely has both a "this happened on date X" fact and an "I want to find it later, whenever" use case, and both are honest.

### Pursuit
*Added this cycle. Domain-agnostic — gym routines, study topics, creative projects, anything with a self-declared status, not history-study-specific.*
- Modeled deliberately like a MyAnimeList entry, not a project-management rollup: a title, a **user-declared status** (Plan to Do / Active / On Hold / Dropped / Completed), and free-form notes the user writes themselves.
- **No computed completion percentage, on purpose.** Status is never derived from linked tasks — a Pursuit can be "Completed" with unfinished linked tasks (you just decided you're done, same as marking an anime "Dropped" at episode 8/24), or "Plan to Do" with zero tasks yet, existing purely as a logged intention.
- Tasks link to a Pursuit via a nullable `pursuitId` (membership, not ownership) — deleting a Pursuit never deletes or affects its linked tasks; it only clears the link. This is the opposite cascade direction from `sourceTaskId` (decomposition) or `parentId` (Hybrid subtasks), both of which do cascade-delete, because those relationships really are ownership.
- Naming note: initially discussed as "Project," renamed to avoid colliding with what "Goal" already means in this app (Progression) and to read naturally across non-study domains.

---

## Tags
- User-defined, freeform (e.g. "Deen", "Creativity", "Study", "Career") — not a fixed list.
- Many-to-many: one Task can carry multiple tags, one tag applies to many tasks.
- Primary use case is Tasks; Habits/Events could extend to tags via the same join-table pattern if ever needed, not currently a priority.

---

## Core Behaviours

### Procrastination Counter
- Every task has a `procrastination_count` starting at 0.
- Each time the midnight engine moves an incomplete task to the next day, count goes up by 1.
- Displayed as a badge on the task card.
- Only resets when the task is marked done. Manual reschedule does NOT reset it.

### Rollover System
- Each task has a toggle: "Move to next day if not completed."
- Eligibility depends only on `rolloverEnabled`, never priority (see Decisions Log).
- **Day boundary, added this cycle:** rollover's notion of "today" respects the user-configurable `dayBoundaryHour` (default 3am) rather than the raw calendar midnight — a task worked on at 1am isn't prematurely treated as "yesterday's" and locked from completion. See Account settings.

### Recurrence
- When a recurring task is marked done, the engine creates a NEW task entry for the next occurrence. The completed one stays in history untouched.
- Recurrence types: daily, every N days, specific weekdays, weekly.
- **Fixed this cycle — two real bugs:**
  1. A `nextOccurrenceGenerated` sticky flag now prevents done→undone→done from spawning duplicate "next day" instances (previously, re-toggling the same completed task fired the side effect every time).
  2. A recurring task's deadline now shifts by the same offset as its schedule on each regeneration, instead of staying frozen at its original absolute date (which previously made a "due tomorrow" recurring task permanently due on one fixed calendar date, eventually making generation impossible once that date passed).

---

## Progression Task Intelligence

### Pace Tracking
Computes daily: **target rate** (`remaining / days_remaining`), **actual rate** (rolling average), **status** (On Track / Slightly Behind / Behind / Critical / Ahead).

### Above-Average Progress Modes (Surplus)
Three modes: Breathing Room (lower tomorrow's target, capped at 50% reduction), Bank It (buffer days), Raise the Bar (explicit-confirm target increase). Thresholds: 130% triggers detection, 200%×3-consecutive-days triggers the Raise-the-Bar suggestion.

- **Known regression, not yet fixed (tracked in Roadmap 10.2.7):** surplus detection lives in `ProgressLogSheet` (`getSurplusChoices`), but the everyday interaction — the `ProgressionSlider`'s Confirm button — now writes progress via a separate path (`setAbsoluteProgress`) that never calls surplus detection. In practice, surplus mode is currently dormant for normal day-to-day slider use. Needs the two write paths unified into one function before this can be considered working again.
- **Design direction, agreed but not yet built:** move surplus mode from an upfront per-task setup toggle to a live, contextual, dismissible nudge that only appears once a real threshold actually fires ("You've beaten pace 3 days running — bank the extra, or raise the goal to 380?"), rather than asking the user to predict at creation time whether they'll want this weeks later. `surplusMode`/`bufferDays` schema stays as-is; only the UI trigger point moves.

### Evolving Priority System
Low → Medium → High as `procrastination_count` climbs (threshold: 4 days per step), computed live via `getEffectivePriority`, never stored. Global toggle `evolvingPriorityEnabled`, now **persisted** (Account settings) rather than resetting to default on every launch — this was the explicitly deferred item from the original decision, closed out this cycle alongside the settings screen build.

---

## Goal Decomposition Engine
*Promoted from "parking lot idea" to fully specified and largely built this cycle — see Roadmap Milestone 9 for the implementation checklist.*

The original open questions from when this was just an idea are now answered:

- **"Does a goal-generated Task need a `sourceGoalId` to trace it back?"** → Yes, reusing the existing `sourceTaskId` field (no new column needed — a goal is just a task at a higher scope, so the same parent-tracing field that was already built for Hybrid/recurrence works unchanged).
- **"Editing today's auto-generated amount — recompute immediately or only next generation run?"** → Neither is forced: edits just take effect as stated, and the *next* decomposition call recomputes fresh from whatever the current state is (completed-so-far, days remaining) — there's no separate "recompute now" step because nothing is ever precomputed further than one occurrence ahead in the first place.
- **"How do Activity, Evolving Priority, and this engine reconcile into one system?"** → They don't need to merge into literally one function, but they do share one underlying philosophy that's now explicit across the whole codebase: **compute live from ground truth, never store a derived value that can go stale.** `getEffectiveProgress`, `getEffectivePriority`, `shouldArchiveTask`, and the decomposition engine's remaining-target math are all the same pattern applied to different data.
- **Count-based decomposition's open question ("which days get a generated task — spread evenly, adaptive, or user-adjustable?")** → Adaptive, self-healing, user sets only the ceiling (`maxGapDays`). A missed occurrence pulls the next one closer automatically; the user never manually redistributes anything. Confirmed design choice: a missed occurrence **counts against the target** — the engine never force-catches-up by cramming multiple occurrences together near a deadline, since that risks feeling naggy/unhealthy. If you fall behind, the period ends honestly short (e.g. "7/8 this month").

**Still open (Roadmap 9.3.6):** showing a *projected* future schedule directly on the calendar grids (hollow "ghost" dots, visually distinct from real ones) so long-running goals are visible ahead of time for planning purposes, not just reactively generated one occurrence at a time. The pure projection function (`previewOccurrenceSchedule`) already exists and is used in the creation-modal hint text — only the calendar-rendering wiring is outstanding.

---

## Notification Strategy
Unchanged from original: one morning digest, one optional evening prompt, silent midnight rollover, critical-pace nudges. Not yet built (Roadmap 7.1).

---

## Views
- **Today** — default home. All tasks, habits, events, activities for the current app-day (respecting `dayBoundaryHour`). Now sectioned and collapsible (Events/Habits/Activities/Tasks/Completed) rather than one flat mixed list.
- **Horizon** *(renamed/unified this cycle, replaces separate Week/Month/Year screens)* — one zoomable screen, `anchorDate` + `zoomLevel`, tap the period label to zoom out, tap a month/week-number to zoom in. Shows period goals (Progression/Hybrid/count-based Simple, all via the same `GoalCard`), a tap-a-cell day/month summary, and — restored this cycle — Habits/Events/Activities in the day-focus panel, plus a standalone cross-time Activity search block.
- **Pursuits** *(new this cycle)* — status-filterable list of self-declared, domain-agnostic pursuits (MAL-style), each with free-form notes and loosely linked tasks. No computed rollups.
- **Account** *(new this cycle)* — settings (evolving priority, auto-archive, day-boundary hour, dark mode) plus data actions (export, planned).
- Old separate **Week**, **Month**, **Year**, **Goals** (never built past stub), and **Explore** (unused starter leftover) screens/tabs are being retired in favor of the above (Roadmap 11.14).

Tab bar, as currently planned: **Today · Horizon · Pursuits · Account** (four, possibly a fifth if a genuine need surfaces — deliberately resisting the urge to add tabs for their own sake, per the scope-discipline note at the top of this document).

---

## Data Principles
- Offline-first. App works 100% without internet.
- Cloud sync is additive, not required.
- History is never deleted by the engine, only by the user explicitly.
- **Cascade direction is meaningful, not incidental (clarified this cycle):** `sourceTaskId` (decomposition) and `parentId` (Hybrid subtasks) represent true ownership and cascade-delete. `pursuitId` (Pursuits) represents membership and explicitly does NOT cascade — deleting a Pursuit only clears the link. Any future relationship should be designed by asking which of these two shapes it actually is, not defaulted to one or the other.
- Export to JSON/CSV available from day one goal — not yet built (Roadmap 7.5).

---

## Platform Targets
Unchanged: Android now, iOS phase 2, Desktop phase 3.

---

## Future Ideas Parking Lot

- **Sequential vs. non-sequential Hybrid milestones at higher scopes** — see Roadmap 13.1. Supersedes the older "Hybrid subtasks with mixed types" entry below for the *ordering* half of that idea; the *weighted-progress* half is kept separate (see "Ship v2" example above).
- **Hybrid subtasks with mixed types / weighted progress** (originally 2026-07-20, refined this cycle) — only worth building for the specific case where a flat checklist genuinely misrepresents completion (unequal-weight subtasks like backend/UI/testing on a dev project), not as a general-purpose upgrade. Deferred.
- **Flexible task shape** (a plain task gaining an optional progress bar and/or optional subtasks, subtasks in turn gaining their own optional progress bars, "Add task" + "Add more options" as the eventual creation flow) — acknowledged direction for a future rigidity-removal pass across the whole task model. Not started; see Roadmap 13.2 for the note on writing new code (e.g. completion-fraction helpers) in a way that survives this later.
- **Creation-time non-linear-unit nudge** ("chapters" etc. suggesting Hybrid instead of Progression) — see "Progression vs Hybrid" section above. Cheap, not built.
- **Ghost/projected occurrences on calendar grids** — see Roadmap 9.3.6.
- **Beyond-Today multi-scope add sheet** (Week/Month/Year/Custom-range switcher matching Today's `AddTypeSwitcher`) — see Roadmap 11.15, deferred until Horizon is fully stable.
- **App/website usage tracking**, **weekly review ritual screen**, **"renegotiate" a goal without it feeling like failure**, **correlation insights** — all still parked, unchanged, post-MVP.
- **Correct-but-expensive dark mode** (per-component theme hook) — see Roadmap 13.3.

---

## Decisions Log
> When you make an architectural or product decision, write it here with the reason.

| Date | Decision | Reason |
|---|---|---|
| 2026-07-07 | React Native over Flutter | Already set up and working. |
| 2026-07-07 | Supabase over Firebase | Postgres-based, open, self-hostable later. |
| 2026-07-07 | History is never mutated by engine | Preserves honest log. |
| 2026-07-07 | Manual reschedule doesn't reset procrastination count | Only completion resets it. |
| 2026-07-18 | Habits and Events are separate entities, not Task variants | Procrastination/rollover logic doesn't apply to either. |
| 2026-07-18 | Tags are many-to-many, freeform, Task-first | Matches real categorization need. |
| 2026-07-18 | Notes replace Journal, with a `scope` field | One entity, multiple cadences, not four features. |
| 2026-07-18 | Activity is a new entity, not a Habit variant | Habit implies cadence + streak; Activity has neither. |
| 2026-07-18 | No `status` field for rollover | "Skipped" is computed (past date + incomplete), not stored. |
| 2026-07-19 | Rollover eligibility depends only on `rolloverEnabled`, not priority | Gating by priority would freeze Low priority `procrastinationCount`, breaking Evolving Priority's premise. |
| 2026-07-21 | Hybrid subtasks are `parent_id`-linked Task rows | Reuses existing toggle/edit/delete; mixed-type subtasks for free. |
| 2026-07-21 | `currentProgress` computed live via `SUM(progress_logs)`, never stored | Same "compute don't store" pattern as skip/archive/effective priority; can't go stale. |
| 2026-08-28 | Single unified "+" button on Today with an in-sheet type switcher | FAB-per-entity doesn't scale visually. |
| 2026-08-31 | Goal Decomposition Engine rounds daily targets up (ceiling), never down | Guarantees the sum of daily targets always meets or exceeds the original goal. |
| *this cycle* | Deleted the static/upfront-split monthly→weekly→daily decompose function in favor of the adaptive, recompute-every-call one | Two competing decomposition philosophies existed simultaneously; adaptive is the only one consistent with the "compute don't store" pattern used everywhere else in the app. |
| *this cycle* | Count-based recurring goals: a missed/deleted occurrence counts against the target; no forced catch-up | A system that guarantees exactly N completions no matter what risks cramming occurrences together near a deadline — feels naggy, not smart. Honest short-of-target ("7/8") beats a false guarantee. |
| *this cycle* | Pursuits use a nullable `pursuitId` (membership) with `onDelete: set null`, not a cascade-owning relationship, and have no computed completion percentage | Modeled deliberately after MyAnimeList status tracking — status is a personal declaration, not a derived metric; tasks must survive their Pursuit being deleted. |
| *this cycle* | Renamed "Project" (working name) to "Pursuit" | Avoids colliding with what "Goal" (Progression) already means in this app; reads naturally across non-study domains (gym, hobbies) per explicit confirmation that the entity is domain-agnostic. |
| *this cycle* | Horizon replaces separate Week/Month/Year screens with one zoomable screen sharing a single `anchorDate` | The three screens had already converged on an identical structural shape (nav header + density grid + tap-cell summary + goal list + selection header) purely because the underlying data model is recursive across scopes — consolidating removed duplicated nav/grid logic rather than adding new complexity. |
| *this cycle* | Dark mode implemented as a mutated static object + full-tree remount, not a `useTheme()` hook, for now | Every existing component already imports `colors` as a plain static object; a hook-based rewrite touches every file built so far and is explicitly deferred as its own project rather than done piecemeal now. |
| *this cycle* | "Today" is computed via a configurable `dayBoundaryHour`, not raw calendar midnight | Real usage surfaced that staying up past midnight incorrectly locked "today's" tasks as unfinishable-past-tense; the fix generalizes past this app's own testing to anyone with a late-night schedule. |