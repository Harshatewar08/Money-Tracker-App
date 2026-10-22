import { getDb } from './db';

export async function getCategories(type) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM categories WHERE type = ? AND archived = 0 ORDER BY name',
    type
  );
}

export async function addCategory(name, type, icon) {
  const db = await getDb();
  const old = await db.getFirstAsync(
    'SELECT id FROM categories WHERE name = ? AND type = ? AND archived = 1',
    name, type
  );
  if (old) {
    await db.runAsync(
      'UPDATE categories SET archived = 0, icon = ? WHERE id = ?', icon, old.id
    );
    return;
  }
  await db.runAsync(
    'INSERT INTO categories (name, type, icon) VALUES (?, ?, ?)', name, type, icon
  );
}

export async function updateCategory(id, name, icon) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ? WHERE id = ?', name, icon, id
  );
}

export async function deleteCategory(id) {
  const db = await getDb();
  const used = await db.getFirstAsync(
    'SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?', id
  );
  if (used.c > 0) {
    await db.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', id);
  } else {
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  }
}

export async function getEveryCategory() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM categories ORDER BY name');
}