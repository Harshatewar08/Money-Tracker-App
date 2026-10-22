import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  addDebt, addPayment, deleteDebt, deletePayment, getDebts, getPayments,
} from './debts';
import { prettyDate, shiftDate, todayStr } from './transactions';

const fmt = (n) => '₹' + Math.round(n * 100) / 100;
const isOpen = (d) => d.remaining > 0.005;

export default function DebtsScreen() {
  const [debts, setDebts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [direction, setDirection] = useState('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());

  const load = useCallback(async () => setDebts(await getDebts()), []);
  useEffect(() => { load(); }, [load]);

  const open = debts.find((d) => d.id === openId);
  if (open) {
    return (
      <DebtDetail
        debt={open}
        onBack={() => { setOpenId(null); load(); }}
        onChanged={load}
      />
    );
  }

  const create = async () => {
    const p = person.trim();
    const v = parseFloat(amount);
    if (!p) {
      Alert.alert('Enter the person’s name');
      return;
    }
    if (!v || v <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    await addDebt({ person: p, direction, amount: v, date, note: note.trim() });
    setPerson('');
    setAmount('');
    setNote('');
    load();
  };

  const toGet = debts
    .filter((d) => d.direction === 'lent' && isOpen(d))
    .reduce((a, d) => a + d.remaining, 0);
  const toPay = debts
    .filter((d) => d.direction === 'borrowed' && isOpen(d))
    .reduce((a, d) => a + d.remaining, 0);
  const openList = debts.filter(isOpen);
  const settled = debts.filter((d) => !isOpen(d));

  const renderRow = (d, dim) => (
    <Pressable key={d.id} style={[s.row, dim && { opacity: 0.5 }]} onPress={() => setOpenId(d.id)}>
      <Text style={s.rowIcon}>{d.direction === 'lent' ? '↗️' : '↙️'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName}>{d.person}</Text>
        <Text style={s.rowSub}>
          {d.direction === 'lent' ? 'owes you' : 'you owe'} · {prettyDate(d.date)}
          {d.note ? ` · ${d.note}` : ''}
        </Text>
      </View>
      <Text style={s.rowAmt}>{dim ? fmt(d.amount) : fmt(d.remaining)}</Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Debts</Text>

      <View style={s.cards}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>You’ll get</Text>
          <Text style={[s.cardValue, { color: '#15803d' }]}>{fmt(toGet)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>You owe</Text>
          <Text style={[s.cardValue, { color: '#c0392b' }]}>{fmt(toPay)}</Text>
        </View>
      </View>

      {openList.length === 0 && <Text style={s.empty}>Nothing pending.</Text>}
      {openList.map((d) => renderRow(d, false))}

      <Text style={s.sectionTitle}>New entry</Text>
      <View style={s.tabs}>
        {[
          { key: 'lent', label: 'I lent' },
          { key: 'borrowed', label: 'I borrowed' },
        ].map((t) => (
          <Pressable
            key={t.key}
            style={[s.tab, direction === t.key && s.tabOn]}
            onPress={() => setDirection(t.key)}
          >
            <Text style={[s.tabText, direction === t.key && s.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={s.input}
        placeholder={direction === 'lent' ? 'Lent to (name)' : 'Borrowed from (name)'}
        value={person}
        onChangeText={setPerson}
      />
      <TextInput
        style={s.amount}
        placeholder="₹ 0"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput
        style={s.input}
        placeholder="Note (optional)"
        value={note}
        onChangeText={setNote}
      />

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

      <Pressable style={s.save} onPress={create}>
        <Text style={s.saveText}>Save</Text>
      </Pressable>
      <Text style={s.help}>
        Debts are tracked separately and do not change your current balance.
      </Text>

      {settled.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Settled</Text>
          {settled.map((d) => renderRow(d, true))}
        </>
      )}
    </ScrollView>
  );
}

function DebtDetail({ debt, onBack, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const lent = debt.direction === 'lent';

  const loadPayments = useCallback(
    async () => setPayments(await getPayments(debt.id)),
    [debt.id]
  );
  useEffect(() => { loadPayments(); }, [loadPayments]);

  const submit = async () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (v > debt.remaining + 0.005) {
      Alert.alert('Too much', `Only ${fmt(debt.remaining)} is remaining.`);
      return;
    }
    await addPayment({ debtId: debt.id, amount: v, date });
    setAmount('');
    loadPayments();
    onChanged();
  };

  const removePayment = (p) =>
    Alert.alert('Delete this payment?', fmt(p.amount), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deletePayment(p.id);
          loadPayments();
          onChanged();
        },
      },
    ]);

  const removeDebt = () =>
    Alert.alert('Delete this whole entry?', `${debt.person} ${fmt(debt.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteDebt(debt.id);
          onBack();
        },
      },
    ]);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack}>
        <Text style={s.link}>‹ All debts</Text>
      </Pressable>
      <Text style={s.title}>{debt.person}</Text>
      <Text style={s.help}>
        {lent ? 'Owes you' : 'You owe'} · {prettyDate(debt.date)}
        {debt.note ? ` · ${debt.note}` : ''}
      </Text>

      <View style={s.cards}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Original</Text>
          <Text style={s.cardValueSm}>{fmt(debt.amount)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>{lent ? 'Received' : 'Paid'}</Text>
          <Text style={s.cardValueSm}>{fmt(debt.paid)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Remaining</Text>
          <Text style={[s.cardValueSm, { color: lent ? '#15803d' : '#c0392b' }]}>
            {fmt(debt.remaining)}
          </Text>
        </View>
      </View>

      {isOpen(debt) && (
        <>
          <Text style={s.sectionTitle}>{lent ? 'Money received back' : 'Money paid back'}</Text>
          <TextInput
            style={s.amount}
            placeholder="₹ 0"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
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
          <Pressable style={s.save} onPress={submit}>
            <Text style={s.saveText}>{lent ? 'Received' : 'Paid'}</Text>
          </Pressable>
        </>
      )}

      <Text style={s.sectionTitle}>Payment history</Text>
      {payments.length === 0 && <Text style={s.empty}>No payments yet.</Text>}
      {payments.map((p) => (
        <View key={p.id} style={s.payRow}>
          <Text style={{ flex: 1 }}>{prettyDate(p.date)}</Text>
          <Text style={s.rowAmt}>{fmt(p.amount)}</Text>
          <Pressable onPress={() => removePayment(p)}>
            <Text style={[s.link, { color: '#c0392b', marginLeft: 12 }]}>Delete</Text>
          </Pressable>
        </View>
      ))}

      <Pressable style={s.deleteBtn} onPress={removeDebt}>
        <Text style={s.deleteText}>Delete this entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  cards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12 },
  cardLabel: { color: '#666', fontSize: 12 },
  cardValue: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  cardValueSm: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  help: { color: '#666', fontSize: 12, marginVertical: 6 },
  empty: { color: '#888', paddingVertical: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderColor: '#eee',
  },
  rowIcon: { fontSize: 20, marginRight: 10 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rowAmt: { fontSize: 16, fontWeight: '700' },
  chev: { fontSize: 22, color: '#999', marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#222' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 10, height: 44, fontSize: 16, marginBottom: 10,
  },
  amount: {
    fontSize: 32, fontWeight: '700', borderBottomWidth: 2,
    borderColor: '#222', paddingVertical: 6, marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  arrow: { fontSize: 34, paddingHorizontal: 14, color: '#222' },
  dateText: { fontSize: 16, fontWeight: '700' },
  save: {
    backgroundColor: '#15803d', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 10,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#eee',
  },
  deleteBtn: {
    marginTop: 30, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#c0392b', borderRadius: 8,
  },
  deleteText: { color: '#c0392b', fontWeight: '600' },
});