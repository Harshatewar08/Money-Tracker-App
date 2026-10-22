import { getDb } from './db';

export async function getSetting(key, fallback = '') {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key, String(value)
  );
}

export async function getCurrentBalance() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'income'), 0) AS income,
       COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'expense'), 0) AS expense,
       COALESCE((SELECT SUM(amount) FROM account_entries WHERE kind = 'deposit'), 0) AS deposits,
       COALESCE((SELECT SUM(amount) FROM account_entries WHERE kind = 'withdrawal'), 0) AS withdrawals,
       COALESCE((SELECT SUM(amount) FROM debts WHERE direction = 'lent'), 0) AS lent,
       COALESCE((SELECT SUM(amount) FROM debts WHERE direction = 'borrowed'), 0) AS borrowed,
       COALESCE((SELECT SUM(p.amount) FROM debt_payments p
                 JOIN debts d ON d.id = p.debt_id WHERE d.direction = 'lent'), 0) AS received,
       COALESCE((SELECT SUM(p.amount) FROM debt_payments p
                 JOIN debts d ON d.id = p.debt_id WHERE d.direction = 'borrowed'), 0) AS paid`
  );
  const opening = parseFloat(await getSetting('opening_balance', '0')) || 0;
  return opening + row.income - row.expense - row.deposits + row.withdrawals;
}
