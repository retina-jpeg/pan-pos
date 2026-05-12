import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { db } from '../db';

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>€{value.toFixed(2)}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo]           = useState(() => new Date().toISOString().slice(0, 10));
  const [locFilter, setLocFilter] = useState('');
  const [stats, setStats]     = useState({ sales: 0, expenses: 0, profit: 0 });
  const [daily, setDaily]     = useState([]);
  const [byLocation, setByLocation] = useState([]);
  const [locations, setLocations]   = useState([]);

  useEffect(() => { load(); }, [from, to, locFilter]);

  async function load() {
    const locs = (await db.locations.toArray()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setLocations(locs);

    const fromMs = new Date(from).getTime();
    const toMs   = new Date(to + 'T23:59:59').getTime();

    const locId = locFilter ? parseInt(locFilter) : null;

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

    const totalSales    = sales.reduce((s, r) => s + r.total, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    setStats({ sales: totalSales, expenses: totalExpenses, profit: totalSales - totalExpenses });

    const dayMap = {};
    sales.forEach(s => {
      const d = s.date.slice(0, 10);
      dayMap[d] = dayMap[d] || { date: d, Einnahmen: 0, Ausgaben: 0 };
      dayMap[d].Einnahmen += s.total;
    });
    expenses.forEach(e => {
      const d = e.date.slice(0, 10);
      dayMap[d] = dayMap[d] || { date: d, Einnahmen: 0, Ausgaben: 0 };
      dayMap[d].Ausgaben += e.amount;
    });
    setDaily(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));

    const locMap = {};
    sales.forEach(s => {
      const name = locs.find(l => l.id === s.locationId)?.name ?? 'Sonstiges';
      locMap[name] = locMap[name] || { name, Einnahmen: 0, Ausgaben: 0 };
      locMap[name].Einnahmen += s.total;
    });
    expenses.forEach(e => {
      const name = locs.find(l => l.id === e.locationId)?.name ?? 'Sonstiges';
      locMap[name] = locMap[name] || { name, Einnahmen: 0, Ausgaben: 0 };
      locMap[name].Ausgaben += e.amount;
    });
    setByLocation(Object.values(locMap));
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

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Gesamteinnahmen" value={stats.sales}    color="text-emerald-600" />
        <StatCard label="Gesamtausgaben"  value={stats.expenses} color="text-red-500" />
        <StatCard
          label="Nettogewinn"
          value={stats.profit}
          color={stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {daily.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="font-bold text-gray-700 mb-3 text-base">Tägliche Einnahmen / Ausgaben</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `€${Number(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Einnahmen" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Ausgaben"  fill="#ef4444" radius={[4,4,0,0]} />
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
              <Bar dataKey="Einnahmen" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Ausgaben"  fill="#ef4444" radius={[4,4,0,0]} />
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
