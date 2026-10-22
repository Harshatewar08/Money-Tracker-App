import * as SQLite from 'expo-sqlite';

let dbPromise;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('money.db');
      await db.execAsync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('expense','income')),
          icon TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          UNIQUE (name, type)
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL CHECK (amount > 0),
          type TEXT NOT NULL CHECK (type IN ('expense','income')),
          category_id INTEGER NOT NULL REFERENCES categories(id),
          payment_method TEXT NOT NULL DEFAULT 'cash'
            CHECK (payment_method IN ('cash','upi','card')),
          date TEXT NOT NULL,
          note TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
        
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS transaction_tags (
          transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (transaction_id, tag_id)
        );

        
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'other'
            CHECK (type IN ('rd','cash','other')),
          archived INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS account_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL REFERENCES accounts(id),
          amount REAL NOT NULL CHECK (amount > 0),
          kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal')),
          date TEXT NOT NULL,
          note TEXT
        );

        
        CREATE TABLE IF NOT EXISTS debts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person TEXT NOT NULL,
          direction TEXT NOT NULL CHECK (direction IN ('lent','borrowed')),
          amount REAL NOT NULL CHECK (amount > 0),
          date TEXT NOT NULL,
          note TEXT
        );

        CREATE TABLE IF NOT EXISTS debt_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
          amount REAL NOT NULL CHECK (amount > 0),
          date TEXT NOT NULL
        );
      `);
            const cols = await db.getAllAsync('PRAGMA table_info(transactions)');
      if (!cols.some((c) => c.name === 'name')) {
        await db.execAsync('ALTER TABLE transactions ADD COLUMN name TEXT');
        await db.execAsync('UPDATE transactions SET name = note WHERE note IS NOT NULL');
      }
      await seed(db);
      return db;
    })();
  }
  return dbPromise;
}

async function seed(db) {
  await db.runAsync(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('month_start_day', '1')"
  );

  const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM categories');
  if (row.c > 0) return;

  const expense = [
    ['Food', '🍔'], ['Groceries', '🛒'], ['Transport', '🚌'], ['Rent', '🏠'],
    ['Bills', '💡'], ['Shopping', '🛍️'], ['Health', '💊'],
    ['Entertainment', '🎬'], ['Education', '📚'], ['Other', '📦'],
  ];
  const income = [['Salary', '💰'], ['Other', '➕']];

  for (const [name, icon] of expense) {
    await db.runAsync(
      'INSERT INTO categories (name, type, icon) VALUES (?, ?, ?)',
      name, 'expense', icon
    );
  }
  for (const [name, icon] of income) {
    await db.runAsync(
      'INSERT INTO categories (name, type, icon) VALUES (?, ?, ?)',
      name, 'income', icon
    );
  }
}