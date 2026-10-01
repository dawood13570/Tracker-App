const test = require('node:test');
const assert = require('node:assert/strict');
const {fixture, task} = require('./helpers.cjs');
const options = {targetRate:5,bankedDaysEarned:1,suggestedNewTarget:60};
async function goal(q, extra={}) { return q.insertTask(task({type:'Progression',scope:'custom',scheduledDate:'2026-10-01',deadline:'2026-10-10',totalProgress:50,progressUnit:'pages',...extra})); }
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
test('bank covers tomorrow, actual work releases coverage forward, and corrections reverse earnings',async()=>{
 const {q,sqlite,close}=await fixture(); const root=await goal(q);
 let plan=q.reconcileQuantityGoal(root.id,'2026-10-01'); assert.equal(plan.daily.totalProgress,5);
 q.commitProgressAction(plan.daily.id,10,root.id,'bank_it',options);
 plan=q.reconcileQuantityGoal(root.id,'2026-10-02'); const covered=plan.daily;
 assert.equal(covered.bankCovered,5); assert.equal(covered.currentProgress,0); assert.equal(covered.isCompleted,false);
 assert.equal(await q.getEffectiveProgress(root.id),10);
 q.changeProgress(covered.id,5);
 plan=q.reconcileQuantityGoal(root.id,'2026-10-02'); assert.equal(plan.days.find(d=>d.date==='2026-10-03').covered,5);
 assert.equal(await q.getEffectiveProgress(root.id),15);
 const first=(await q.getTaskByDate('2026-10-01'))[0]; q.changeProgress(first.id,5);
 plan=q.reconcileQuantityGoal(root.id,'2026-10-02'); assert.equal(plan.days.reduce((n,d)=>n+d.covered,0),0);
 assert.equal(sqlite.prepare('select sum(earned) n from surplus_credits').get().n,0);
 near(plan.days.reduce((n,d)=>n+d.work,0),40); close();
});
test('split entries earn fractional quantity credit; partial actual work keeps only needed coverage',async()=>{
 const {q,sqlite,close}=await fixture();const root=await goal(q);let plan=q.reconcileQuantityGoal(root.id,'2026-10-01');
 q.changeProgress(plan.daily.id,4);q.commitProgressAction(plan.daily.id,7,root.id,'bank_it',options);
 plan=q.reconcileQuantityGoal(root.id,'2026-10-02');assert.equal(plan.daily.bankCovered,2);near((await q.getTaskById(root.id)).bufferDays,0.4);
 q.changeProgress(plan.daily.id,3);plan=q.reconcileQuantityGoal(root.id,'2026-10-02');assert.equal(plan.daily.bankCovered,2);
 plan=q.reconcileQuantityGoal(root.id,'2026-10-03');assert.equal(plan.daily.bankCovered,0);near(plan.spent,2);
 const first=(await q.getTaskByDate('2026-10-01'))[0];q.changeProgress(first.id,5);plan=q.reconcileQuantityGoal(root.id,'2026-10-03');assert.equal(plan.days.reduce((n,d)=>n+d.covered,0),0);
 assert.equal(sqlite.prepare('select count(*) n from progress_logs where credit_date is null').get().n,0);close();
});
test('continuous custom weeks cross year boundaries with one parent and adaptive budgets',async()=>{
 const {q,sqlite,close}=await fixture();const root=await goal(q,{deadline:'2027-02-28',totalProgress:755});
 let plan=q.reconcileQuantityGoal(root.id,'2026-12-28');const weekId=plan.week.id;
 q.changeProgress(plan.daily.id,2);const frozen=plan.daily.totalProgress;
 await q.updateTask(root.id,{totalProgress:900});
 plan=q.reconcileQuantityGoal(root.id,'2026-12-28');assert.equal(plan.daily.totalProgress,frozen);
 plan=q.reconcileQuantityGoal(root.id,'2027-01-01');assert.equal(plan.week.id,weekId);assert.equal(plan.week.deadline,'2027-01-03');assert.equal(plan.week.sourceTaskId,root.id);
 assert.equal(sqlite.prepare("select count(*) n from tasks where scope='weekly' and scheduled_date='2026-12-28'").get().n,1);
 near(plan.days.reduce((n,d)=>n+d.work,0),898);close();
});
test('yearly monthly summaries weight calendar days and never double-count actual progress',async()=>{
 const {q,sqlite,close}=await fixture();const root=await goal(q,{scope:'yearly',scheduledDate:'2027-01-01',deadline:'2027-12-31',totalProgress:365});
 let plan=q.reconcileQuantityGoal(root.id,'2027-01-01');
 const months=sqlite.prepare("select * from tasks where plan_summary=1 order by scheduled_date").all();assert.equal(months.length,12);assert.equal(months[0].total_progress,31);assert.equal(months[1].total_progress,28);
 q.changeProgress(plan.daily.id,1);plan=q.reconcileQuantityGoal(root.id,'2027-01-01');assert.equal(await q.getEffectiveProgress(root.id),1);assert.equal(await q.getEffectiveProgress(plan.month.id),1);
 const before=sqlite.prepare('select count(*) n from tasks').get().n;const forecast=q.forecastQuantityGoals('2027-01-01','2027-12-31','2027-01-01');assert.equal(forecast.length,364);assert.equal(sqlite.prepare('select count(*) n from tasks').get().n,before);close();
});
test('legacy split weeks consolidate without losing progress or children',async()=>{
 const {q,sqlite,close}=await fixture();const root=await goal(q,{scope:'yearly',scheduledDate:'2026-01-01',deadline:'2026-12-31',totalProgress:365});
 const a=await q.insertTask(task({scope:'monthly',scheduledDate:'2026-01-01',sourceTaskId:root.id,totalProgress:31,type:'Progression'}));
 const b=await q.insertTask(task({scope:'monthly',scheduledDate:'2026-02-01',sourceTaskId:root.id,totalProgress:28,type:'Progression'}));
 const w1=await q.insertTask(task({scope:'weekly',scheduledDate:'2026-01-26',sourceTaskId:a.id,totalProgress:6,type:'Progression'}));
 const w2=await q.insertTask(task({scope:'weekly',scheduledDate:'2026-01-26',sourceTaskId:b.id,totalProgress:1,type:'Progression'}));
 const daily=await q.insertTask(task({scheduledDate:'2026-02-01',sourceTaskId:w2.id,totalProgress:1,type:'Progression'}));q.changeProgress(daily.id,1);q.changeProgress(w2.id,2);
 q.reconcileQuantityGoal(root.id,'2026-02-01');assert.equal((await q.getTaskById(daily.id)).sourceTaskId,w1.id);assert.equal(await q.getEffectiveProgress(root.id),3);assert.equal(await q.getTaskById(w2.id),null);
 assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);close();
});
test('bank and coverage survive backup restore and version-one backups upgrade',async()=>{
 const {q,close}=await fixture();const root=await goal(q);let plan=q.reconcileQuantityGoal(root.id,'2026-10-01');q.commitProgressAction(plan.daily.id,10,root.id,'bank_it',options);q.reconcileQuantityGoal(root.id,'2026-10-02');
 const backup=q.exportBackup();assert.equal(backup.version,2);q.restoreBackup(backup);assert.deepEqual(q.exportBackup().tables,backup.tables);
 const old=structuredClone(backup);old.version=1;delete old.tables.surplus_credits;delete old.tables.goal_rest_days;old.tables.tasks.forEach(t=>{delete t.plan_summary;delete t.bank_covered});old.tables.progress_logs.forEach(l=>delete l.credit_date);q.restoreBackup(old);assert.equal(q.exportBackup().version,2);close();
});
test('standalone repeating quantity tasks share bank without faking next occurrence progress',async()=>{
 const {q,sqlite,close}=await fixture();const date=q.getAppToday();const root=await q.insertTask(task({scheduledDate:date,type:'Progression',totalProgress:5,recurrenceType:'daily'}));
 q.commitProgressAction(root.id,10,root.id,'bank_it',options);q.reconcileDailyBanks(date);
 const next=await q.getTaskById(sqlite.prepare('select id from tasks where id != ? and series_id = ?').get(root.id,`task:${root.id}`).id);
 assert.equal(next.bankCovered,5);assert.equal(await q.getCurrentProgress(next.id),0);q.changeProgress(next.id,5);q.reconcileDailyBanks(date);
 const future=await q.getTaskById(sqlite.prepare('select id from tasks where scheduled_date > ? and series_id = ?').get(next.scheduledDate,next.seriesId).id);assert.equal(future.bankCovered,5);close();
});
test('quantity projection conserves remaining work over surplus, shortfall, skips and locked days',async()=>{
 const {q,close}=await fixture();
 for(let i=0;i<100;i++){
  const done=i/3, credits=[{date:'2026-09-30',amount:i/7}];
  const plan=q.projectQuantity({start:'2026-10-01',end:'2026-10-31',today:'2026-10-01',total:100,done,baseline:4,mode:i%2?'none':'breathing_room',progressByDate:{'2026-10-01':done},lockedTargets:{'2026-10-01':4},restDates:new Set(['2026-10-02']),credits});
  near(plan.reduce((n,d)=>n+d.work,0),100-done);assert.ok(plan.every(d=>d.work>=0&&d.covered>=0));
 }close();
});
test('occurrence forecasts and stored weeks share a range-wide schedule across New Year',async()=>{
 const {q,sqlite,close}=await fixture();const root=await goal(q,{type:'Simple',totalProgress:null,occurrenceTarget:10,scheduledDate:'2026-12-28',deadline:'2027-01-06'});
 const dates=q.forecastOccurrenceGoals('2026-12-28','2027-01-06','2026-12-28').map(d=>d.date);assert.equal(dates.length,10);
 await q.ensureDailyDecompositionForDate('2026-12-28');const first=(await q.getTaskByDate('2026-12-28'))[0];q.changeTaskCompletion(first.id,true);
 await q.ensureDailyDecompositionForDate('2027-01-01');const next=(await q.getTaskByDate('2027-01-01'))[0];assert.equal(next.sourceTaskId,first.sourceTaskId);
 assert.equal((await q.getTaskById(first.sourceTaskId)).deadline,'2027-01-03');assert.equal(await q.getCompletedOccurrenceCount(root.id),1);
 assert.equal(sqlite.prepare("select count(*) n from tasks where scope='weekly' and scheduled_date='2026-12-28'").get().n,1);close();
});
test('completed quantity goals stop projecting bank-only future tasks',async()=>{
 const {q,close}=await fixture();const root=await goal(q);let plan=q.reconcileQuantityGoal(root.id,'2026-10-01');q.commitProgressAction(plan.daily.id,50,root.id,'bank_it',options);plan=q.reconcileQuantityGoal(root.id,'2026-10-02');assert.equal(plan.daily,undefined);assert.equal(plan.days.reduce((n,d)=>n+d.target,0),0);close();
});
test('root-level logs rebalance once and historical corrections retain their earning dates',async()=>{
 const {q,sqlite,close}=await fixture();const today=q.getAppToday();const root=await goal(q,{scheduledDate:today,deadline:today,totalProgress:100,nominalDailyTarget:5});
 q.commitProgressAction(root.id,10,root.id,'bank_it',options);q.changeProgress(root.id,7);const credit=sqlite.prepare('select * from surplus_credits where owner_id=?').get(root.id);assert.equal(credit.earned,2);assert.equal(credit.app_date,today);assert.equal(await q.getEffectiveProgress(root.id),7);close();
});
test('fully covered recurring days advance without invented logs or duplicate next occurrences',async()=>{
 const {q,sqlite,close}=await fixture();const date=q.getAppToday();const root=await q.insertTask(task({scheduledDate:date,type:'Progression',totalProgress:5,recurrenceType:'daily'}));q.commitProgressAction(root.id,10,root.id,'bank_it',options);q.reconcileDailyBanks(date);
 const covered=sqlite.prepare('select * from tasks where id != ?').get(root.id);q.advanceCoveredRepeats(covered.scheduled_date);q.advanceCoveredRepeats(covered.scheduled_date);
 assert.equal(sqlite.prepare('select count(*) n from tasks').get().n,3);assert.equal(sqlite.prepare('select count(*) n from progress_logs where task_id=?').get(covered.id).n,0);close();
});
test('legacy bank days migrate to quantity using the original date range',async()=>{
 const {q,sqlite,close}=await fixture(db=>db.exec("INSERT INTO tasks (id,title,type,priority,scope,scheduled_date,deadline,total_progress,buffer_days) VALUES (1,'Read','Progression','Medium','weekly','2026-09-28','2026-10-04',35,2)"));
 const credit=sqlite.prepare('select * from surplus_credits where owner_id=1').get();assert.equal(credit.earned,10);assert.equal(credit.baseline,5);const plan=q.reconcileQuantityGoal(1,'2026-09-28');assert.equal(plan.days.reduce((n,d)=>n+d.covered,0),10);close();
});
test('small annual quantities are spread across the year instead of rounded into the first months',async()=>{
 const {q,close}=await fixture();const root=await goal(q,{scope:'yearly',scheduledDate:'2027-01-01',deadline:'2027-12-31',totalProgress:100});const plan=q.reconcileQuantityGoal(root.id,'2027-01-01');
 near(plan.days.reduce((n,d)=>n+d.work,0),100);assert.ok(plan.days.filter(d=>d.date>='2027-12-01').some(d=>d.target>0));assert.ok(plan.month.totalProgress>=8&&plan.month.totalProgress<=9);q.changeProgress(plan.daily.id,1);const next=q.reconcileQuantityGoal(root.id,'2027-01-02');assert.equal(next.days[0].target,0);assert.ok(next.days.filter(d=>d.date>='2027-12-01').some(d=>d.target>0));close();
});
