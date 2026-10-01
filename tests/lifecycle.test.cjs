const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, task } = require('./helpers.cjs');

test('done-undone-done creates one next occurrence and preserves same-name independent tasks', async () => {
  const { q, sqlite, close } = await fixture();
  const a = await q.insertTask(task({ recurrenceType: 'daily' }));
  q.changeTaskCompletion(a.id, true); q.changeTaskCompletion(a.id, false); q.changeTaskCompletion(a.id, true);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM tasks').get().n, 2);
  assert.equal((await q.getTaskById(a.id)).nextOccurrenceGenerated, true); close();
});
test('rollover preserves data and history, does not merge by title, counts elapsed days, is idempotent', async () => {
  const { q, sqlite, close } = await fixture();
  const pursuit = await q.insertPursuit({ title: 'Reading' });
  const a = await q.insertTask(task({ type: 'Progression', totalProgress: 100, recurrenceType: 'daily', pursuitId: pursuit.id, deadline: '2026-10-30' }));
  await q.insertProgressLog({ taskId: a.id, amount: 20 });
  const tag = await q.createTag({ name: 'Books' }); await q.assignTag(a.id, tag[0]?.id ?? tag.id);
  const independent = await q.insertTask(task({ type: 'Progression', totalProgress: 50, scheduledDate: '2026-10-05' }));
  assert.equal(q.rolloverTo('2026-10-05'), 1); assert.equal(q.rolloverTo('2026-10-05'), 0);
  const all = await q.getTaskByDate('2026-10-05'); assert.equal(all.length, 2);
  const moved = all.find(t => t.id !== independent.id);
  assert.equal(moved.procrastinationCount, 7); assert.equal(moved.recurrenceType, 'daily'); assert.equal(moved.pursuitId, pursuit.id);
  assert.equal(await q.getCurrentProgress(moved.id), 20); assert.equal((await q.getTagsForTask(moved.id)).length, 1);
  assert.ok(await q.getTaskById(a.id)); assert.equal(sqlite.prepare('SELECT count(*) n FROM task_history WHERE action = ?').get('moved').n, 1); close();
});
test('completion and progress share status, parent propagation, and undo', async () => {
  const { q, close } = await fixture();
  const p = await q.insertTask(task({ type: 'Hybrid' }));
  const s = await q.insertSubtask(p.id, task({ type: 'Progression', totalProgress: 10 }));
  q.changeProgress(s.id, 3); q.changeTaskCompletion(s.id, true);
  assert.equal(await q.getCurrentProgress(s.id), 10); assert.equal((await q.getTaskById(p.id)).isCompleted, true);
  q.changeTaskCompletion(s.id, false); assert.equal(await q.getCurrentProgress(s.id), 3); assert.equal((await q.getTaskById(p.id)).isCompleted, false); close();
});
test('started daily target stays stable on refresh', async () => {
  const { q, close } = await fixture();
  const p = await q.insertTask(task({ type: 'Progression', scope: 'weekly', totalProgress: 70 }));
  let c = await q.decomposeWeeklyProgressionToDaily(p, '2026-09-28', 7); assert.equal(c.totalProgress, 10);
  q.changeProgress(c.id, 5); c = await q.decomposeWeeklyProgressionToDaily(p, '2026-09-28', 7); assert.equal(c.totalProgress, 10); close();
});
test('deleting a task removes subtasks/logs and a pursuit only unlinks', async () => {
  const { q, sqlite, close } = await fixture();
  const p = await q.insertPursuit({ title: 'Goal' });
  const t = await q.insertTask(task({ pursuitId: p.id })); const sub = await q.insertSubtask(t.id, task());
  await q.deletePursuit(p.id); assert.equal((await q.getTaskById(t.id)).pursuitId, null);
  q.deleteTaskTree(t.id); assert.equal(await q.getTaskById(sub.id), null); assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []); close();
});
test('habit completion is reversible and interval respects available days', async () => {
  const { q, close } = await fixture();
  const [h] = await q.insertHabit({ title: 'Read', cadenceType: 'daily' });
  await q.logHabitCompletion(h.id, '2026-10-01'); await q.logHabitCompletion(h.id, '2026-10-01');
  assert.equal(await q.getHabitStreak(h.id, '2026-10-01'), 0);
  assert.equal(q.calculatePacingInterval({ maxGapDays: 7 }, '2026-10-01', '2026-10-08', 8), 1); close();
});
test('app-day honors persisted night owl setting and explicit finalization', async () => {
  const { q, close } = await fixture();
  q.useStore.getState().setNightOwlMode(true); q.useStore.getState().setDayBoundaryHour(3);
  assert.equal(q.getAppToday(new Date(2026, 9, 1, 1)), '2026-09-30');
  q.useStore.getState().setManualDayOverrideDate('2026-10-01');
  assert.equal(q.getAppToday(new Date(2026, 9, 1, 1)), '2026-10-01'); assert.ok(global.__auditStorage.get('reckon-settings')); close();
});

