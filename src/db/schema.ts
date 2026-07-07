// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// This acts as the master blueprint map for a table inside our SQLite binary file
export const syncLogs = sqliteTable('sync_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), // Unique identification number per row
  timestamp: text('timestamp').notNull(),                 // Stores the exact clock time of the update
  status: text('status').notNull(),                      // Stores 'SUCCESS' or 'FAILED' labels
});

// Add this right at the bottom of your src/db/schema.ts file:

export const customMigrations = [
  `CREATE TABLE IF NOT EXISTS \`sync_logs\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`timestamp\` text NOT NULL,
    \`status\` text NOT NULL
  );`
];