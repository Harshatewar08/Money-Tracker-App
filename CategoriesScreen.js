import { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  getCategories, addCategory, updateCategory, deleteCategory,
} from './categories';

export default function CategoriesScreen({ onBack }) {
  const [type, setType] = useState('expense');
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  const load = useCallback(async () => setItems(await getCategories(type)), [type]);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setName(''); setIcon(''); };
  const startEdit = (c) => { setEditing(c); setName(c.name); setIcon(c.icon || ''); };

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      if (editing) await updateCategory(editing.id, n, icon.trim());
      else await addCategory(n, type, icon.trim());
      reset();
      load();
    } catch (e) {
      Alert.alert('Could not save', 'A category with that name already exists.');
    }
  };

  const remove = (c) =>
    Alert.alert(`Delete "${c.name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteCategory(c.id);
          if (editing?.id === c.id) reset();
          load();
        },
      },
    ]);

  return (
    <View style={s.container}>
      {onBack && (
        <Pressable onPress={onBack}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={s.title}>Categories</Text>

      <View style={s.tabs}>
        {['expense', 'income'].map((t) => (
          <Pressable
            key={t}
            style={[s.tab, type === t && s.tabOn]}
            onPress={() => { setType(t); reset(); }}
          >
            <Text style={[s.tabText, type === t && s.tabTextOn]}>
              {t === 'expense' ? 'Expense' : 'Income'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.form}>
        <TextInput
          style={[s.input, { width: 56, textAlign: 'center' }]}
          placeholder="🙂" value={icon} onChangeText={setIcon} maxLength={4}
        />
        <TextInput
          style={[s.input, { flex: 1 }]}
          placeholder={editing ? 'Rename category' : 'New category'}
          value={name} onChangeText={setName}
        />
        <Pressable style={s.btn} onPress={save}>
          <Text style={s.btnText}>{editing ? 'Save' : 'Add'}</Text>
        </Pressable>
        {editing && (
          <Pressable style={[s.btn, s.btnGrey]} onPress={reset}>
            <Text style={s.btnText}>✕</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => (
          <View style={[s.row, editing?.id === item.id && s.rowOn]}>
            <Text style={s.rowText}>{item.icon} {item.name}</Text>
            <Pressable onPress={() => startEdit(item)}>
              <Text style={s.link}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)}>
              <Text style={[s.link, { color: '#c0392b' }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#222' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  form: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 10, height: 44,
  },
  btn: {
    backgroundColor: '#222', borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center',
  },
  btnGrey: { backgroundColor: '#888' },
  btnText: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee',
  },
  rowOn: { backgroundColor: '#f3f3f3' },
  rowText: { flex: 1, fontSize: 16 },
  link: { color: '#2563eb', fontWeight: '600' },
});