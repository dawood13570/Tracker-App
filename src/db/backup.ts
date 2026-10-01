import { differenceInCalendarDays, parseISO } from 'date-fns';
import { rangeEnd } from './planData';
import { validatePreferences } from './backupPreferences';
import { db, expoDb } from './client';

export const BACKUP_TABLES = ['pursuits', 'tasks', 'goals', 'habits', 'events', 'activities', 'tags', 'notes', 'progress_logs', 'habit_logs', 'activity_logs', 'task_tags', 'habit_tags', 'event_tags', 'activity_tags', 'activity_log_tags', 'task_history', 'surplus_credits', 'goal_rest_days'] as const;
const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
type Value = string | number | null;
export type Backup = { format: 'reckon-backup'; version: 2; createdAt: string; tables: Record<string, Record<string, Value>[]>; preferences?: Record<string, string> };
export function exportBackup(): Backup {
  return db.transaction(() => ({ format: 'reckon-backup', version: 2, createdAt: new Date().toISOString(), tables: Object.fromEntries(BACKUP_TABLES.map(table => [table, expoDb.getAllSync<Record<string, Value>>(`SELECT * FROM "${table}"`)])) }));
}
export function validateBackup(input: unknown): Backup {
  let backup = input as Backup;
  if (backup && (backup as any).version === 1 && backup.tables) {
    backup = JSON.parse(JSON.stringify(backup));
    if (Object.keys(backup.tables).length !== BACKUP_TABLES.length - 2) throw new Error('The backup has missing or unknown tables.');
    backup.version = 2;
    backup.tables.surplus_credits = [];
    backup.tables.goal_rest_days = [];
    for (const task of backup.tables.tasks ?? []) {
      task.plan_summary = 0; task.bank_covered = 0;
      if (Number(task.buffer_days) > 0) {
        const end = rangeEnd({ scheduledDate: task.scheduled_date, scope: task.scope, deadline: task.deadline } as any);
        const days = Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(String(task.scheduled_date))) + 1);
        const baseline = Number(task.nominal_daily_target ?? (task.total_progress == null ? 1 : Number(task.total_progress) / days));
        let owner = task; const seen = new Set<Value>();
        while (owner.source_task_id != null && !seen.has(owner.id)) { seen.add(owner.id); const parent = backup.tables.tasks.find(t => t.id === owner.source_task_id); if (!parent) break; owner = parent; }
        const credit = backup.tables.surplus_credits.find(c => c.owner_id === owner.id);
        if (credit) credit.earned = Number(credit.earned) + Number(task.buffer_days) * baseline;
        else backup.tables.surplus_credits.push({ id: backup.tables.surplus_credits.length + 1, owner_id: owner.id, app_date: '0001-01-01', baseline, earned: Number(task.buffer_days) * baseline, bank_requested: 1, legacy: 1 });
      }
    }
    for (const log of backup.tables.progress_logs ?? []) {
      const task = backup.tables.tasks.find(t => t.id === log.task_id);
      log.credit_date = (task?.scope === 'daily' ? task.scheduled_date : log.app_date ?? String(log.logged_at).slice(0, 10));
    }
  }
  if (!backup || backup.format !== 'reckon-backup' || backup.version !== 2 || !backup.tables) throw new Error('This is not a supported Reckon backup.');
  if (Object.keys(backup.tables).length !== BACKUP_TABLES.length) throw new Error('The backup has missing or unknown tables.');
  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table];
    if (!Array.isArray(rows)) throw new Error(`Missing ${table} records.`);
    const columns = expoDb.getAllSync<{ name: string; type: string; notnull: number }>(`PRAGMA table_info("${table}")`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !columns.some(c => c.name === key))) throw new Error(`Invalid columns in ${table}.`);
      for (const col of columns) {
        const value = row[col.name];
        if (value === undefined || (col.notnull && value === null) || (value !== null && typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Invalid ${table}.${col.name}.`);
        if ((col.name === 'id' || col.name.endsWith('_id')) && col.type.toUpperCase() === 'INTEGER' && value !== null && (!Number.isSafeInteger(value) || Number(value) < 1)) throw new Error('Invalid record identifier.');
        if (value !== null && ['is_completed', 'is_sequential', 'is_auto_generated', 'rollover_enabled', 'next_occurrence_generated', 'plan_summary', 'bank_requested', 'legacy'].includes(col.name) && value !== 0 && value !== 1) throw new Error('Invalid boolean value.');
        if (value !== null && col.type.toUpperCase() === 'INTEGER' && typeof value !== 'number') throw new Error(`Expected a number for ${table}.${col.name}.`);
      }
    }
  }
  for (const table of ['surplus_credits', 'goal_rest_days']) for (const row of backup.tables[table]) {
    if (!validDate(row.app_date)) throw new Error('Invalid bank date.');
    for (const field of ['baseline', 'earned', 'target', 'covered']) if (row[field] != null && Number(row[field]) < 0) throw new Error('Negative bank amount.');
  }
  validatePreferences(backup.preferences);
  for (const pursuit of backup.tables.pursuits) if (!['plan_to_do','active','on_hold','dropped','completed'].includes(String(pursuit.status))) throw new Error('Invalid pursuit status.');
  for (const note of backup.tables.notes) if (!['daily','weekly','monthly','yearly','custom'].includes(String(note.scope))) throw new Error('Invalid note scope.');
  const tasks = new Map(backup.tables.tasks.map(t => [t.id, t]));
  for (const task of tasks.values()) {
    if (!['Simple', 'Hybrid', 'Progression'].includes(String(task.type)) || !['daily','weekly','monthly','yearly','custom'].includes(String(task.scope)) || !['Low','Medium','High'].includes(String(task.priority))) throw new Error('Invalid task type, scope, or priority.');
    if (!validDate(task.scheduled_date)) throw new Error('Invalid task date.');
    for (const key of ['deadline', 'occurrence_date', 'paused_until', 'completed_date']) if (task[key] !== null && !validDate(task[key])) throw new Error('Invalid task date.');
    if (!['none', 'daily', 'weekly', 'every_n_days'].includes(String(task.recurrence_type))) throw new Error('Invalid repeat pattern.');
    if (task.total_progress != null && Number(task.total_progress) < 0) throw new Error('Negative task target.');
    for (const key of ['source_task_id', 'parent_id', 'rollover_from_id']) {
      const seen = new Set<Value>([task.id]); let next = task[key];
      while (next != null) {
        if (seen.has(next)) throw new Error('Task relationships contain a cycle.');
        seen.add(next); const ancestor = tasks.get(next);
        if (!ancestor) { if (key === 'rollover_from_id') break; throw new Error('Task relationship points to a missing task.'); }
        next = ancestor[key];
      }
    }
  }
  const visited = new Set<Value>();
  const active = new Set<Value>();
  const visit = (id: Value) => {
    if (active.has(id)) throw new Error('Task relationships contain a cycle.');
    if (visited.has(id)) return;
    active.add(id);
    const task = tasks.get(id)!;
    for (const key of ['source_task_id', 'parent_id']) if (task[key] != null) visit(task[key]);
    active.delete(id); visited.add(id);
  };
  for (const id of tasks.keys()) visit(id);
  return backup;
}
export function restoreBackup(input: unknown) {
  const backup = validateBackup(input);
  db.transaction(() => {
    expoDb.execSync('PRAGMA defer_foreign_keys = ON;');
    for (const table of [...BACKUP_TABLES].reverse()) expoDb.runSync(`DELETE FROM "${table}"`);
    for (const table of BACKUP_TABLES) for (const row of backup.tables[table]) {
      const keys = Object.keys(row);
      expoDb.runSync(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map(k => row[k]));
    }
    if (expoDb.getAllSync('PRAGMA foreign_key_check').length) throw new Error('Backup contains broken relationships. Current data was not replaced.');
  });
}
