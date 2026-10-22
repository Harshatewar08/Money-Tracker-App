import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSetting, setSetting } from './balance';
import {
  getDailySpend, getMonthlyTotals, getSummary, listDates,
  periodLabel, periodRange, shiftPeriod,
} from './analysis';
import { prettyDate, todayStr } from './transactions';

const MODES = [
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const fmt = (n) => (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n * 100) / 100);

function BarChart({ labels, series, colors, height = 130 }) {
  const max = Math.max(1, ...series.flat());
  return (
    <View>
      <Text style={c.maxText}>Highest: {fmt(max === 1 ? 0 : max)}</Text>
      <View style={[c.bars, { height }]}>
        {labels.map((l, i) => (
          <View key={i} style={c.group}>
            {series.map((ser, k) => (
              <View
                key={k}
                style={[
                  c.bar,
                  {
                    height: ser[i] > 0 ? Math.max(2, (ser[i] / max) * height) : 0,
                    backgroundColor: colors[k],
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={c.labelRow}>
        {labels.map((l, i) => (
          <Text key={i} style={c.label}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

function Heatmap({ dates, daily, selected, onSelect }) {
  const [y, m, d] = dates[0].split('-').map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday first
  const cells = [...Array(offset).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const max = Math.max(0, ...dates.map((dt) => daily[dt] || 0));

  return (
    <View>
      <View style={h.row}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={h.head}>{l}</Text>
        ))}
      </View>
      {weeks.map((w, wi) => (
        <View key={wi} style={h.row}>
          {w.map((dt, i) => {
            if (!dt) return <View key={i} style={h.cell} />;
            const v = daily[dt] || 0;
            const t = max > 0 ? v / max : 0;
            const bg = v > 0 ? `rgba(37,99,235,${0.18 + 0.82 * t})` : '#f1f2f4';
            return (
              <Pressable
                key={i}
                style={[h.cell, { backgroundColor: bg }, selected === dt && h.sel]}
                onPress={() => onSelect(dt)}
              >
                <Text style={[h.num, t > 0.55 && { color: '#fff' }]}>
                  {Number(dt.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function AnalysisScreen() {
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(todayStr());
  const [startDay, setStartDay] = useState(1);
  const [data, setData] = useState({ spent: 0, income: 0, saved: 0, cats: [] });
  const [daily, setDaily] = useState({});
  const [monthly, setMonthly] = useState({
    spent: Array(12).fill(0), saved: Array(12).fill(0),
  });
  const [selDay, setSelDay] = useState(null);

  useEffect(() => {
    (async () => {
      const v = parseInt(await getSetting('month_start_day', '1'), 10);
      setStartDay(v >= 1 && v <= 28 ? v : 1);
    })();
  }, []);

  const { start, end } = periodRange(mode, anchor, startDay);

  useEffect(() => {
    (async () => setData(await getSummary(start, end)))();
  }, [start, end]);

  useEffect(() => {
    setSelDay(null);
    (async () => {
      if (mode === 'month') setDaily(await getDailySpend(start, end));
      if (mode === 'year') setMonthly(await getMonthlyTotals(start.slice(0, 4)));
    })();
  }, [mode, start, end]);

  const isCurrent = periodRange(mode, todayStr(), startDay).start === start;

  const changeStartDay = async (delta) => {
    const n = Math.min(28, Math.max(1, startDay + delta));
    setStartDay(n);
    await setSetting('month_start_day', n);
  };

  const outflow = data.spent + data.saved;
  const left = data.income - outflow;

  const rows = data.cats.map((cat) => ({
    key: cat.name, icon: cat.icon, name: cat.name, total: cat.total, color: '#4b5563',
  }));
  if (data.saved > 0) {
    rows.push({
      key: '__savings', icon: '💰', name: 'Savings', total: data.saved, color: '#2563eb',
    });
  }
  rows.sort((a, b) => b.total - a.total);

  const dates = mode === 'month' ? listDates(start, end) : [];
  const dayLabels = dates.map((dt) => {
    const n = Number(dt.slice(8));
    return n === 1 || n % 5 === 0 ? String(n) : '';
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Analysis</Text>

      <View style={s.tabs}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            style={[s.tab, mode === m.key && s.tabOn]}
            onPress={() => { setMode(m.key); setAnchor(todayStr()); }}
          >
            <Text style={[s.tabText, mode === m.key && s.tabTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.navRow}>
        <Pressable onPress={() => setAnchor(shiftPeriod(mode, anchor, startDay, -1))}>
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setAnchor(todayStr())} style={{ alignItems: 'center' }}>
          <Text style={s.periodText}>{periodLabel(mode, anchor, startDay)}</Text>
          {!isCurrent && <Text style={s.link}>Jump to current</Text>}
        </Pressable>
        <Pressable onPress={() => setAnchor(shiftPeriod(mode, anchor, startDay, 1))}>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={s.bigCard}>
        <Text style={s.cardLabel}>Total outflow (spent + saved)</Text>
        <Text style={s.bigValue}>{fmt(outflow)}</Text>
      </View>

      <View style={s.cards}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Spent</Text>
          <Text style={s.cardValue}>{fmt(data.spent)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Saved</Text>
          <Text style={[s.cardValue, { color: '#2563eb' }]}>{fmt(data.saved)}</Text>
        </View>
      </View>
      <View style={s.cards}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Income</Text>
          <Text style={[s.cardValue, { color: '#15803d' }]}>{fmt(data.income)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.cardLabel}>Left over</Text>
          <Text style={[s.cardValue, { color: left < 0 ? '#c0392b' : '#222' }]}>
            {fmt(left)}
          </Text>
        </View>
      </View>

      {mode === 'month' && dates.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Daily spending</Text>
          <BarChart
            labels={dayLabels}
            series={[dates.map((dt) => daily[dt] || 0)]}
            colors={['#4b5563']}
          />

          <Text style={s.sectionTitle}>Calendar</Text>
          <Heatmap dates={dates} daily={daily} selected={selDay} onSelect={setSelDay} />
          <Text style={s.selText}>
            {selDay
              ? `${prettyDate(selDay)}: ${fmt(daily[selDay] || 0)} spent`
              : 'Tap a day to see how much you spent. Darker means more.'}
          </Text>
        </>
      )}

      {mode === 'year' && (
        <>
          <Text style={s.sectionTitle}>Month by month</Text>
          <BarChart
            labels={MONTH_LETTERS}
            series={[monthly.spent, monthly.saved]}
            colors={['#4b5563', '#2563eb']}
          />
          <View style={s.legend}>
            <View style={[s.dot, { backgroundColor: '#4b5563' }]} />
            <Text style={s.legendText}>Spent</Text>
            <View style={[s.dot, { backgroundColor: '#2563eb', marginLeft: 14 }]} />
            <Text style={s.legendText}>Saved</Text>
          </View>
        </>
      )}

      <Text style={s.sectionTitle}>Where it went</Text>
      {rows.length === 0 && <Text style={s.empty}>Nothing in this period.</Text>}
      {rows.map((r) => {
        const pct = outflow > 0 ? (r.total / outflow) * 100 : 0;
        return (
          <View key={r.key} style={s.catRow}>
            <View style={s.catTop}>
              <Text style={s.catName}>{r.icon} {r.name}</Text>
              <Text style={s.catAmt}>{fmt(r.total)}</Text>
              <Text style={s.catPct}>{Math.round(pct)}%</Text>
            </View>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${pct}%`, backgroundColor: r.color }]} />
            </View>
          </View>
        );
      })}

      <Text style={s.sectionTitle}>Month starts on day</Text>
      <Text style={s.help}>
        Set this to your salary day, and "Month" will run from that day to the day before it next month.
      </Text>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => changeStartDay(-1)}>
          <Text style={s.stepText}>−</Text>
        </Pressable>
        <Text style={s.stepValue}>{startDay}</Text>
        <Pressable style={s.stepBtn} onPress={() => changeStartDay(1)}>
          <Text style={s.stepText}>+</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const c = StyleSheet.create({
  maxText: { fontSize: 11, color: '#888', marginBottom: 4 },
  bars: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderBottomWidth: 1, borderColor: '#ddd',
  },
  group: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: 1,
  },
  bar: { flex: 1, maxWidth: 12, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  labelRow: { flexDirection: 'row', marginTop: 4 },
  label: { flex: 1, textAlign: 'center', fontSize: 9, color: '#888' },
});

const h = StyleSheet.create({
  row: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 2 },
  cell: {
    flex: 1, aspectRatio: 1, margin: 2, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  sel: { borderWidth: 2, borderColor: '#222' },
  num: { fontSize: 11, color: '#333' },
});

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 12 },
  link: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#222' },
  tabText: { color: '#222', fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  navRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginVertical: 8,
  },
  arrow: { fontSize: 34, paddingHorizontal: 14, color: '#222' },
  periodText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  bigCard: {
    backgroundColor: '#eef2ff', borderRadius: 16, padding: 16, marginBottom: 10,
  },
  bigValue: { fontSize: 34, fontWeight: '800', color: '#1e3a8a', marginTop: 2 },
  cards: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12 },
  cardLabel: { color: '#666', fontSize: 12 },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  selText: { color: '#444', fontSize: 13, marginTop: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: '#555' },
  empty: { color: '#888', paddingVertical: 10 },
  catRow: { marginBottom: 12 },
  catTop: { flexDirection: 'row', alignItems: 'center' },
  catName: { flex: 1, fontSize: 15, fontWeight: '600' },
  catAmt: { fontSize: 15, fontWeight: '700' },
  catPct: { width: 44, textAlign: 'right', color: '#666', fontSize: 13 },
  barBg: { height: 8, backgroundColor: '#eee', borderRadius: 4, marginTop: 6 },
  barFill: { height: 8, borderRadius: 4 },
  help: { color: '#666', fontSize: 12, marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  stepValue: { fontSize: 22, fontWeight: '700', minWidth: 30, textAlign: 'center' },
});