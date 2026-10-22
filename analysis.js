import { getDb } from './db';
import { prettyDate, toDateStr } from './transactions';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parse(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m0: m - 1, d };
}

export function periodRange(mode, anchor, startDay) {
  const { y, m0, d } = parse(anchor);
  if (mode === 'day') return { start: anchor, end: anchor };
  if (mode === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` };
  const startM0 = d >= startDay ? m0 : m0 - 1;
  const start = new Date(y, startM0, startDay);
  const next = new Date(y, startM0 + 1, startDay);
  const end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function shiftPeriod(mode, anchor, startDay, dir) {
  if (mode === 'day') {
    const { y, m0, d } = parse(anchor);
    return toDateStr(new Date(y, m0, d + dir));
  }
  if (mode === 'year') {
    const { y } = parse(anchor);
    return `${y + dir}-01-01`;
  }
  const { start } = periodRange('month', anchor, startDay);
  const p = parse(start);
  return toDateStr(new Date(p.y, p.m0 + dir, startDay));
}

export function periodLabel(mode, anchor, startDay) {
  if (mode === 'day') return prettyDate(anchor);
  const { start, end } = periodRange(mode, anchor, startDay);
  const s = parse(start);
  const e = parse(end);
  if (mode === 'year') return String(s.y);
  if (startDay === 1) return `${FULL[s.m0]} ${s.y}`;
  return `${s.d} ${MON[s.m0]} – ${e.d} ${MON[e.m0]} ${e.y}`;
}

export async function getSummary(start, end) {
  const db = await getDb();
  const t = await db.getFirstAsync(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS spent,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income
     FROM transactions WHERE date BETWEEN ? AND ?`,
    start, end
  );
  const sv = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) AS saved
     FROM account_entries WHERE kind = 'deposit' AND date BETWEEN ? AND ?`,
    start, end
  );
  const cats = await db.getAllAsync(
    `SELECT c.name AS name, c.icon AS icon, SUM(t.amount) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
     GROUP BY c.id
     ORDER BY total DESC`,
    start, end
  );
  return { spent: t.spent, income: t.income, saved: sv.saved, cats };
}

export function listDates(start, end) {
  const s = parse(start);
  const out = [];
  for (let i = 0; i < 400; i++) {
    const d = toDateStr(new Date(s.y, s.m0, s.d + i));
    if (d > end) break;
    out.push(d);
  }
  return out;
}

// Returns { 'YYYY-MM-DD': totalSpent } for the period
export async function getDailySpend(start, end) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT date, SUM(amount) AS total
     FROM transactions
     WHERE type = 'expense' AND date BETWEEN ? AND ?
     GROUP BY date`,
    start, end
  );
  const map = {};
  for (const r of rows) map[r.date] = r.total;
  return map;
}

// Returns { spent: [12 numbers], saved: [12 numbers] } for a year
export async function getMonthlyTotals(year) {
  const db = await getDb();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const sp = await db.getAllAsync(
    `SELECT CAST(substr(date, 6, 2) AS INTEGER) AS m, SUM(amount) AS total
     FROM transactions
     WHERE type = 'expense' AND date BETWEEN ? AND ?
     GROUP BY m`,
    from, to
  );
  const sv = await db.getAllAsync(
    `SELECT CAST(substr(date, 6, 2) AS INTEGER) AS m, SUM(amount) AS total
     FROM account_entries
     WHERE kind = 'deposit' AND date BETWEEN ? AND ?
     GROUP BY m`,
    from, to
  );
  const spent = Array(12).fill(0);
  const saved = Array(12).fill(0);
  sp.forEach((r) => { spent[r.m - 1] = r.total; });
  sv.forEach((r) => { saved[r.m - 1] = r.total; });
  return { spent, saved };
}