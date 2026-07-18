// src/db/db.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const expoDb = openDatabaseSync('tasks_app.db');
export const db = drizzle(expoDb, { schema });

// Helper to manually create tables if they don't exist
export function initializeDatabase() {
  try {
    // 1. Create Tasks Table
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        current_progress INTEGER DEFAULT 0,
        total_progress INTEGER DEFAULT 0,
        progress_unit TEXT,
        subtasks_completed INTEGER DEFAULT 0,
        subtasks_total INTEGER DEFAULT 0,
        procrastination_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);

    // 2. Create Progress Logs Table
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS progress_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        logged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        notes TEXT
      );
    `);

    // 3. Create Goals Table
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        target_date TEXT
      );
    `);

    console.log("Database tables initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
  }
}