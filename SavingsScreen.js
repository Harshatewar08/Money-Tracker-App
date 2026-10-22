import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { getCurrentBalance, getSetting, setSetting } from './balance';
import {
  addAccount, addEntry, deleteEntry, getAccounts, getEntries,
} from './savings';
import { prettyDate, shiftDate, todayStr } from './transactions';

const TYPES = [
  { key: 'rd', label: 'RD', icon: '🏦' },
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'other', label: 'Other', icon: '💼' },
];
const iconOf = (k) => (TYPES.find((t) => t.key === k) || TYPES[2]).icon;
const fmt = (n) => (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n * 100) / 100);

export default function SavingsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [current, setCurrent] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('rd');
  const [opening, setOpening] = useState('');

  const load = useCallback(async () => {
    setAccounts(await getAccounts());
    setCurrent(await getCurrentBalance());
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    (async () => setOpening(await getSetting('opening_balance', '0')))();
  }, []);

  const open = accounts.find((a) => a.id === openId);
  if (open) {
    return (
      <AccountDetail
        account={open}
        current={current}
        onBack={() => { setOpenId(null); load(); }}
        onChanged={load}
      />
    );
  }

  const create = async () => {
    const n = newName.trim();
    if (!n) {
      Alert.alert('Enter an account name');
      return;
    }
    await addAccount(n, newType);
    setNewName('');
    load();
  };

  const saveOpening = async () => {
    const v = parseFloat(opening);
    if (isNaN(v)) {
      Alert.alert('Enter a number');
      return;
    }
    await setSetting('opening_balance', v);
    load();
  };

  const total = accounts.reduce((a, x) => a + x.balance, 0);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Savings & Investments</Text>

      <View style={s.cards}>
        <View style={[s.totalCard, { flex: 1 }]}>
          <Text style={s.totalLabel}>Current balance</Text>
          <Text style={[s.cardValue, current < 0 && { color: '#c0392b' }]}>
            {fmt(current)}
          </Text>
        </View>
        <View style={[s.totalCard, { flex: 1 }]}>
          <Text style={s.totalLabel}>Total saved</Text>
          <Text style={s.cardValue}>{fmt(total)}</Text>
        </View>
      </View>

      {accounts.length === 0 && (
        <Text style={s.empty}>No accounts yet. Add one below.</Text>
      )}
      {accounts.map((a) => (
        <Pressable key={a.id} style={s.row} onPress={() => setOpenId(a.id)}>
          <Text style={s.rowIcon}>{iconOf(a.type)}</Text>
          <Text style={s.rowName}>{a.name}</Text>
          <Text style={s.rowBal}>{fmt(a.balance)}</Text>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ))}

      <Text style={s.sectionTitle}>Add account</Text>
      <View style={s.chips}>
        {TYPES.map((t) => (
          <Pressable
            key={t.key}
            style={[s.chip, newType === t.key && s.chipOn]}
            onPress={() => setNewType(t.key)}
          >
            <Text style={[s.chipText, newType === t.key && s.chipTextOn]}>
              {t.icon} {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.formRow}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="Account name (e.g. Post Office RD)"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={create}
          returnKeyType="done"
        />
        <Pressable style={s.btn} onPress={create}>
          <Text style={s.btnText}>Add</Text>
        </Pressable>
      </View>

      <Text style={s.sectionTitle}>Starting balance</Text>
      <Text style={s.help}>
        The money you had in hand before you started tracking. Your current
        balance is built from this.
      </Text>
      <View style={s.formRow}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder="₹ 0"
          keyboardType="decimal-pad"
          value={opening}
          onChangeText={setOpening}
        />
        <Pressable style={s.btn} onPress={saveOpening}>
          <Text style={s.btnText}>Set</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AccountDetail({ account, current, onBack, onChanged }) {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());

  const loadEntries = useCallback(
    async () => setEntries(await getEntries(account.id)),
    [account.id]
  );
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const submit = async (kind) => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (kind === 'withdrawal' && value > account.balance) {
      Alert.alert('Not enough balance', `Balance is ${fmt(account.balance)}`);
      return;
    }
    await addEntry({
      accountId: account.id, amount: value, kind, date, note: note.trim(),
    });
    setAmount('');
    setNote('');
    loadEntries();
    onChanged();
  };

  const remove = (e) =>
    Alert.alert('Delete this entry?', `${e.kind} ${fmt(e.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteEntry(e.id);
          loadEntries();
          onChanged();
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
        <Text style={s.link}>‹ All accounts</Text>
      </Pressable>
      <Text style={s.title}>{iconOf(account.type)} {account.name}</Text>

      <View style={s.cards}>
        <View style={[s.totalCard, { flex: 1 }]}>
          <Text style={s.totalLabel}>This account</Text>
          <Text style={s.cardValue}>{fmt(account.balance)}</Text>
        </View>
        <View style={[s.totalCard, { flex: 1 }]}>
          <Text style={s.totalLabel}>Current balance</Text>
          <Text style={[s.cardValue, current < 0 && { color: '#c0392b' }]}>
            {fmt(current)}
          </Text>
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

      <View style={[s.formRow, { marginTop: 14 }]}>
        <Pressable style={[s.big, { backgroundColor: '#15803d' }]} onPress={() => submit('deposit')}>
          <Text style={s.btnText}>Deposit</Text>
        </Pressable>
        <Pressable style={[s.big, { backgroundColor: '#b45309' }]} onPress={() => submit('withdrawal')}>
          <Text style={s.btnText}>Withdraw</Text>
        </Pressable>
      </View>
      <Text style={[s.help, { marginTop: 8 }]}>
        Deposit moves money from your current balance into this account.
        Withdraw moves it back.
      </Text>

      <Text style={s.sectionTitle}>History</Text>
      {entries.length === 0 && <Text style={s.empty}>No entries yet.</Text>}
      {entries.map((e) => (
        <View key={e.id} style={s.entryRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.entryMain}>
              {e.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}
              {e.note ? ` · ${e.note}` : ''}
            </Text>
            <Text style={s.entrySub}>{prettyDate(e.date)}</Text>
          </View>
          <Text style={[s.entryAmt, { color: e.kind === 'deposit' ? '#15803d' : '#b45309' }]}>
            {e.kind === 'deposit' ? '+' : '-'}{fmt(e.amount)}
          </Text>
          <Pressable onPress={() => remove(e)}>
            <Text style={[s.link, { color: '#c0392b', marginLeft: 12 }]}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  cards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  totalCard: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14 },
  totalLabel: { color: '#666', fontSize: 13 },
  cardValue: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  help: { color: '#666', fontSize: 12, marginBottom: 8 },
  empty: { color: '#888', paddingVertical: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderColor: '#eee',
  },
  rowIcon: { fontSize: 22, marginRight: 10 },
  rowName: { flex: 1, fontSize: 16, fontWeight: '600' },
  rowBal: { fontSize: 16, fontWeight: '700' },
  chev: { fontSize: 22, color: '#999', marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#eee',
  },
  chipOn: { backgroundColor: '#222' },
  chipText: { color: '#222' },
  chipTextOn: { color: '#fff' },
  formRow: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 10, height: 44, fontSize: 16,
  },
  btn: {
    backgroundColor: '#222', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  big: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  arrow: { fontSize: 34, paddingHorizontal: 14, color: '#222' },
  dateText: { fontSize: 16, fontWeight: '700' },
  amount: {
    fontSize: 32, fontWeight: '700', borderBottomWidth: 2,
    borderColor: '#222', paddingVertical: 6, marginBottom: 12,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#eee',
  },
  entryMain: { fontSize: 15, fontWeight: '600' },
  entrySub: { fontSize: 12, color: '#888', marginTop: 2 },
  entryAmt: { fontSize: 16, fontWeight: '700' },
});