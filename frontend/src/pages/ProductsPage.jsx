import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { deleteProductRemote, deleteCategoryRemote } from '../sync';

const DEFAULT_COLOR = '#e5e7eb';
const ROW_H = 56;

// ── Category picker / manager (assign, create, reorder, delete) ──
function CategoryPicker({ product, categories, onClose, onChanged }) {
  const [list, setList]       = useState(categories);
  const [newName, setNewName] = useState('');
  const [dragId, setDragId]   = useState(null);
  const listRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => { setList(categories); }, [categories]);

  async function assign(categoryId) {
    await db.products.update(product.id, { categoryId, synced: false, updatedAt: new Date().toISOString() });
    onChanged();
    onClose();
  }

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = list.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1);
    const now = new Date().toISOString();
    const id = await db.categories.add({ name, sortOrder: maxOrder + 1, createdAt: now, synced: false });
    setNewName('');
    await db.products.update(product.id, { categoryId: id, synced: false, updatedAt: now });
    onChanged();
    onClose();
  }

  async function deleteCategory(cat, e) {
    e.stopPropagation();
    if (!confirm(`Kategorie "${cat.name}" löschen? Produkte werden ohne Kategorie.`)) return;
    const affected = await db.products.where('categoryId').equals(cat.id).toArray();
    await Promise.all(affected.map(p => db.products.update(p.id, { categoryId: null, synced: false })));
    await db.categories.delete(cat.id);
    try { await deleteCategoryRemote(cat.backendId); } catch (err) { console.warn('Kategorie-Löschung fehlgeschlagen:', err); }
    onChanged();
  }

  function onHandleDown(e, id) {
    e.preventDefault();
    dragRef.current = id;
    setDragId(id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function onHandleMove(e) {
    if (dragRef.current == null || !listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    let idx = Math.floor((e.clientY - rect.top) / ROW_H);
    idx = Math.max(0, Math.min(list.length - 1, idx));
    const curIdx = list.findIndex(c => c.id === dragRef.current);
    if (curIdx !== -1 && idx !== curIdx) {
      const next = [...list];
      const [moved] = next.splice(curIdx, 1);
      next.splice(idx, 0, moved);
      setList(next);
    }
  }

  async function onHandleUp(e) {
    if (dragRef.current == null) return;
    dragRef.current = null;
    setDragId(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    await Promise.all(
      list
        .map((c, i) => (c.sortOrder !== i ? db.categories.update(c.id, { sortOrder: i, synced: false }) : null))
        .filter(Boolean)
    );
    onChanged();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Kategorie</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none px-1">×</button>
        </div>

        <div className="flex gap-2 p-3 border-b border-gray-100">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Neue Kategorie"
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={createCategory}
            disabled={!newName.trim()}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700 disabled:opacity-40"
          >+ Neu</button>
        </div>

        <button
          onClick={() => assign(null)}
          className="flex items-center gap-3 px-4 border-b border-gray-100 active:bg-gray-50 shrink-0"
          style={{ height: ROW_H }}
        >
          <span className="w-4" />
          <span className={`flex-1 text-left ${product.categoryId == null ? 'font-bold text-emerald-600' : 'text-gray-500'}`}>
            Keine Kategorie
          </span>
          {product.categoryId == null && <span className="text-emerald-600">✓</span>}
        </button>

        <div ref={listRef} className="overflow-y-auto">
          {list.map(cat => (
            <div
              key={cat.id}
              className={`flex items-center gap-2 px-4 ${dragId === cat.id ? 'bg-emerald-50' : ''}`}
              style={{ height: ROW_H }}
            >
              <span
                onPointerDown={e => onHandleDown(e, cat.id)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                className="text-gray-400 text-xl cursor-grab select-none px-1"
                style={{ touchAction: 'none' }}
              >⠿</span>
              <button onClick={() => assign(cat.id)} className="flex-1 text-left truncate">
                <span className={product.categoryId === cat.id ? 'font-bold text-emerald-600' : 'text-gray-800'}>
                  {cat.name}
                </span>
              </button>
              {product.categoryId === cat.id && <span className="text-emerald-600">✓</span>}
              <button onClick={e => deleteCategory(cat, e)} className="text-gray-300 hover:text-red-500 text-lg px-1 leading-none">×</button>
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm">Noch keine Kategorien</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [name, setName]               = useState('');
  const [price, setPrice]             = useState('');
  const [einkaufspreis, setEinkauf]   = useState('');
  const [color, setColor]             = useState(DEFAULT_COLOR);
  const [editId, setEditId]           = useState(null);
  const [pickerProduct, setPickerProduct] = useState(null);

  async function load() {
    const [prods, cats] = await Promise.all([
      db.products.toArray(),
      db.categories.orderBy('sortOrder').toArray(),
    ]);
    setProducts(prods);
    setCategories(cats);
    setPickerProduct(prev => (prev ? prods.find(p => p.id === prev.id) ?? null : null));
  }

  useEffect(() => {
    load();
    window.addEventListener('pos-synced', load);
    return () => window.removeEventListener('pos-synced', load);
  }, []);

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
        name: name.trim(), price: parseFloat(price), einkaufspreis: ek, color, categoryId: null, createdAt: now, updatedAt: now, synced: false,
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
    const product = await db.products.get(id);
    await db.products.delete(id);
    try { await deleteProductRemote(product?.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
    load();
  }

  const categoryName = (id) => categories.find(c => c.id === id)?.name ?? null;

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
              <div className="font-bold text-gray-800 truncate">{p.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 shrink-0">EK: {p.einkaufspreis != null ? `€${p.einkaufspreis}` : '—'}</span>
                <button
                  onClick={() => setPickerProduct(p)}
                  className={`text-xs px-2 py-0.5 rounded-full border truncate max-w-[140px] active:bg-gray-100 ${
                    categoryName(p.categoryId)
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >{categoryName(p.categoryId) || '+ Kategorie'}</button>
              </div>
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

      {pickerProduct && (
        <CategoryPicker
          product={pickerProduct}
          categories={categories}
          onClose={() => setPickerProduct(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
