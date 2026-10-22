import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { exportBackup, exportCsv, restoreBackup } from './backup';
import { getSetting } from './balance';

export default function SettingsScreen({ onBack }) {
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState('');

  const loadLast = async () => setLastBackup(await getSetting('last_backup', ''));
  useEffect(() => { loadLast(); }, []);

  const run = async (fn, doneMsg) => {
    setBusy(true);
    try {
      const result = await fn();
      if (doneMsg && result !== false) Alert.alert(doneMsg);
    } catch (e) {
      Alert.alert('Something went wrong', String(e.message || e));
    }
    setBusy(false);
    loadLast();
  };

  const confirmRestore = () =>
    Alert.alert(
      'Restore from backup?',
      'This replaces ALL current data in the app with the contents of the backup file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', style: 'destructive',
          onPress: () => run(restoreBackup, 'Restored. Open the Home tab to see your data.'),
        },
      ]
    );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {onBack && (
        <Pressable onPress={onBack}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>
      )}
      <Text style={s.title}>Settings</Text>

      <Text style={s.section}>Export</Text>
      <Text style={s.help}>
        A spreadsheet of all your transactions, for Excel or Google Sheets.
      </Text>
      <Pressable style={[s.btn, busy && s.off]} disabled={busy} onPress={() => run(exportCsv)}>
        <Text style={s.btnText}>⬇️  Export transactions (CSV)</Text>
      </Pressable>

      <Text style={s.section}>Backup</Text>
      <Text style={s.help}>
        Your data is stored only on this phone. Make a backup now and then, and send the
        file to Google Drive, WhatsApp or email so you don't lose it.
      </Text>
      <Text style={s.last}>
        {lastBackup ? `Last backup: ${lastBackup}` : 'No backup made yet.'}
      </Text>
      <Pressable style={[s.btn, busy && s.off]} disabled={busy} onPress={() => run(exportBackup)}>
        <Text style={s.btnText}>💾  Backup everything</Text>
      </Pressable>
      <Pressable
        style={[s.btn, s.btnLight, busy && s.off]}
        disabled={busy}
        onPress={confirmRestore}
      >
        <Text style={[s.btnText, { color: '#222' }]}>♻️  Restore from backup</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', marginVertical: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 6 },
  help: { color: '#666', fontSize: 13, marginBottom: 10 },
  last: { color: '#444', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  btn: {
    backgroundColor: '#222', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10,
  },
  btnLight: { backgroundColor: '#eee' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  off: { opacity: 0.5 },
});