const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const Module = require('node:module');
const { build } = require('esbuild');
const { drizzle } = require(process.cwd() + '/node_modules/drizzle-orm/expo-sqlite/driver.cjs');
let bundle;
async function fixture(beforeUpgrade) {
  const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  sqlite.exec('BEGIN');
  for (const f of fs.readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
    if (f.startsWith('0017_') && beforeUpgrade) beforeUpgrade(sqlite);
    for (const statement of fs.readFileSync(`drizzle/${f}`, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.prepare(statement).run();
    }
  }
  sqlite.exec('COMMIT; PRAGMA foreign_keys = ON');
  const client = { prepareSync(sql) { return {
    executeSync(params) { const q = sqlite.prepare(sql); if (!q.columns().length) return q.run(...params); return { getAllSync: () => q.all(...params), getFirstSync: () => q.get(...params) }; },
    executeForRawResultSync(params) { const q = sqlite.prepare(sql); q.setReturnArrays(true); return { getAllSync: () => q.all(...params) }; },
  }; } };
  global.__auditDb = drizzle(client);
  global.__auditNative = { execSync: sql => sqlite.exec(sql), getAllSync: (sql,...params) => sqlite.prepare(sql).all(...params), getFirstSync: (sql,...params) => sqlite.prepare(sql).get(...params), runSync: (sql,...params) => sqlite.prepare(sql).run(...params) };
  global.__auditStorage = new Map();
  if (!bundle) bundle = (await build({
    stdin: { contents: "export * from './src/db/occurrencePlanning'; export * from './src/db/quantityPlanning'; export * from './src/engine/quantityPlan'; export * from './src/db/backup'; export * from './src/db/queries'; export * from './src/db/lifecycle'; export * from './src/utils/date'; export { useStore } from './src/store/useStore';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'native-adapter', setup(b) {
      b.onLoad({ filter: /src\/db\/client\.ts$/ }, () => ({ contents: 'export const db = globalThis.__auditDb; export const expoDb = globalThis.__auditNative;', loader: 'ts' }));
      b.onLoad({ filter: /src\/store\/storage\.ts$/ }, () => ({ contents: 'export const settingsStorage = { getItem: k => globalThis.__auditStorage.get(k) ?? null, setItem: (k,v) => globalThis.__auditStorage.set(k,v), removeItem: k => globalThis.__auditStorage.delete(k) };', loader: 'ts' }));
    } }],
  })).outputFiles[0].text;
  const m = new Module(process.cwd() + '/test-runtime.cjs', module); m.paths = module.paths; m._compile(bundle, process.cwd() + '/test-runtime.cjs');
  return { q: m.exports, sqlite, close: () => sqlite.close() };
}
const task = (fields = {}) => ({ title: 'Read', type: 'Simple', priority: 'Medium', scheduledDate: '2026-09-28', ...fields });
module.exports = { fixture, task };