test('editor saves children and tags atomically, including updates to existing subtask targets', async () => {
  const { q, sqlite, close } = await fixture();
  const parent = q.saveTaskFamily(undefined, task({ type: 'Hybrid' }), [{ title: 'Chapter', type: 'Progression', totalProgress: 5 }], []);
  const [sub] = await q.getSubtasksByParent(parent.id);
  q.saveTaskFamily(parent.id, task({ title: 'New name', type: 'Hybrid' }), [{ id: sub.id, title: 'Updated', totalProgress: 8 }], []);
  assert.equal((await q.getTaskById(sub.id)).totalProgress, 8);
  assert.throws(() => q.saveTaskFamily(parent.id, task({ title: 'Should roll back' }), [], [99999]));
  assert.equal((await q.getTaskById(parent.id)).title, 'New name');
  assert.ok(await q.getTaskById(sub.id));
  assert.throws(() => q.saveTaskFamily(undefined, task({ totalProgress: NaN }), [], []));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM tasks').get().n, 2); close();
});
test('recurring hybrid occurrence copies milestones and completes only its own template', async () => {
  const { q, close } = await fixture();
  const parent = q.saveTaskFamily(undefined, task({ type: 'Hybrid', scope: 'weekly', occurrenceTarget: 3 }), [{ title: 'Step A' }, { title: 'Step B' }], []);
  const child = await q.decomposeHybridGoal(parent, '2026-09-28', '2026-10-04');
  const subs = await q.getSubtasksByParent(child.id); assert.equal(subs.length, 2);
  q.changeTaskCompletion(subs[0].id, true); q.changeTaskCompletion(subs[1].id, true);
  assert.equal((await q.getTaskById(child.id)).isCompleted, true);
  assert.equal((await q.getTaskById(parent.id)).isCompleted, false); close();
});
test('backup round trip retains all records and rejects broken relationships without replacing data', async () => {
  const { q, sqlite, close } = await fixture();
  const p = await q.insertPursuit({ title: 'Preserve' });
  const t = await q.insertTask(task({ pursuitId: p.id })); q.changeTaskCompletion(t.id, true);
  const backup = q.exportBackup(); q.deleteTaskTree(t.id); q.restoreBackup(backup);
  assert.deepEqual(q.exportBackup().tables, backup.tables);
  const invalid = structuredClone(backup); invalid.tables.tasks[0].pursuit_id = 987654;
  assert.throws(() => q.restoreBackup(invalid)); assert.deepEqual(q.exportBackup().tables, backup.tables);
  const mixed = structuredClone(backup);
  mixed.tables.tasks.push({ ...mixed.tables.tasks[0], id: t.id + 1, parent_id: t.id });
  mixed.tables.tasks[0].source_task_id = t.id + 1;
  assert.throws(() => q.validateBackup(mixed), /cycle/);
  const badPrefs = { ...backup, preferences: { 'reckon-settings': JSON.stringify({ state: { dayBoundaryHour: 99 } }) } };
  assert.throws(() => q.restoreBackup(badPrefs), /hour/);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []); close();
});
test('upgrade preserves legacy notes and rollover records and assigns historical progress dates', async () => {
  const { q, sqlite, close } = await fixture(db => {
    db.exec("INSERT INTO notes (id, scope, date_key, title, content, is_auto_generated) VALUES (1, 'weekly', '2026-09-28', 'Reflection', 'My own writing', 1)");
    db.exec("INSERT INTO tasks (id, title, type, priority, scheduled_date) VALUES (1, 'Same title', 'Simple', 'High', '2026-09-28')");
    db.exec("INSERT INTO tasks (id, title, type, priority, scheduled_date, source_task_id) VALUES (2, 'Same title', 'Simple', 'High', '2026-09-29', 1)");
    db.exec("INSERT INTO progress_logs (task_id, amount, logged_at) VALUES (1, 3, '2026-09-28 12:00:00')");
  });
  const notes = await q.getNotesForScope('weekly', '2026-09-28');
  assert.equal(notes[0].content, 'My own writing'); assert.equal(notes[0].isAutoGenerated, false);
  assert.equal((await q.getTaskById(2)).rolloverFromId, 1); assert.equal((await q.getTaskById(2)).sourceTaskId, null);
  assert.equal(sqlite.prepare('SELECT app_date FROM progress_logs').get().app_date, '2026-09-28');
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []); close();
});
test('sequential rules apply to direct changes and generated milestone proxies', async () => {
  const { q, close } = await fixture();
  const root = q.saveTaskFamily(undefined, task({ type: 'Hybrid', scope: 'weekly', isSequential: true }), [{ title: 'First' }, { title: 'Second', type: 'Progression', totalProgress: 5 }], []);
  const [a, b] = await q.getSubtasksByParent(root.id);
  assert.throws(() => q.changeTaskCompletion(b.id, true), /previous milestone/);
  const proxy = await q.insertTask(task({ sourceTaskId: b.id, type: 'Progression', totalProgress: 5 }));
  assert.throws(() => q.changeProgress(proxy.id, 2), /previous milestone/);
  q.changeTaskCompletion(a.id, true); q.changeTaskCompletion(proxy.id, true);
  assert.equal((await q.getTaskById(root.id)).isCompleted, true); close();
});
test('carry snapshots do not double-count generated goal progress', async () => {
  const { q, close } = await fixture();
  const root = await q.insertTask(task({ scope: 'weekly', type: 'Progression', totalProgress: 100, rolloverEnabled: false }));
  const child = await q.insertTask(task({ sourceTaskId: root.id, type: 'Progression', totalProgress: 20 }));
  q.changeProgress(child.id, 5); q.rolloverTo('2026-10-01');
  const [moved] = await q.getTaskByDate('2026-10-01'); q.changeProgress(moved.id, 8);
  assert.equal(await q.getCurrentProgress(moved.id), 8); assert.equal(await q.getEffectiveProgress(root.id), 8); close();
});
test('postpone and skip preserve task history and repeat only once', async () => {
  const { q, sqlite, close } = await fixture();
  const root = q.saveTaskFamily(undefined, task({ type: 'Hybrid', recurrenceType: 'daily' }), [{ title: 'Keep me' }], []);
  q.postponeTask(root.id); const moved = await q.getTaskById(root.id);
  assert.ok(moved.scheduledDate > q.getAppToday());
  assert.equal((await q.getSubtasksByParent(root.id))[0].scheduledDate, moved.scheduledDate);
  q.skipTask(root.id); q.skipTask(root.id); q.rolloverTo('2026-11-01');
  assert.ok((await q.getTaskById(root.id)).skippedAt);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM task_history WHERE action='skipped'").get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM tasks WHERE parent_id IS NULL AND recurrence_type = ?').get('daily').n, 3); // skipped, next, rolled next
  close();
});
test('habit and event saves roll back tags and reject invalid values', async () => {
  const { q, sqlite, close } = await fixture();
  assert.throws(() => q.saveHabitWithTags(undefined, { title: 'Read', cadenceType: 'weekly_n_times', cadenceTarget: 8 }, []));
  assert.throws(() => q.saveHabitWithTags(undefined, { title: 'Read', cadenceType: 'daily' }, [999]));
  assert.throws(() => q.saveEventWithTags(undefined, { title: 'Event', startTime: '2026-10-01T09:00:00', endTime: '2026-10-01T08:00:00' }, []));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM habits').get().n, 0); close();
});

