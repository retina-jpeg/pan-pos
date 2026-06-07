import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { db } from '../db';

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#6b7280'];

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm text-center ${onClick ? 'cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>€{value.toFixed(2)}</div>
      {onClick && <div className="text-xs text-gray-400 mt-1">Aufschlüsselung ↓</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo]               = useState(() => new Date().toISOString().slice(0, 10));
  const [locFilter, setLocFilter] = useState('');
  const [stats, setStats]         = useState({ sales: 0, expenses: 0, artikelkosten: 0, profit: 0 });
  const [daily, setDaily]         = useState([]);
  const [byLocation, setByLocation] = useState([]);
  const [locations, setLocations]   = useState([]);
  const [showPie, setShowPie]       = useState(false);
  const [pieData, setPieData]       = useState([]);

  useEffect(() => {
    load();
    window.addEventListener('pos-synced', load);
    return () => window.removeEventListener('pos-synced', load);
  }, [from, to, locFilter]);

  async function load() {
    const locs = (await db.locations.toArray()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setLocations(locs);

    const fromMs = new Date(from).getTime();
    const toMs   = new Date(to + 'T23:59:59').getTime();
    const locId  = locFilter ? parseInt(locFilter) : null;

    const [sales, expenses] = await Promise.all([
      db.sales.filter(s => {
        const t = new Date(s.date).getTime();
        return t >= fromMs && t <= toMs && (!locId || s.locationId === locId);
      }).toArray(),
      db.expenses.filter(e => {
        const t = new Date(e.date).getTime();
        return t >= fromMs && t <= toMs && (!locId || e.locationId === locId);
      }).toArray(),
    ]);

    const saleIds   = sales.map(s => s.id);
    const saleItems = saleIds.length > 0
      ? await db.saleItems.where('saleId').anyOf(saleIds).toArray()
      : [];

    const totalSales    = sales.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    const totalArtikel  = saleItems.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
    setStats({ sales: totalSales, expenses: totalExpenses, artikelkosten: totalArtikel, profit: totalSales - totalExpenses - totalArtikel });

    // Pie: expenses by category + Artikelkosten
    const catMap = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] ?? 0) + e.amount; });
    if (totalArtikel > 0) catMap['Artikelkosten'] = totalArtikel;
    setPieData(
      Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .filter(x => x.value > 0)
        .sort((a, b) => b.value - a.value)
    );

    const saleMap = {};
    sales.forEach(s => { saleMap[s.id] = { date: s.date.slice(0, 10), locationId: s.locationId }; });

    // Daily chart: Umsatz, Ausgaben, Gewinn (= Umsatz - Artikelkosten)
    const dayMap = {};
    const addDay = d => { dayMap[d] = dayMap[d] || { date: d, Umsatz: 0, Ausgaben: 0, _ek: 0 }; };

    sales.forEach(s => { const d = s.date.slice(0, 10); addDay(d); dayMap[d].Umsatz += s.total; });
    expenses.forEach(e => { const d = e.date.slice(0, 10); addDay(d); dayMap[d].Ausgaben += e.amount; });
    saleItems.forEach(si => {
      const d = saleMap[si.saleId]?.date;
      if (d) { addDay(d); dayMap[d]._ek += (si.costPrice ?? 0) * si.quantity; }
    });
    const dailyArr = Object.values(dayMap).map(d => ({
      date: d.date, Umsatz: d.Umsatz, Ausgaben: d.Ausgaben, Gewinn: d.Umsatz - d._ek,
    })).sort((a, b) => a.date.localeCompare(b.date));
    setDaily(dailyArr);

    // By-location chart: same keys
    const locMap = {};
    const addLoc = name => { locMap[name] = locMap[name] || { name, Umsatz: 0, Ausgaben: 0, _ek: 0 }; };

    sales.forEach(s => {
      const name = locs.find(l => l.id === s.locationId)?.name ?? 'Sonstiges';
      addLoc(name); locMap[name].Umsatz += s.total;
    });
    expenses.forEach(e => {
      const name = locs.find(l => l.id === e.locationId)?.name ?? 'Sonstiges';
      addLoc(name); locMap[name].Ausgaben += e.amount;
    });
    saleItems.forEach(si => {
      const locId = saleMap[si.saleId]?.locationId;
      const name  = locs.find(l => l.id === locId)?.name ?? 'Sonstiges';
      addLoc(name); locMap[name]._ek += (si.costPrice ?? 0) * si.quantity;
    });
    setByLocation(Object.values(locMap).map(l => ({
      name: l.name, Umsatz: l.Umsatz, Ausgaben: l.Ausgaben, Gewinn: l.Umsatz - l._ek,
    })));
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Analyse</h1>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
        />
        <select
          value={locFilter}
          onChange={e => setLocFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Alle Märkte</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>
              {l.name} · {new Date(l.createdAt).toLocaleDateString('de-DE')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Umsatz"         value={stats.sales}         color="text-blue-600" />
        <StatCard
          label="Gesamtausgaben"
          value={stats.expenses}
          color="text-red-500"
          onClick={() => setShowPie(v => !v)}
        />
        <StatCard label="Artikelkosten"  value={stats.artikelkosten} color="text-orange-500" />
        <StatCard
          label="Nettogewinn"
          value={stats.profit}
          color={stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {showPie && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-700 text-base">Ausgaben Aufschlüsselung</h2>
            <button
              onClick={() => setShowPie(false)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            >×</button>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => `€${Number(v).toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 text-gray-600">{item.name}</span>
                    <span className="font-bold text-gray-800">€{item.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 py-8">Keine Ausgaben in diesem Zeitraum</p>
          )}
        </div>
      )}

      {daily.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="font-bold text-gray-700 mb-3 text-base">Tägliche Übersicht</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `€${Number(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Umsatz"   fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Ausgaben" fill="#ef4444" radius={[4,4,0,0]} />
              <Bar dataKey="Gewinn"   fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byLocation.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-3 text-base">Nach Markt</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byLocation} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `€${Number(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Umsatz"   fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Ausgaben" fill="#ef4444" radius={[4,4,0,0]} />
              <Bar dataKey="Gewinn"   fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {daily.length === 0 && byLocation.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-3xl mb-3">📊</p>
          <p>Keine Daten für diesen Zeitraum</p>
        </div>
      )}
    </div>
  );
}
