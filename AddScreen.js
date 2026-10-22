import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { getCurrentBalance } from './balance';
import { getCategories } from './categories';
import { cleanTag, getAllTags, getTagsForDay } from './tags';
import {
  addTransaction, deleteTransaction, findLastByName, getTransactionsByDate,
  parseQuick, prettyDate, shiftDate, todayStr,
} from './transactions';

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
];

const fmt = (n) => '₹' + Math.round(n * 100) / 100;
const fmtSigned = (n) => (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n * 100) / 100);

export default function AddScreen({ onManageCategories, onOpenTransactions, onOpenSettings }) {
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState('expense');
  const [cats, setCats] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [method, setMethod] = useState('upi');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [quick, setQuick] = useState('');
  const [hint, setHint] = useState('');
  const [rows, setRows] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [tagOptions, setTagOptions] = useState([]);
  const [selTags, setSelTags] = useState([]);
  const [tagText, setTagText] = useState('');
  const [balance, setBalance] = useState(0);
  const pendingCat = useRef(null);

  const loadBalance = useCallback(async () => setBalance(await getCurrentBalance()), []);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  useEffect(() => {
    (async () => {
      const list = await getCategories(type);
      setCats(list);
      const want = pendingCat.current;
      pendingCat.current = null;
      setCategoryId(
        want && list.some((c) => c.id === want)
          ? want
          : list.length ? list[0].id : null
      );
    })();
  }, [type]);

  const loadTags = useCallback(async () => {
    const all = await getAllTags();
    setTagOptions((prev) => {
      const names = all.map((t) => t.name);
      const extra = prev.filter((n) => !names.includes(n));
      return [...names, ...extra];
    });
  }, []);
  useEffect(() => { loadTags(); }, [loadTags]);

  const loadRows = useCallback(async () => {
    setRows(await getTransactionsByDate(date));
    setTagMap(await getTagsForDay(date));
  }, [date]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const toggleTag = (n) =>
    setSelTags((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  const addTag = () => {
    const n = cleanTag(tagText);
    if (!n) return;
    setTagOptions((cur) => (cur.includes(n) ? cur : [...cur, n]));
    setSelTags((cur) => (cur.includes(n) ? cur : [...cur, n]));
    setTagText('');
  };

  const applyQuick = async () => {
    const p = parseQuick(quick);
    if (!p) {
      Alert.alert('Type a name and an amount', 'Example: chai 20 #trip');
      return;
    }
    setAmount(String(p.amount));
    setName(p.name);
    setHint('');
    if (p.tags.length) {
      setTagOptions((cur) => [...cur, ...p.tags.filter((t) => !cur.includes(t))]);
      setSelTags((cur) => [...cur, ...p.tags.filter((t) => !cur.includes(t))]);
    }
    const m = p.name ? await findLastByName(p.name) : null;
    if (m) {
      setMethod(m.payment_method);
      if (m.type === type) {
        setCategoryId(m.category_id);
      } else {
        pendingCat.current = m.category_id;
        setType(m.type);
      }
      setHint('Form filled from your last entry with this name. Scroll up, check, then Save.');
    } else if (p.name) {
      setHint('Form filled. New name, so pick a category above, then Save.');
    } else {
      setHint('Amount filled. Scroll up to finish, then Save.');
    }
    setQuick('');
  };

  const save = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (!categoryId) {
      Alert.alert('Pick a category');
      return;
    }
    await addTransaction({
      amount: value, type, categoryId, paymentMethod: method,
      date, name: name.trim(), tags: selTags,
    });
    setAmount('');
    setName('');
    setHint('');
    loadRows();
    loadTags();
    loadBalance();
  };

  const remove = (t) =>
    Alert.alert('Delete this entry?', `${t.name || t.category_name} ${fmt(t.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteTransaction(t.id);
          loadRows();
          loadBalance();
        },
      },
    ]);

  const spent = rows.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const earned = rows.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <Text style={s.title}>Home</Text>
        <View style={s.headerRight}>
          {onOpenTransactions && (
            <Pressable style={s.histBtn} onPress={onOpenTransactions}>
              <Text style={s.histIcon}>📋</Text>
              <Text style={s.histText}>All</Text>
            </Pressable>
          )}
          <View style={s.balanceBox}>
            <Text style={s.balanceLabel}>Current balance</Text>
            <Text style={[s.balanceValue, balance < 0 && { color: '#c0392b' }]}>
              {fmtSigned(balance)}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.dateRow}>
        <Pressable onPress={() => setDate(shiftDate(date, -1))}>
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(todayStr())} style={{ alignItems: 'center' }}>
          <Text style={s.dateText}>{prettyDate(date)}</Text>
          {date !== todayStr() && <Text style={s.link}>Jump to today</Text>}
        </Pressable>
        <Pressable onPress={() => setDate(shiftDate(date, 1))}>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        {['expense', 'income'].map((t) => (
          <Pressable
            key={t}
            style={[s.tab, type === t && s.tabOn]}
            onPress={() => setType(t)}
          >
            <Text style={[s.tabText, type === t && s.tabTextOn]}>
              {t === 'expense' ? 'Expense' : 'Income'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={s.amount}
        placeholder="₹ 0"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <TextInput
        style={s.nameInput}
        placeholder="Name (e.g. Chai, Auto to office)"
        value={name}
        onChangeText={setName}
      />

      <View style={s.labelRow}>
        <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>Category</Text>
        {onManageCategories && (
          <Pressable onPress={onManageCategories}>
            <Text style={s.link}>Manage categories</Text>
          </Pressable>
        )}
      </View>
      <View style={s.chips}>
        {cats.map((c) => (
          <Pressable
            key={c.id}
            style={[s.chip, categoryId === c.id && s.chipOn]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={[s.chipText, categoryId === c.id && s.chipTextOn]}>
              {c.icon} {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Paid with</Text>
      <View style={s.chips}>
        {METHODS.map((m) => (
          <Pressable
            key={m.key}
            style={[s.chip, method === m.key && s.chipOn]}
            onPress={() => setMethod(m.key)}
          >
            <Text style={[s.chipText, method === m.key && s.chipTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Tags (optional)</Text>
      <View style={s.chips}>
        {tagOptions.map((n) => (
          <Pressable
            key={n}
            style={[s.chip, selTags.includes(n) && s.chipTag]}
            onPress={() => toggleTag(n)}
          >
            <Text style={[s.chipText, selTags.includes(n) && s.chipTextOn]}>#{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.quickRow, { marginTop: 8 }]}>
        <TextInput
          style={[s.nameInput, { flex: 1 }]}
          placeholder="New tag (e.g. trip)"
          value={tagText}
          onChangeText={setTagText}
          onSubmitEditing={addTag}
          returnKeyType="done"
        />
        <Pressable style={s.quickBtn} onPress={addTag}>
          <Text style={s.quickBtnText}>+</Text>
        </Pressable>
      </View>

      <Pressable style={s.save} onPress={save}>
        <Text style={s.saveText}>Save</Text>
      </Pressable>

      <Text style={[s.label, { marginTop: 22 }]}>Quick add</Text>
      <View style={s.quickRow}>
        <TextInput
          style={s.quickInput}
          placeholder="chai 20 #trip"
          value={quick}
          onChangeText={setQuick}
          onSubmitEditing={applyQuick}
          returnKeyType="done"
        />
        <Pressable style={s.quickBtn} onPress={applyQuick}>
          <Text style={s.quickBtnText}>Fill</Text>
        </Pressable>
      </View>
      {hint !== '' && <Text style={s.hint}>{hint}</Text>}

      <View style={s.divider} />
      <Text style={s.sectionTitle}>This day</Text>
      <Text style={s.totals}>
        Spent {fmt(spent)}   ·   Income {fmt(earned)}
      </Text>

      {rows.length === 0 && <Text style={s.empty}>No entries yet.</Text>}
      {rows.map((t) => (
        <View key={t.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowMain}>{t.name || t.category_name}</Text>
            <Text style={s.rowSub}>
              {t.category_icon} {t.category_name} · {t.payment_method.toUpperCase()}
            </Text>
            {tagMap[t.id] && (
              <Text style={s.rowTags}>{tagMap[t.id].map((n) => `#${n}`).join('  ')}</Text>
            )}
          </View>
          <Text style={[s.rowAmt, t.type === 'income' && { color: '#15803d' }]}>
            {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
          </Text>
          <Pressable onPress={() => remove(t)}>
            <Text style={[s.link, { color: '#c0392b', marginLeft: 12 }]}>Delete</Text>
          </Pressable>
        </View>
      ))}
            {onOpenSettings && (
        <Pressable style={s.settingsLink} onPress={onOpenSettings}>
          <Text style={s.link}>⚙️ Settings, backup and export</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '700' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histBtn: {
    backgroundColor: '#eef2ff', borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center',
  },
  histIcon: { fontSize: 18 },
  histText: { fontSize: 11, color: '#1e3a8a', fontWeight: '700', marginTop: 1 },
  balanceBox: {
    backgroundColor: '#eef2ff', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end',
  },
  balanceLabel: { fontSize: 11, color: '#555' },
  balanceValue: { fontSize: 26, fontWeight: '800', color: '#1e3a8a', marginTop: 1 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  arrow: { fontSize: 34, paddingHorizontal: 14, color: '#222' },
  dateText: { fontSize: 18, fontWeight: '700' },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickInput: {
    flex: 1, borderWidth: 1, borderColor: '#2563eb', borderRadius: 8,
    paddingHorizontal: 10, height: 44, fontSize: 16, backgroundColor: '#f5f8ff',
  },
  quickBtn: {
    backgroundColor: '#2563eb', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  quickBtnText: { color: '#fff', fontWeight: '700' },
  hint: { color: '#2563eb', fontSize: 12, marginTop: 6 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#222' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  amount: {
    fontSize: 32, fontWeight: '700', borderBottomWidth: 2,
    borderColor: '#222', paddingVertical: 6, marginBottom: 12,
  },
  nameInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 10, height: 44, fontSize: 16,
  },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 6 },
    labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 12, marginBottom: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#eee',
  },
  chipOn: { backgroundColor: '#222' },
  chipTag: { backgroundColor: '#2563eb' },
  chipText: { color: '#222' },
  chipTextOn: { color: '#fff' },
  save: {
    backgroundColor: '#15803d', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 18,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  totals: { color: '#444', marginTop: 4, marginBottom: 8 },
  empty: { color: '#888', paddingVertical: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#eee',
  },
  rowMain: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rowTags: { fontSize: 12, color: '#2563eb', marginTop: 2 },
  rowAmt: { fontSize: 16, fontWeight: '700' },
  settingsLink: { marginTop: 24, alignItems: 'center', paddingVertical: 10 },
});