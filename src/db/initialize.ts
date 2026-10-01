import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { db, expoDb } from './client';
// Legacy table-rebuild migrations need FKs disabled; enable after migrations on every connection.
export function enableIntegrity() { expoDb.execSync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;'); }
let preparing: Promise<void> | undefined;
export function prepareDatabase() {
  return preparing ??= migrate(db, migrations).then(enableIntegrity).catch(error => { preparing = undefined; throw error; });
}
