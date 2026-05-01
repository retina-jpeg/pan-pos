import { useEffect, useState } from 'react';
import { db } from '../db';

export default function ProductsPage() {
  const [products, setProducts]   = useState([]);
  const [locations, setLocations] = useState([]);
  const [name, setName]           = useState('');
  const [price, setPrice]         = useState('');
  const [editId, setEditId]       = useState(null);
  const [locName, setLocName]     = useState('');

  async function load() {
    setProducts(await db.products.toArray());
    setLocations(await db.locations.toArray());
  }

  useEffect(() => { load(); }, []);

  async function handleProductSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    const now = new Date().toISOString();
    if (editId) {
      await db.products.update(editId, {
        name: name.trim(), price: parseFloat(price), updatedAt: now, synced: false,
      });
      setEditId(null);
    } else {
      await db.products.add({
        name: name.trim(), price: parseFloat(price), createdAt: now, updatedAt: now, synced: false,
      });
    }
    setName(''); setPrice('');
    load();
  }

  async function handleLocationSubmit(e) {
    e.preventDefault();
    if (!locName.trim()) return;
    const now = new Date().toISOString();
    await db.locations.add({ name: locName.trim(), createdAt: now, synced: false });
    setLocName('');
    load();
  }

  function startEdit(p) {
    setEditId(p.id); setName(p.name); setPrice(String(p.price));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!confirm('Ürünü sil?')) return;
    await db.products.delete(id);
    load();
  }

  async function deleteLocation(id) {
    if (!confirm('Pazar yerini sil?')) return;
    await db.locations.delete(id);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Ürünler</h1>

      {/* Product form */}
      <form onSubmit={handleProductSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ürün adı"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="€ Fiyat"
            value={price}
            onChange={e => setPrice(e.target.value)}
            min="0" step="0.5"
            className="w-28 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
          >
            {editId ? 'Güncelle' : 'Ekle'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setName(''); setPrice(''); }}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-300"
            >
              İptal
            </button>
          )}
        </div>
      </form>

      {/* Product list */}
      <div className="space-y-2 mb-8">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="flex-1 font-bold text-gray-800">{p.name}</div>
            <div className="text-emerald-600 font-bold text-lg">€{p.price}</div>
            <button
              onClick={() => startEdit(p)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium active:bg-gray-200"
            >Düzenle</button>
            <button
              onClick={() => deleteProduct(p.id)}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100"
            >Sil</button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-400 py-10">Henüz ürün eklenmedi</p>
        )}
      </div>

      {/* Locations section */}
      <h2 className="text-xl font-bold mb-3 text-gray-800">Pazar Yerleri</h2>
      <form onSubmit={handleLocationSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Yeni pazar adı"
          value={locName}
          onChange={e => setLocName(e.target.value)}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
        >Ekle</button>
      </form>
      <div className="space-y-2">
        {locations.map(l => (
          <div key={l.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="flex-1 font-medium text-gray-800">{l.name}</div>
            <button
              onClick={() => deleteLocation(l.id)}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100"
            >Sil</button>
          </div>
        ))}
      </div>
    </div>
  );
}
