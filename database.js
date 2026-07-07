import * as SQLite from 'expo-sqlite';

let db = null;

// Safe helper function to ensure the database connection is open before running a query
const getDb = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('second_brain.db');
  }
  return db;
};

export const initializeDatabase = () => {
  const currentDb = getDb();

  // Wipe old tables one final time to make sure our columns are perfectly fresh
  try {
    currentDb.execSync(`DROP TABLE IF EXISTS tasks;`);
    currentDb.execSync(`DROP TABLE IF EXISTS goals;`);
    console.log("Old tables dropped cleanly.");
  } catch (e) {
    console.log("No tables existed yet.");
  }

  // Create Goals Table
  currentDb.execSync(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      units_completed INTEGER DEFAULT 0,
      deadline_timestamp INTEGER NOT NULL
    );
  `);

  // Create Tasks Table
  currentDb.execSync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'default',
      is_high_priority INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      target_date_text TEXT NOT NULL,
      rollover_count INTEGER DEFAULT 0,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );
  `);
  
  console.log("Database initialized safely after application mount.");
};

export const createTask = (goalId, title, isHighPriority, targetDateText, category = 'default') => {
  getDb().runSync(
    `INSERT INTO tasks (goal_id, title, is_high_priority, target_date_text, category) VALUES (?, ?, ?, ?, ?);`,
    [goalId, title, isHighPriority ? 1 : 0, targetDateText, category]
  );
};

export const getActiveTasks = () => {
  return getDb().getAllSync(`SELECT * FROM tasks WHERE is_completed = 0;`);
};

export const getCompletedTasks = () => {
  return getDb().getAllSync(`SELECT * FROM tasks WHERE is_completed = 1;`);
};

export const toggleTaskCompletion = (taskId, currentlyCompleted) => {
  const newStatus = currentlyCompleted ? 0 : 1;
  getDb().runSync(`UPDATE tasks SET is_completed = ? WHERE id = ?;`, [newStatus, taskId]);
};

export const deleteTask = (taskId) => {
  getDb().runSync(`DELETE FROM tasks WHERE id = ?;`, [taskId]);
};

export const getActiveGoals = () => {
  return getDb().getAllSync(`SELECT * FROM goals;`);
};

export const createGoal = (title, totalUnits, deadlineDaysFromNow) => {
  const deadlineTimestamp = Date.now() + (deadlineDaysFromNow * 24 * 60 * 60 * 1000);
  getDb().runSync(
    `INSERT INTO goals (title, total_units, deadline_timestamp) VALUES (?, ?, ?);`,
    [title, totalUnits, deadlineTimestamp]
  );
};

export const updateGoalProgress = (goalId, additionalUnits) => {
  getDb().runSync(`UPDATE goals SET units_completed = units_completed + ? WHERE id = ?;`, [additionalUnits, goalId]);
};

export const calculateDailyTarget = (totalUnits, unitsCompleted, deadlineTimestamp) => {
  const remainingUnits = totalUnits - unitsCompleted;
  if (remainingUnits <= 0) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const remainingDays = Math.ceil((deadlineTimestamp - Date.now()) / msPerDay);
  return remainingDays <= 0 ? remainingUnits : Math.ceil(remainingUnits / remainingDays);
};