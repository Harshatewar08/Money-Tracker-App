import { getDb } from './db';

export async function getAccounts() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT a.id, a.name, a.type,
       COALESCE(SUM(CASE
         WHEN e.kind = 'deposit' THEN e.amount
         WHEN e.kind = 'withdrawal' THEN -e.amount
       END), 0) AS balance
     FROM accounts a
     LEFT JOIN account_entries e ON e.account_id = a.id
     WHERE a.archived = 0
     GROUP BY a.id
     ORDER BY a.name`
  );
}

export async function addAccount(name, type) {
  const db = await getDb();
  await db.runAsync('INSERT INTO accounts (name, type) VALUES (?, ?)', name, type);
}

export async function addEntry({ accountId, amount, kind, date, note }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO account_entries (account_id, amount, kind, date, note)
     VALUES (?, ?, ?, ?, ?)`,
    accountId, amount, kind, date, note || null
  );
}

export async function getEntries(accountId) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM account_entries WHERE account_id = ? ORDER BY date DESC, id DESC',
    accountId
  );
}

export async function deleteEntry(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM account_entries WHERE id = ?', id);
}