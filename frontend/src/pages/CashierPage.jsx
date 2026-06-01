import { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { useCartStore } from '../stores/cartStore';
import { runAutoSync } from '../autoSync';
import NumPad from '../components/NumPad';

const EXPENSE_CATEGORIES = ['Miete', 'Transport', 'Material', 'Personal', 'Sonstiges'];

function getDateBound(filter) {
  const now = new Date();
  if (filter === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const d = new Date(now);
    d.setDate(now.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (filter === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  if (filter === '30days') {
    const d = new Date(now);
    d.setDate(now.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return null;
}

export default function CashierPage() {
  const [activePazar, setActivePazar] = useState(null);
  const [locations, setLocations]     = useState([]);
  const [filter, setFilter]           = useState('30days');
  const [showModal, setShowModal]     = useState(false);
  const [pazarName, setPazarName]     = useState('');
  const [expenses, setExpenses]       = useState({});

  const [products, setProducts]       = useState([]);
  const [lastSale, setLastSale]       = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const { items, addItem, updateQuantity, updatePrice, setRabatt, clearCart, setLocation } = useCartStore();
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function loadLocations() {
    db.locations.toArray().then(locs =>
      setLocations(locs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    );
  }

  useEffect(() => { loadLocations(); }, []);
  useEffect(() => { if (activePazar) db.products.toArray().then(setProducts); }, [activePazar]);

  const filtered = locations.filter(loc => {
    const bound = getDateBound(filter);
    return bound ? loc.createdAt >= bound : true;
  });

  const uniqueNames = [...new Set(locations.map(l => l.name))];

  async function handleCreate() {
    if (!pazarName.trim()) return;
    const now = new Date().toISOString();
    const id = await db.locations.add({ name: pazarName.trim(), createdAt: now, synced: false });
    for (const cat of EXPENSE_CATEGORIES) {
      const amt = parseFloat(expenses[cat] || 0);
      if (amt > 0) {
        await db.expenses.add({
          amount: amt, category: cat, locationId: id,
          note: '', date: now, createdAt: now, updatedAt: now, synced: false,
        });
      }
    }
    const newPazar = { id, name: pazarName.trim(), createdAt: now };
    setLocation(id);
    setActivePazar(newPazar);
    setLocations(prev => [newPazar, ...prev]);
    setShowModal(false);
    setPazarName('');
    setExpenses({});
  }

  function selectPazar(loc) {
    setLocation(loc.id);
    setActivePazar(loc);
  }

  function goBack() {
    clearCart();
    setActivePazar(null);
    loadLocations();
  }

  async function deletePazar(loc, e) {
    e.stopPropagation();
    if (!window.confirm(`"${loc.name}" und alle zugehörigen Verkäufe und Ausgaben löschen?`)) return;
    const sales = await db.sales.where('locationId').equals(loc.id).toArray();
    const saleIds = sales.map(s => s.id);
    await Promise.all([
      db.saleItems.where('saleId').anyOf(saleIds).delete(),
      db.sales.where('locationId').equals(loc.id).delete(),
      db.expenses.where('locationId').equals(loc.id).delete(),
      db.locations.delete(loc.id),
    ]);
    loadLocations();
  }

  const completeSale = useCallback(async () => {
    if (items.length === 0 || !activePazar) return;
    const now = new Date().toISOString();
    const saleId = await db.sales.add({
      date: now, locationId: activePazar.id, total,
      createdAt: now, updatedAt: now, synced: false,
    });
    await db.saleItems.bulkAdd(
      items.map(i => ({
        saleId, productId: i.product.id, productName: i.product.name,
        quantity: i.quantity, price: i.price,
        costPrice: i.product.einkaufspreis ?? 0,
      }))
    );
    setLastSale({ total, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
    clearCart();
    setTimeout(() => setLastSale(null), 3000);
    runAutoSync();
  }, [items, activePazar, total, clearCart]);

  // ── PAZAR SELECTION ──────────────────────────────────────────────────────
  if (!activePazar) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 pb-10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Markt wählen</h1>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
            >+ Neuer Markt</button>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {[['week','Diese Woche'],['month','Dieser Monat'],['30days','Letzte 30 Tage'],['all','Alle']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === val
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-50'
                }`}
              >{label}</button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map(loc => (
              <div key={loc.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                <button onClick={() => selectPazar(loc)} className="flex-1 text-left active:opacity-70">
                  <div className="font-bold text-gray-800">{loc.name}</div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {new Date(loc.createdAt).toLocaleDateString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </button>
                <span className="text-gray-300 text-xl">›</span>
                <button
                  onClick={e => deletePazar(loc, e)}
                  className="text-gray-300 hover:text-red-500 active:text-red-700 text-xl px-1 leading-none shrink-0"
                  title="Löschen"
                >×</button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-10">Kein Markt in diesem Zeitraum</p>
            )}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Neuen Markt erstellen</h2>

              <input
                list="pazar-suggestions"
                value={pazarName}
                onChange={e => setPazarName(e.target.value)}
                placeholder="Marktname"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500 mb-4"
              />
              <datalist id="pazar-suggestions">
                {uniqueNames.map(name => <option key={name} value={name} />)}
              </datalist>

              <p className="text-sm font-semibold text-gray-500 mb-3">Ausgaben (optional)</p>
              <div className="space-y-2 mb-5">
                {EXPENSE_CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-gray-600 shrink-0">{cat}</span>
                    <input
                      type="number" min="0" step="0.5" placeholder="€ 0"
                      value={expenses[cat] || ''}
                      onChange={e => setExpenses(prev => ({ ...prev, [cat]: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowModal(false); setPazarName(''); setExpenses({}); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl active:bg-gray-200"
                >Abbrechen</button>
                <button
                  onClick={handleCreate}
                  disabled={!pazarName.trim()}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700 disabled:opacity-40"
                >Erstellen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CASHIER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full">

      {/* ── Products ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-100">
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
          <button onClick={goBack}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:bg-gray-200"
          >‹ Zurück</button>
          <span className="font-bold text-gray-800 text-base">{activePazar.name}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {lastSale && (
            <div className="mb-3 p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 font-medium text-center">
              Verkauf abgeschlossen — {lastSale.itemCount} Artikel · €{lastSale.total.toFixed(2)}
            </div>
          )}
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-2xl">📦</p>
              <p className="text-lg mt-2">Noch keine Produkte hinzugefügt</p>
              <p className="text-sm mt-1">Produkte auf der Produkte-Seite hinzufügen</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map(product => {
                const cartItem = items.find(i => i.product.id === product.id);
                const colored = product.color && product.color !== '#e5e7eb';
                return (
                  <button key={product.id} onClick={() => addItem(product)}
                    className={`relative rounded-2xl p-4 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm border-2 transition-all active:scale-95 ${
                      cartItem ? 'border-white/70' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: product.color || '#e5e7eb' }}
                  >
                    {cartItem && (
                      <span className="absolute top-2 right-2 bg-white/90 text-gray-900 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {cartItem.quantity}
                      </span>
                    )}
                    <div className={`font-bold text-base leading-tight ${colored ? 'text-white' : 'text-gray-800'}`}>
                      {product.name}
                    </div>
                    <div className={`font-bold text-xl mt-1 ${colored ? 'text-white/90' : 'text-emerald-600'}`}>
                      €{product.price}
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => setEditingItem('__rabatt__')}
                className={`relative bg-red-50 rounded-2xl p-4 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm border-2 transition-all active:scale-95 ${
                  items.find(i => i.product.id === '__rabatt__') ? 'border-red-400' : 'border-transparent'
                }`}
              >
                <div className="font-bold text-red-600 text-base leading-tight">Rabatt</div>
                <div className="text-red-400 font-bold text-xl mt-1">
                  {items.find(i => i.product.id === '__rabatt__')
                    ? `−€${Math.abs(items.find(i => i.product.id === '__rabatt__').price)}`
                    : '−€'}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Cart ── */}
      <div className="shrink-0 max-h-[45vh] lg:max-h-none lg:w-80 bg-gray-900 text-white flex flex-col">
        <div className="px-4 py-3 font-bold border-b border-gray-700 text-gray-200 flex items-center justify-between shrink-0">
          <span>Warenkorb {items.length > 0 && `(${items.reduce((s, i) => s + i.quantity, 0)})`}</span>
          <span className="text-emerald-400 text-lg lg:hidden">€{total.toFixed(2)}</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm py-6">Produkt auswählen</div>
          ) : (
            items.map(item => {
              const isRabatt = item.product.id === '__rabatt__';
              return (
                <div key={item.product.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isRabatt ? 'text-red-400' : 'text-white'}`}>
                      {item.product.name}
                    </div>
                    {!isRabatt && (
                      <button onClick={() => setEditingItem(item.product.id)}
                        className="text-emerald-400 text-sm font-medium active:text-emerald-300 text-left"
                      >
                        €{item.price}
                        {item.price !== item.product.price && (
                          <span className="ml-1 text-gray-500 line-through text-xs">€{item.product.price}</span>
                        )}
                      </button>
                    )}
                  </div>
                  {isRabatt ? (
                    <button onClick={() => setEditingItem('__rabatt__')}
                      className="text-red-400 text-sm font-medium active:text-red-300 px-1"
                    >Ändern</button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-11 h-11 bg-gray-700 rounded-xl font-bold text-lg active:bg-gray-600 flex items-center justify-center"
                      >−</button>
                      <span className="w-7 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-11 h-11 bg-gray-700 rounded-xl font-bold text-lg active:bg-gray-600 flex items-center justify-center"
                      >+</button>
                    </div>
                  )}
                  <div className={`text-right w-16 font-bold shrink-0 ${isRabatt ? 'text-red-400' : ''}`}>
                    {isRabatt ? `−€${Math.abs(item.price).toFixed(2)}` : `€${(item.price * item.quantity).toFixed(2)}`}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 lg:p-4 border-t border-gray-700 shrink-0">
          <div className="hidden lg:flex justify-between items-baseline mb-4">
            <span className="text-gray-400 text-sm">GESAMT</span>
            <span className="text-3xl font-bold text-emerald-400">€{total.toFixed(2)}</span>
          </div>
          <button onClick={completeSale} disabled={items.length === 0}
            className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl disabled:opacity-30 active:bg-emerald-700 transition-colors mb-2"
          >Verkauf abschließen</button>
          <button onClick={clearCart} disabled={items.length === 0}
            className="w-full py-2.5 bg-gray-700 text-gray-300 font-medium rounded-xl disabled:opacity-30 active:bg-gray-600 transition-colors text-sm"
          >Leeren</button>
        </div>
      </div>

      {editingItem && (() => {
        if (editingItem === '__rabatt__') {
          const existing = items.find(i => i.product.id === '__rabatt__');
          return (
            <NumPad
              label="Rabatt"
              initial={existing ? Math.abs(existing.price) : 0}
              onConfirm={val => { setRabatt(val); setEditingItem(null); }}
              onCancel={() => setEditingItem(null)}
            />
          );
        }
        const item = items.find(i => i.product.id === editingItem);
        return item ? (
          <NumPad
            label={item.product.name}
            initial={item.price}
            onConfirm={val => { updatePrice(editingItem, val); setEditingItem(null); }}
            onCancel={() => setEditingItem(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
