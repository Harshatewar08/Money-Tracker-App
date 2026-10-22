import { getDb } from './db';

export async function getDebts() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT d.*, COALESCE(SUM(p.amount), 0) AS paid
     FROM debts d
     LEFT JOIN debt_payments p ON p.debt_id = d.id
     GROUP BY d.id
     ORDER BY d.date DESC, d.id DESC`
  );
  return rows.map((r) => ({ ...r, remaining: r.amount - r.paid }));
}

export async function addDebt({ person, direction, amount, date, note }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO debts (person, direction, amount, date, note) VALUES (?, ?, ?, ?, ?)',
    person, direction, amount, date, note || null
  );
}

export async function deleteDebt(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM debts WHERE id = ?', id);
}

export async function addPayment({ debtId, amount, date }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO debt_payments (debt_id, amount, date) VALUES (?, ?, ?)',
    debtId, amount, date
  );
}

export async function getPayments(debtId) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC',
    debtId
  );
}

export async function deletePayment(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM debt_payments WHERE id = ?', id);
}