test('manual projection scheduling is idempotent and daily decomposition reuses it', async () => {
  const { q, close } = await fixture();
  const date = q.getAppToday();
  const root = await q.insertTask(task({ scope: 'monthly', type: 'Progression', scheduledDate: date, totalProgress: 100, deadline: '2027-10-31' }));
  const manual = q.materializeProjection(root.id, date, 10);
  assert.equal(q.materializeProjection(root.id, date, 10).id, manual.id);
  await q.ensureDailyDecompositionForDate(date);
  assert.equal((await q.getTaskByDate(date)).filter(t => t.scope === 'daily').length, 1); close();
});
test('goal completion fills only the remaining aggregate amount and undo restores prior work', async () => {
  const { q, close } = await fixture();
  const goal = await q.insertTask(task({ scope: 'weekly', type: 'Progression', totalProgress: 10 }));
  const child = await q.insertTask(task({ sourceTaskId: goal.id, type: 'Progression', totalProgress: 5 }));
  q.changeProgress(child.id, 3); q.changeTaskCompletion(goal.id, true);
  assert.equal(await q.getEffectiveProgress(goal.id), 10);
  assert.equal(await q.getCurrentProgress(goal.id), 7);
  q.changeTaskCompletion(goal.id, false);
  assert.equal(await q.getEffectiveProgress(goal.id), 3);
  q.changeProgress(goal.id, 7); assert.equal((await q.getTaskById(goal.id)).isCompleted, true); close();
});
test('activity creation is all-or-nothing when a tag fails', async () => {
  const { q, sqlite, close } = await fixture();
  await assert.rejects(q.createActivityEntryWithTags({ title: 'Walk', date: '2026-10-01', extraTagIds: [9999] }));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM activities').get().n, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM activity_logs').get().n, 0); close();
});

test('known-series rollover collision preserves completed milestones and unrelated same-name tasks', async () => {
  const { q, close } = await fixture();
  const old = q.saveTaskFamily(undefined, task({ type: 'Hybrid', seriesId: 'series:1', occurrenceDate: '2026-09-28' }), [{ title: 'A' }, { title: 'B' }], []);
  const [a] = await q.getSubtasksByParent(old.id); q.changeTaskCompletion(a.id, true);
  const current = q.saveTaskFamily(undefined, task({ type: 'Hybrid', seriesId: 'series:1', occurrenceDate: '2026-10-01', scheduledDate: '2026-10-01' }), [{ title: 'A' }, { title: 'B' }], []);
  const other = await q.insertTask(task({ scheduledDate: '2026-10-01' }));
  q.rolloverTo('2026-10-01');
  assert.equal((await q.getSubtasksByParent(current.id))[0].isCompleted, true);
  assert.ok(await q.getTaskById(other.id)); assert.equal((await q.getTaskByDate('2026-10-01')).length, 2); close();
});
