// src/db/client.ts
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

// Accepts an actively open, verified database handle and wraps it in Drizzle
export function getDrizzleInstance(nativeDb: SQLite.SQLiteDatabase) {
  return drizzle(nativeDb);
}