# Decomposition and surplus

Quantity goals use one daily plan from their start date through their end date, inclusively. Weeks run Monday–Sunday and belong to that goal directly. A week spanning December 28–January 3 is one allocation even for an October–February custom range. Only the overall range clips its edges. Monthly rows summarize the dates in each calendar month; they do not divide weeks. Yearly goals therefore reflect month length rather than twelve rounded, independent quotas.

Horizon forecasts are read-only. Today creates its allocation; explicitly scheduling a forecast creates that allocation once. Both use the same planner. Extra work reduces remaining real work, missed work increases the future requirement, and future reservations refresh. A daily target with actual progress stays fixed; its parent weekly budget can still change. Only actual logs count toward the overall quantity. At the goal target, no new bank-only work is generated.

## Bank example

A 50-page goal over ten days initially allocates 5 pages/day. Log 10 on day one and choose Bank:

- Actual goal progress is 10/50.
- The extra 5 pages cover day two's 5-page allocation. Day two shows **Covered by bank**, with **0 actual pages**.
- If you log 3 actual pages on day two, only 2 pages of coverage are still needed there; 3 move forward.
- If you log all 5, the full 5 move forward. Actual goal progress is now 15/50, not 20/50.
- Reading 10 on that covered day both releases the old coverage and earns 5 more pages of surplus.

Bank is stored in quantity units, not rounded whole days. Logging 7 against a target of 5 earns 2 pages (0.4 of a baseline day), covering part of the next allocation. Multiple entries on one date accumulate before surplus is calculated. The earning date cannot cover itself. Credits cover dates in order. Coverage is not an invented progress log or a completed occurrence.

Once Bank is selected, subsequent surplus for that goal uses it automatically. Daily repeating quantity tasks share their bank across the same repeat series; a covered occurrence can schedule its next repeat without recording fake work. A one-off daily task can retain a bank but has no successor to cover until repeats are enabled. Unrelated tasks never share credit.

Corrections recompute credit from the original earning dates. Work subsequently recorded on a past covered date releases its coverage. If a correction removes credit already used on a past date, future coverage waits until that deficit is repaid; historical actual work is preserved. The bank balance includes coverage reserved for current/future dates; reservations are not additional earnings.

## Other choices and limits

- **Keep pace:** retain the original daily baseline where work remains; extra work can finish the goal earlier.
- **Ease future pace:** spread remaining work over remaining days with a floor of half the original baseline, capped by remaining work. Whole-unit allocations round upward where necessary and the last allocation absorbs the remainder.
- **Raise target:** explicitly increase the overall target (at least 20%, rounded up, and at least the actual amount already logged). It is never applied automatically.
- **Occurrence goals:** schedule actual sessions across the whole range, with the same continuous weeks. Quantity is distributed across remaining sessions. Extra pages do not replace a required session, so quantity banking is not offered for occurrence-count goals. There is at most one projected session per date; an impossible session count remains visibly unfinished rather than creating fictitious completions.
- **Sequential milestones:** retain milestone order; the quantity planner does not split a milestone's checklist into fractional work.

Horizon goal cards and daily cards expose **Log or correct progress**. Goal actions for quantity plans open today's allocation when available. Corrections edit the selected task's directly recorded quantity; child entries are edited on the child itself. Displayed actual totals and coverage remain separate.

Migration preserves existing progress, moves legacy split-week children/logs/history onto their canonical week, and converts existing bank balances. Legacy day credits cannot recover precision the old code never stored. Backup format 2 includes the bank ledger and coverage receipts; format 1 imports are upgraded.

Run `npm run check` for SQLite regression tests and type checking. Native interaction, upgrade on an installed device, and background behavior still require device validation.
