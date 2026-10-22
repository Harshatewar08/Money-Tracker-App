import { setTags } from './tags';

import { getDb } from './db';

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

export function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toDateString();
}

export async function addTransaction({
  amount, type, categoryId, paymentMethod, date, name, tags,
}) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions (amount, type, category_id, payment_method, date, name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    amount, type, categoryId, paymentMethod, date, name || null
  );
  if (tags && tags.length) {
    await setTags(result.lastInsertRowId, tags);
  }
}

export async function getTransactionsByDate(date) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.date = ?
     ORDER BY t.id DESC`,
    date
  );
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export function parseQuick(text) {
  const tags = (text.match(/#[^\s#]+/g) || []).map((t) => t.slice(1).toLowerCase());
  const rest = text.replace(/#[^\s#]+/g, ' ');
  const matches = [...rest.matchAll(/(?:₹\s*)?(\d+(?:\.\d+)?)/g)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  const name = (rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length))
    .replace(/\s+/g, ' ')
    .trim();
  return { amount: parseFloat(m[1]), name, tags };
}

export async function findLastByName(name) {
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT t.type, t.category_id, t.payment_method
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE LOWER(t.name) = LOWER(?) AND c.archived = 0
     ORDER BY t.id DESC LIMIT 1`,
    name
  );
}

export async function getAllTransactions(type, limit = 100) {
  const db = await getDb();
  const filtered = type && type !== 'all';
  const params = filtered ? [type, limit] : [limit];
  return db.getAllAsync(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ${filtered ? 'WHERE t.type = ?' : ''}
     ORDER BY t.date DESC, t.id DESC
     LIMIT ?`,
    ...params
  );
}

export async function searchTransactions(
  { type, text, categoryId, method, tag, from, to },
  limit = 100
) {
  const db = await getDb();
  const where = [];
  const params = [];

  if (type && type !== 'all') { where.push('t.type = ?'); params.push(type); }
  if (categoryId) { where.push('t.category_id = ?'); params.push(categoryId); }
  if (method) { where.push('t.payment_method = ?'); params.push(method); }
  if (from) { where.push('t.date >= ?'); params.push(from); }
  if (to) { where.push('t.date <= ?'); params.push(to); }
  if (tag) {
    where.push(
      `EXISTS (SELECT 1 FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id
               WHERE tt.transaction_id = t.id AND g.name = ?)`
    );
    params.push(tag);
  }
  const q = (text || '').trim().replace(/^#/, '').toLowerCase();
  if (q) {
    const like = `%${q}%`;
    where.push(
      `(LOWER(COALESCE(t.name, '')) LIKE ?
        OR LOWER(c.name) LIKE ?
        OR LOWER(COALESCE(t.note, '')) LIKE ?
        OR CAST(t.amount AS TEXT) LIKE ?
        OR EXISTS (SELECT 1 FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id
                   WHERE tt.transaction_id = t.id AND g.name LIKE ?))`
    );
    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = await db.getAllAsync(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ${whereSql}
     ORDER BY t.date DESC, t.id DESC
     LIMIT ?`,
    ...params, limit
  );
  const sums = await db.getFirstAsync(
    `SELECT COUNT(*) AS n,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS spent,
       COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS income
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ${whereSql}`,
    ...params
  );
  return { rows, n: sums.n, spent: sums.spent, income: sums.income };
}