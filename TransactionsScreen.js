import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { periodRange } from './analysis';
import { getSetting } from './balance';
import { getEveryCategory } from './categories';
import { getAllTags, getTagMap } from './tags';
import {
  deleteTransaction, prettyDate, searchTransactions, shiftDate, todayStr,
} from './transactions';

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];
const PERIODS = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
];
const METHODS = [
  { key: null, label: 'Any' },
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
];
const PAGE = 100;
const fmt = (n) => '₹' + Math.round(n * 100) / 100;

function Chips({ options, value, onChange }) {
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Pressable
          key={String(o.key)}
          style={[s.chip, value === o.key && s.chipOn]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[s.chipText, value === o.key && s.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TransactionsScreen({ onBack }) {
  const [text, setText] = useState('');
  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('all');
  const [categoryId, setCategoryId] = useState(null);
  const [method, setMethod] = useState(null);
  const [tag, setTag] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const [cats, setCats] = useState([]);
  const [tags, setTags] = useState([]);
  const [startDay, setStartDay] = useState(1);
  const [result, setResult] = useState({ rows: [], n: 0, spent: 0, income: 0 });
  const [tagMap, setTagMap] = useState({});

  useEffect(() => {
    (async () => {
      setCats(await getEveryCategory());
      setTags((await getAllTags()).map((t) => t.name));
      const v = parseInt(await getSetting('month_start_day', '1'), 10);
      setStartDay(v >= 1 && v <= 28 ? v : 1);
    })();
  }, []);

  useEffect(() => { setLimit(PAGE); }, [text, type, period, categoryId, method, tag]);

  const load = useCallback(async () => {
    let from = null;
    let to = null;
    const today = todayStr();
    if (period === '7d') from = shiftDate(today, -6);
    if (period === '30d') from = shiftDate(today, -29);
    if (period === 'month') {
      const r = periodRange('month', today, startDay);
      from = r.start;
      to = r.end;
    }
    setResult(
      await searchTransactions({ type, text, categoryId, method, tag, from, to }, limit)
    );
    setTagMap(await getTagMap());
  }, [type, text, period, categoryId, method, tag, startDay, limit]);
  useEffect(() => { load(); }, [load]);

  const activeCount = [period !== 'all', categoryId, method, tag].filter(Boolean).length;
  const anyFilter = activeCount > 0 || type !== 'all' || text.trim() !== '';

  const clearAll = () => {
    setText('');
    setType('all');
    setPeriod('all');
    setCategoryId(null);
    setMethod(null);
    setTag(null);
  };

  const remove = (t) =>
    Alert.alert('Delete this entry?', `${t.name || t.category_name} ${fmt(t.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteTransaction(t.id); load(); },
      },
    ]);

  const { rows } = result;
  const groups = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.date) last.items.push(r);
    else groups.push({ date: r.date, items: [r] });
  }

  const catOptions = [
    { key: null, label: 'Any' },
    ...cats.map((c) => ({ key: c.id, label: `${c.icon || ''} ${c.name}`.trim() })),
  ];
  const tagOptions = [
    { key: null, label: 'Any' },
    ...tags.map((n) => ({ key: n, label: `#${n}` })),
  ];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {onBack && (
        <Pressable onPress={onBack}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={s.title}>All transactions</Text>

      <TextInput
        style={s.search}
        placeholder="Search name, category, tag or amount"
        value={text}
        onChangeText={setText}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={s.tabs}>
        {TYPES.map((f) => (
          <Pressable
            key={f.key}
            style={[s.tab, type === f.key && s.tabOn]}
            onPress={() => setType(f.key)}
          >
            <Text style={[s.tabText, type === f.key && s.tabTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.filterBar}>
        <Pressable onPress={() => setShowFilters(!showFilters)}>
          <Text style={s.link}>
            Filters {showFilters ? '▴' : '▾'}{activeCount > 0 ? ` (${activeCount})` : ''}
          </Text>
        </Pressable>
        {anyFilter && (
          <Pressable onPress={clearAll}>
            <Text style={[s.link, { color: '#c0392b' }]}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {showFilters && (
        <View style={s.panel}>
          <Text style={s.label}>Period</Text>
          <Chips options={PERIODS} value={period} onChange={setPeriod} />
          <Text style={s.label}>Category</Text>
          <Chips options={catOptions} value={categoryId} onChange={setCategoryId} />
          <Text style={s.label}>Paid with</Text>
          <Chips options={METHODS} value={method} onChange={setMethod} />
          {tags.length > 0 && (
            <>
              <Text style={s.label}>Tag</Text>
              <Chips options={tagOptions} value={tag} onChange={setTag} />
            </>
          )}
        </View>
      )}

      <Text style={s.summary}>
        {result.n} result{result.n === 1 ? '' : 's'} · Spent {fmt(result.spent)} · Income {fmt(result.income)}
      </Text>

      {rows.length === 0 && <Text style={s.empty}>No transactions match.</Text>}

      {groups.map((g) => {
        const spent = g.items
          .filter((r) => r.type === 'expense')
          .reduce((a, r) => a + r.amount, 0);
        return (
          <View key={g.date}>
            <View style={s.dayHead}>
              <Text style={s.dayTitle}>{prettyDate(g.date)}</Text>
              {spent > 0 && <Text style={s.daySpent}>Spent {fmt(spent)}</Text>}
            </View>
            {g.items.map((t) => (
              <View key={t.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowMain}>{t.name || t.category_name}</Text>
                  <Text style={s.rowSub}>
                    {t.category_icon} {t.category_name} · {t.payment_method.toUpperCase()}
                  </Text>
                  {tagMap[t.id] && (
                    <Text style={s.rowTags}>
                      {tagMap[t.id].map((n) => `#${n}`).join('  ')}
                    </Text>
                  )}
                </View>
                <Text style={[s.rowAmt, t.type === 'income' && { color: '#15803d' }]}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </Text>
                <Pressable onPress={() => remove(t)}>
                  <Text style={s.del}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}

      {rows.length === limit && result.n > limit && (
        <Pressable style={s.more} onPress={() => setLimit(limit + PAGE)}>
          <Text style={s.moreText}>Show more</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  search: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 10,
    paddingHorizontal: 12, height: 44, fontSize: 16, marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#222' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  filterBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  panel: {
    backgroundColor: '#f7f7f8', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  label: { fontSize: 12, color: '#666', marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  chipOn: { backgroundColor: '#222' },
  chipText: { color: '#222', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  summary: { color: '#444', fontSize: 13, marginTop: 6, marginBottom: 2 },
  empty: { color: '#888', paddingVertical: 20 },
  dayHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 14, borderRadius: 6,
  },
  dayTitle: { fontWeight: '700', color: '#333' },
  daySpent: { color: '#666', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#eee',
  },
  rowMain: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rowTags: { fontSize: 12, color: '#2563eb', marginTop: 2 },
  rowAmt: { fontSize: 16, fontWeight: '700' },
  del: { color: '#c0392b', fontWeight: '600', fontSize: 13, marginLeft: 12 },
  more: {
    marginTop: 16, padding: 12, alignItems: 'center',
    backgroundColor: '#eee', borderRadius: 8,
  },
  moreText: { fontWeight: '600', color: '#222' },
});