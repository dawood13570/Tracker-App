// src/db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

const g = globalThis as unknown as {
  __expoDb?: SQLite.SQLiteDatabase;
};

export const expoDb =
  g.__expoDb ?? (g.__expoDb = SQLite.openDatabaseSync('my_app_db_v3.db'));

expoDb.execSync('PRAGMA journal_mode = WAL;');

export const db = drizzle(expoDb);