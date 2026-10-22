import { getDb } from './db';

export function cleanTag(t) {
  return t.trim().replace(/^#/, '').toLowerCase();
}

export async function getAllTags() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM tags ORDER BY name');
}

export async function setTags(transactionId, names) {
  const db = await getDb();
  for (const raw of names) {
    const n = cleanTag(raw);
    if (!n) continue;
    await db.runAsync('INSERT OR IGNORE INTO tags (name) VALUES (?)', n);
    const tag = await db.getFirstAsync('SELECT id FROM tags WHERE name = ?', n);
    await db.runAsync(
      'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
      transactionId, tag.id
    );
  }
}

// Returns { transactionId: ['trip', 'diwali'], ... } for one day
export async function getTagsForDay(date) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT tt.transaction_id AS tid, g.name AS name
     FROM transaction_tags tt
     JOIN tags g ON g.id = tt.tag_id
     JOIN transactions t ON t.id = tt.transaction_id
     WHERE t.date = ?
     ORDER BY g.name`,
    date
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.tid]) map[r.tid] = [];
    map[r.tid].push(r.name);
  }
  return map;
}

// Returns { transactionId: ['trip', 'diwali'], ... } for all transactions
export async function getTagMap() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT tt.transaction_id AS tid, g.name AS name
     FROM transaction_tags tt
     JOIN tags g ON g.id = tt.tag_id
     ORDER BY g.name`
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.tid]) map[r.tid] = [];
    map[r.tid].push(r.name);
  }
  return map;
}