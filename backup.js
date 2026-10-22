import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { setSetting } from './balance';
import { getDb } from './db';
import { todayStr } from './transactions';

const TABLES = [
  'settings', 'categories', 'tags', 'transactions', 'transaction_tags',
  'accounts', 'account_entries', 'debts', 'debt_payments',
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${todayStr()}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function shareText(filename, text, mimeType) {
  const file = new File(Paths.cache, filename);
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

export async function exportBackup() {
  const db = await getDb();
  const tables = {};
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  const payload = {
    app: 'money-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
  await shareText(`money-backup-${stamp()}.json`, JSON.stringify(payload), 'application/json');
  await setSetting('last_backup', todayStr());
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function exportCsv() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT t.date AS date, t.type AS type, COALESCE(t.name, '') AS name,
            c.name AS category, t.amount AS amount, t.payment_method AS payment_method,
            COALESCE((SELECT GROUP_CONCAT(g.name, ' ')
                      FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id
                      WHERE tt.transaction_id = t.id), '') AS tags
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ORDER BY t.date, t.id`
  );
  const header = ['date', 'type', 'name', 'category', 'amount', 'payment_method', 'tags'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map((h) => (h === 'amount' ? r[h] : q(r[h]))).join(','));
  }
  await shareText(`money-transactions-${stamp()}.csv`, lines.join('\n'), 'text/csv');
}

export async function restoreBackup() {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets || !res.assets.length) return false;

  const file = new File(res.assets[0].uri);
  const data = JSON.parse(file.textSync());
  if (data.app !== 'money-app' || !data.tables) {
    throw new Error('This file is not a backup from this app.');
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of TABLES) {
      for (const row of data.tables[t] || []) {
        const cols = Object.keys(row);
        if (!cols.every((c) => /^[a-z_]+$/.test(c))) {
          throw new Error('The backup file is invalid.');
        }
        await db.runAsync(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => row[c])
        );
      }
    }
  });
  return true;
}