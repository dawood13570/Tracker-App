import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { tasks, taskTags } from './schema';
import { planRoot, rangeEnd, readPlanData, type PlanTask as Task } from './planData';
import { normalizeWeeks } from './quantityPlanning';
import { getAppToday } from '../utils/date';
export const isOccurrenceGoal = (t: Task) => t.scope !== 'daily' && t.parentId == null && (t.occurrenceTarget ?? 0) > 0;
export function occurrenceSchedule(root: Task, today: string, all = db.select().from(tasks).all()) {
  const leaves = all.filter(t => t.scope === 'daily' && planRoot(t, all).id === root.id);
  const remaining = Math.max(0, root.occurrenceTarget! - leaves.filter(t => t.isCompleted).length);
  const start = root.scheduledDate > today ? root.scheduledDate : today; const end = rangeEnd(root);
  if (start > end || !remaining) return [];
  if (differenceInCalendarDays(parseISO(end), parseISO(start)) > 36600) throw new Error('Choose a goal range of at most 100 years.');
  const existing = leaves.filter(t => !t.isCompleted && !t.skippedAt && t.scheduledDate >= start && t.scheduledDate <= end);
  const dates = new Set(existing.map(t => t.scheduledDate));
  const blocked = new Set(leaves.filter(t => t.isCompleted || t.skippedAt).map(t => t.scheduledDate));
  const gap = Math.max(1, Math.min(root.maxGapDays ?? Infinity, Math.floor((differenceInCalendarDays(parseISO(end), parseISO(start)) + 1) / remaining)));
  for (let date = start; date <= end && dates.size < remaining; date = format(addDays(parseISO(date), gap), 'yyyy-MM-dd')) if (!blocked.has(date)) dates.add(date);
  // If existing reservations collided with spacing, fill remaining available dates.
  for (let date = start; date <= end && dates.size < remaining; date = format(addDays(parseISO(date), 1), 'yyyy-MM-dd')) if (!blocked.has(date)) dates.add(date);
  const data = readPlanData(root, today, db, all);
  const ordered = [...dates].sort();
  let budget = Math.max(0, (root.totalProgress ?? 0) - data.done);
  const locked = new Map(existing.filter(t => (t.currentProgress ?? 0) > 0).map(t => [t.scheduledDate, t]));
  let free = Math.max(0, budget - [...locked.values()].reduce((n, t) => n + Math.max(0, (t.totalProgress ?? 0) - (t.currentProgress ?? 0)), 0));
  let slots = ordered.length - locked.size;
  return ordered.map(date => {
    const leaf = locked.get(date); const amount = leaf ? Math.max(0, (leaf.totalProgress ?? 0) - (leaf.currentProgress ?? 0)) : Math.min(free, Math.ceil(free / Math.max(1, slots)));
    if (!leaf) { free -= amount; slots--; } budget -= amount;
    return { date, target: root.totalProgress ? leaf?.totalProgress ?? amount : null };
  });
}
export function forecastOccurrenceGoals(from: string, to: string, today = getAppToday()) {
  const all = db.select().from(tasks).all();
  return all.filter(t => t.sourceTaskId == null && isOccurrenceGoal(t) && !t.isCompleted).flatMap(root => {
    const existing = new Set(all.filter(t => t.scope === 'daily' && planRoot(t, all).id === root.id).map(t => t.scheduledDate));
    return occurrenceSchedule(root, today, all).filter(d => d.date >= from && d.date <= to && !existing.has(d.date)).map(d => ({ goalId: root.id, goalTitle: root.title, type: root.type, priority: root.priority, date: d.date, totalProgress: d.target, progressUnit: root.progressUnit }));
  });
}
export function reconcileOccurrencePlans(today: string) {
  const roots = db.select().from(tasks).all().filter(t => t.sourceTaskId == null && isOccurrenceGoal(t));
  for (const root of roots) {
    if (today < root.scheduledDate || today > rangeEnd(root)) continue;
    db.transaction(tx => {
      normalizeWeeks(tx, root);
      const all = tx.select().from(tasks).all(); const schedule = occurrenceSchedule(root, today, all);
      const leaves = all.filter(t => t.scope === 'daily' && planRoot(t, all).id === root.id);
      const data = readPlanData(root, today, tx, all);
      const budget = (start: string, end: string) => {
        const completed = leaves.filter(t => t.isCompleted && t.scheduledDate >= start && t.scheduledDate <= end).length;
        const future = schedule.filter(d => d.date >= start && d.date <= end);
        const done = Object.entries(data.byDate).filter(([d]) => d >= start && d <= end).reduce((n, [,v]) => n + v, 0);
        return { occurrenceTarget: completed + future.length, subtasksCompleted: completed, currentProgress: done, totalProgress: root.totalProgress ? done + future.reduce((n,d) => n + Math.max(0, (d.target ?? 0) - (data.byDate[d.date] ?? 0)),0) : null, isCompleted: future.length === 0 && completed > 0 };
      };
      const ensureWeek = (date: string) => {
        if (root.scope === 'weekly') return root;
        const start = format(startOfWeek(parseISO(date), {weekStartsOn:1}), 'yyyy-MM-dd'); const end = format(endOfWeek(parseISO(date), {weekStartsOn:1}), 'yyyy-MM-dd');
        const existing = all.find(t => t.sourceTaskId === root.id && t.scope === 'weekly' && t.scheduledDate === start);
        const values = budget(start,end);
        if (existing) return tx.update(tasks).set(values).where(eq(tasks.id,existing.id)).returning().get();
        const week = tx.insert(tasks).values({...values,title:`${root.title} (Weekly)`,type:root.type,priority:root.priority,pursuitId:root.pursuitId,scope:'weekly',scheduledDate:start,deadline:end < rangeEnd(root) ? end : rangeEnd(root),sourceTaskId:root.id,rolloverEnabled:false,progressUnit:root.progressUnit}).returning().get();all.push(week);return week;
      };
      for (const day of schedule) {
        const existing = leaves.find(t => t.scheduledDate === day.date);
        if (!existing && day.date !== today) continue;
        const week = ensureWeek(day.date);
        if (existing) tx.update(tasks).set({sourceTaskId:week.id,totalProgress:day.target}).where(eq(tasks.id,existing.id)).run();
        else {
          const leaf=tx.insert(tasks).values({title:root.title,type:root.type,priority:root.priority,pursuitId:root.pursuitId,scope:'daily',scheduledDate:day.date,deadline:day.date,sourceTaskId:week.id,totalProgress:day.target,progressUnit:root.progressUnit,rolloverEnabled:false,isSequential:root.isSequential,subtasksTotal:root.subtasksTotal,seriesId:`occurrence:${root.id}`,occurrenceDate:day.date}).returning().get();
          for(const tag of tx.select().from(taskTags).where(eq(taskTags.taskId,root.id)).all())tx.insert(taskTags).values({taskId:leaf.id,tagId:tag.tagId}).onConflictDoNothing().run();
          // Independent hybrid runs receive their own milestone template.
          for(const sub of all.filter(t=>t.parentId===root.id)) { const {id,...copy}=sub;tx.insert(tasks).values({...copy,parentId:leaf.id,sourceTaskId:null,scope:'daily',scheduledDate:day.date,currentProgress:0,isCompleted:false,completedAt:null,completedDate:null,completionPreviousProgress:null,subtasksCompleted:0,bankCovered:0,bufferDays:0,nextOccurrenceGenerated:false,seriesId:null,occurrenceDate:null}).run(); }
        }
      }
      for (const week of all.filter(t=>t.sourceTaskId===root.id&&t.scope==='weekly')) ensureWeek(week.scheduledDate);
      if(root.scope==='yearly'||root.scope==='custom') for(let date=startOfMonth(parseISO(root.scheduledDate));format(date,'yyyy-MM-dd')<=rangeEnd(root);date=addMonths(date,1)) {
        const start=format(date,'yyyy-MM-dd');const end=format(endOfMonth(date),'yyyy-MM-dd'); const values={...budget(start,end),planSummary:true};
        const existing=all.find(t=>t.sourceTaskId===root.id&&t.scope==='monthly'&&t.scheduledDate===start);
        if(existing)tx.update(tasks).set(values).where(eq(tasks.id,existing.id)).run();
        else tx.insert(tasks).values({...values,title:`${root.title} (Monthly summary)`,type:root.type,priority:root.priority,pursuitId:root.pursuitId,scope:'monthly',scheduledDate:start,deadline:end<rangeEnd(root)?end:rangeEnd(root),sourceTaskId:root.id,progressUnit:root.progressUnit,rolloverEnabled:false}).run();
      }
    });
  }
}
