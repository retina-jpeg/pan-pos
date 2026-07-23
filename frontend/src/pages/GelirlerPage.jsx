import { useEffect, useState } from 'react';
import { db } from '../db';
import { deleteSaleRemote } from '../sync';

export default function GelirlerPage() {
  const [sales,      setSales]      = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [locFilter,  setLocFilter]  = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');

  async function load() {
    const locs = (await db.locations.toArray()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rawSales = await db.sales.reverse().limit(500).toArray();
    const withItems = await Promise.all(
      rawSales.map(async sale => ({
        ...sale,
        items: await db.saleItems.where('saleId').equals(sale.id).toArray(),
      }))
    );
    setLocations(locs);
    setSales(withItems);
  }

  useEffect(() => {
    load();
    window.addEventListener('pos-synced', load);
    return () => window.removeEventListener('pos-synced', load);
  }, []);

  const locName = (id) => locations.find(l => l.id === id)?.name ?? '';

  async function deleteSale(sale) {
    if (!confirm(`Verkauf über €${sale.total.toFixed(2)} löschen?`)) return;
    await db.saleItems.where('saleId').equals(sale.id).delete();
    await db.sales.delete(sale.id);
    try { await deleteSaleRemote(sale.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
    load();
  }

  const filtered = sales.filter(sale => {
    if (locFilter && sale.locationId !== parseInt(locFilter)) return false;
    if (dateFrom && sale.date < dateFrom) return false;
    if (dateTo   && sale.date > dateTo + 'T23:59:59') return false;
    return true;
  });

  const total = filtered.reduce((sum, s) => sum + s.total, 0);

  function clearFilters() {
    setLocFilter('');
    setDateFrom('');
    setDateTo('');
  }

  function setThisWeek() {
    const now = new Date();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    setDateFrom(monday.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  }

  function setThisMonth() {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    setDateTo(now.toISOString().slice(0, 10));
  }

  const hasFilter = locFilter || dateFrom || dateTo;

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Verkäufe</h1>
        {filtered.length > 0 && (
          <span className="text-emerald-600 font-bold text-lg">€{total.toFixed(2)}</span>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={setThisWeek}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium active:bg-emerald-100 active:text-emerald-700"
          >Diese Woche</button>
          <button
            onClick={setThisMonth}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium active:bg-emerald-100 active:text-emerald-700"
          >Dieser Monat</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={locFilter}
            onChange={e => setLocFilter(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 min-w-[130px]"
          >
            <option value="">Alle Märkte</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} · {new Date(l.createdAt).toLocaleDateString('de-DE')}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 min-w-[130px]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 min-w-[130px]"
          />
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:bg-gray-200"
            >Zurücksetzen</button>
          )}
        </div>
        {hasFilter && (
          <div className="text-xs text-gray-400">{filtered.length} Ergebnisse</div>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map(sale => (
          <div key={sale.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800">{locName(sale.locationId)}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {new Date(sale.date).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {sale.items.map((item, i) => (
                    <span key={i}>
                      {item.productName} ×{item.quantity}
                      {item.price !== undefined && (
                        <span className="text-gray-400 ml-1">€{(item.price * item.quantity).toFixed(2)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-emerald-600 font-bold text-lg shrink-0">
                €{sale.total.toFixed(2)}
              </div>
              <button
                onClick={() => deleteSale(sale)}
                className="text-gray-400 hover:text-red-500 px-2 py-1 text-lg leading-none active:text-red-700 shrink-0"
                title="Löschen"
              >×</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            {hasFilter ? 'Keine Verkäufe für diesen Filter' : 'Noch keine Verkäufe'}
          </p>
        )}
      </div>
    </div>
  );
}
