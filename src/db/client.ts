// src/db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

// Open a physical connection to your device's storage file
export const expoDb = SQLite.openDatabaseSync('my_app_db.db');

// Creates a single, shared Drizzle instance for your whole application
export const db = drizzle(expoDb);

// Keeps your existing factory function intact if you need to pass temporary handles elsewhere
export function getDrizzleInstance(nativeDb: SQLite.SQLiteDatabase) {
  return drizzle(nativeDb);
}