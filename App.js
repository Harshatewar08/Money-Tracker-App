import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AddScreen from './AddScreen';
import AnalysisScreen from './AnalysisScreen';
import CategoriesScreen from './CategoriesScreen';
import DebtsScreen from './DebtsScreen';
import SavingsScreen from './SavingsScreen';
import SettingsScreen from './SettingsScreen';
import TransactionsScreen from './TransactionsScreen';

const TABS = [
  { key: 'add', label: 'Home', icon: '🏠' },
  { key: 'analysis', label: 'Analysis', icon: '📊' },
  { key: 'savings', label: 'Savings', icon: '💰' },
  { key: 'debts', label: 'Debts', icon: '🤝' },
];

export default function App() {
  const [active, setActive] = useState('add');

  const renderScreen = () => {
    switch (active) {
      case 'analysis':
        return <AnalysisScreen />;
      case 'savings':
        return <SavingsScreen />;
      case 'debts':
        return <DebtsScreen />;
      case 'transactions':
        return <TransactionsScreen onBack={() => setActive('add')} />;
      case 'categories':
        return <CategoriesScreen onBack={() => setActive('add')} />;
      case 'settings':
        return <SettingsScreen onBack={() => setActive('add')} />;
      default:
        return (
          <AddScreen
            onManageCategories={() => setActive('categories')}
            onOpenTransactions={() => setActive('transactions')}
            onOpenSettings={() => setActive('settings')}
          />
        );
    }
  };

  return (
    <View style={s.container}>
      <View style={s.screen}>{renderScreen()}</View>
      <View style={s.bar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={s.tab} onPress={() => setActive(t.key)}>
            <Text style={s.icon}>{t.icon}</Text>
            <Text style={[s.label, active === t.key && s.labelOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: '#fafafa',
  },
  tab: { flex: 1, alignItems: 'center' },
  icon: { fontSize: 20 },
  label: { fontSize: 12, color: '#888', marginTop: 2 },
  labelOn: { color: '#222', fontWeight: '700' },
});