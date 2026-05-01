import { useEffect, useState } from 'react';
import { db } from '../db';

const CATEGORIES = ['Kira', 'Nakliye', 'Malzeme', 'Personel', 'Diğer'];

export default function ExpensesPage() {
  const [expenses,  setExpenses]  = useState([]);
  const [locations, setLocations] = useState([]);
  const [amount,    setAmount]    = useState('');
  const [category,  setCategory]  = useState(CATEGORIES[0]);
  const [locationId,setLocationId]= useState('');
  const [note,      setNote]      = useState('');

  async function load() {
    const locs = await db.locations.toArray();
    const exps = await db.expenses.reverse().limit(100).toArray();
    setLocations(locs);
    setExpenses(exps);
    if (!locationId && locs.length > 0) setLocationId(String(locs[0].id));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    const now = new Date().toISOString();
    await db.expenses.add({
      amount: parseFloat(amount),
      category,
      locationId: parseInt(locationId),
      note: note.trim(),
      date: now,
      createdAt: now,
      updatedAt: now,
      synced: false,
    });
    setAmount(''); setNote('');
    load();
  }

  async function deleteExpense(id) {
    await db.expenses.delete(id);
    load();
  }

  const locName = (id) => locations.find(l => l.id === id)?.name ?? '';

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Giderler</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <input
            type="number"
            placeholder="€ Tutar"
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
            placeholder="Not (isteğe bağlı)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
          >
            Ekle
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800">{exp.category}</div>
              <div className="text-sm text-gray-500 truncate">
                {locName(exp.locationId)} · {new Date(exp.date).toLocaleDateString('tr-TR')}
                {exp.note && ` · ${exp.note}`}
              </div>
            </div>
            <div className="text-red-500 font-bold text-lg shrink-0">€{exp.amount}</div>
            <button
              onClick={() => deleteExpense(exp.id)}
              className="text-gray-400 hover:text-red-500 px-2 py-1 text-lg leading-none active:text-red-700"
              title="Sil"
            >×</button>
          </div>
        ))}
        {expenses.length === 0 && (
          <p className="text-center text-gray-400 py-10">Henüz gider yok</p>
        )}
      </div>
    </div>
  );
}
