// src/db/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// This acts as the master blueprint map for a table inside our SQLite binary file
export const syncLogs = sqliteTable('sync_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), // Unique identification number per row
  timestamp: text('timestamp').notNull(),                 // Stores the exact clock time of the update
  status: text('status').notNull(),                      // Stores 'SUCCESS' or 'FAILED' labels
});
