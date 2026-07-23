import { useEffect, useState } from 'react';
import { db } from '../db';
import { deleteExpenseRemote } from '../sync';

const CATEGORIES = ['Miete', 'Strom', 'Hotel', 'Fahrtkosten', 'Sonstige'];

export default function ExpensesPage() {
  const [expenses,   setExpenses]   = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [amount,     setAmount]     = useState('');
  const [category,   setCategory]   = useState(CATEGORIES[0]);
  const [locationId, setLocationId] = useState('');
  const [note,       setNote]       = useState('');

  const [wFrom, setWFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [wTo,   setWTo]   = useState(() => new Date().toISOString().slice(0, 10));
  const [wareneinsatz, setWareneinsatz] = useState([]);

  async function load() {
    const locs = await db.locations.toArray();
    const exps = await db.expenses.reverse().limit(100).toArray();
    setLocations(locs);
    setExpenses(exps);
    if (!locationId && locs.length > 0) setLocationId(String(locs[0].id));
  }

  async function loadWareneinsatz(from, to) {
    const fromMs = new Date(from).getTime();
    const toMs   = new Date(to + 'T23:59:59').getTime();
    const sales  = await db.sales.filter(s => {
      const t = new Date(s.date).getTime();
      return t >= fromMs && t <= toMs;
    }).toArray();
    if (sales.length === 0) { setWareneinsatz([]); return; }
    const items = await db.saleItems.where('saleId').anyOf(sales.map(s => s.id)).toArray();
    const map = {};
    for (const item of items) {
      const cp = item.costPrice ?? 0;
      if (!map[item.productName]) map[item.productName] = { name: item.productName, qty: 0, total: 0 };
      map[item.productName].qty   += item.quantity;
      map[item.productName].total += cp * item.quantity;
    }
    setWareneinsatz(Object.values(map).filter(x => x.total > 0).sort((a, b) => b.total - a.total));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadWareneinsatz(wFrom, wTo); }, [wFrom, wTo]);
  useEffect(() => {
    const onSync = () => { load(); loadWareneinsatz(wFrom, wTo); };
    window.addEventListener('pos-synced', onSync);
    return () => window.removeEventListener('pos-synced', onSync);
  }, [wFrom, wTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    const now = new Date().toISOString();
    await db.expenses.add({
      amount: parseFloat(amount),
      category,
      locationId: parseInt(locationId),
      note: note.trim(),
      date: now, createdAt: now, updatedAt: now, synced: false,
    });
    setAmount(''); setNote('');
    load();
  }

  async function deleteExpense(exp) {
    await db.expenses.delete(exp.id);
    try { await deleteExpenseRemote(exp.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
    load();
  }

  const locName = (id) => locations.find(l => l.id === id)?.name ?? '';
  const totalWareneinsatz = wareneinsatz.reduce((s, i) => s + i.total, 0);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Ausgaben</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <input
            type="number"
            placeholder="€ Betrag"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0" step="0.5"
            className="w-32 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500 min-w-[120px]"
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500 min-w-[120px]"
          >
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Notiz (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
          >Hinzufügen</button>
        </div>
      </form>

      <div className="space-y-2">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800">{exp.category}</div>
              <div className="text-sm text-gray-500 truncate">
                {locName(exp.locationId)} · {new Date(exp.date).toLocaleDateString('de-DE')}
                {exp.note && ` · ${exp.note}`}
              </div>
            </div>
            <div className="text-red-500 font-bold text-lg shrink-0">€{exp.amount}</div>
            <button
              onClick={() => deleteExpense(exp)}
              className="text-gray-400 hover:text-red-500 px-2 py-1 text-lg leading-none active:text-red-700"
              title="Löschen"
            >×</button>
          </div>
        ))}
        {expenses.length === 0 && (
          <p className="text-center text-gray-400 py-10">Noch keine Ausgaben</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Artikelkosten</h2>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            type="date" value={wFrom} onChange={e => setWFrom(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date" value={wTo} onChange={e => setWTo(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {wareneinsatz.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {wareneinsatz.map(item => (
              <div key={item.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 font-medium text-gray-800">{item.name}</div>
                <div className="text-sm text-gray-400">{item.qty}×</div>
                <div className="text-orange-500 font-bold">€{item.total.toFixed(2)}</div>
              </div>
            ))}
            <div className="flex items-center px-4 py-3 bg-gray-50 rounded-b-2xl">
              <div className="flex-1 font-bold text-gray-700">Gesamt</div>
              <div className="text-orange-600 font-bold text-lg">€{totalWareneinsatz.toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-6 bg-white rounded-2xl shadow-sm">
            Keine Artikelkosten in diesem Zeitraum
          </p>
        )}
      </div>
    </div>
  );
}
