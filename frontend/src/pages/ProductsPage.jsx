import { useEffect, useState } from 'react';
import { db } from '../db';

const DEFAULT_COLOR = '#e5e7eb';

export default function ProductsPage() {
  const [products, setProducts]       = useState([]);
  const [name, setName]               = useState('');
  const [price, setPrice]             = useState('');
  const [einkaufspreis, setEinkauf]   = useState('');
  const [color, setColor]             = useState(DEFAULT_COLOR);
  const [editId, setEditId]           = useState(null);

  async function load() {
    setProducts(await db.products.toArray());
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    const now = new Date().toISOString();
    const ek = einkaufspreis ? parseFloat(einkaufspreis) : null;
    if (editId) {
      await db.products.update(editId, {
        name: name.trim(), price: parseFloat(price), einkaufspreis: ek, color, updatedAt: now, synced: false,
      });
      setEditId(null);
    } else {
      await db.products.add({
        name: name.trim(), price: parseFloat(price), einkaufspreis: ek, color, createdAt: now, updatedAt: now, synced: false,
      });
    }
    setName(''); setPrice(''); setEinkauf(''); setColor(DEFAULT_COLOR);
    load();
  }

  function startEdit(p) {
    setEditId(p.id); setName(p.name); setPrice(String(p.price));
    setEinkauf(p.einkaufspreis != null ? String(p.einkaufspreis) : '');
    setColor(p.color || DEFAULT_COLOR);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!confirm('Produkt löschen?')) return;
    await db.products.delete(id);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Produkte</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Produktname"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-[140px] border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="VK €"
            value={price}
            onChange={e => setPrice(e.target.value)}
            min="0" step="0.5"
            className="w-24 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="EK €"
            value={einkaufspreis}
            onChange={e => setEinkauf(e.target.value)}
            min="0" step="0.01"
            className="w-24 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-11 h-11 rounded-xl border border-gray-300 cursor-pointer p-0.5 bg-white"
          />
          <span className="text-sm text-gray-400 font-mono">{color}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
          >{editId ? 'Aktualisieren' : 'Hinzufügen'}</button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setName(''); setPrice(''); setEinkauf(''); setColor(DEFAULT_COLOR); }}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-300"
            >Abbrechen</button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-lg shrink-0 border border-gray-200"
              style={{ backgroundColor: p.color || DEFAULT_COLOR }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-400">EK: {p.einkaufspreis != null ? `€${p.einkaufspreis}` : '—'}</div>
            </div>
            <div className="text-emerald-600 font-bold text-lg">€{p.price}</div>
            <button onClick={() => startEdit(p)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium active:bg-gray-200"
            >Bearbeiten</button>
            <button onClick={() => deleteProduct(p.id)}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100"
            >Löschen</button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-400 py-10">Noch keine Produkte hinzugefügt</p>
        )}
      </div>
    </div>
  );
}
