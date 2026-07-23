import { useEffect, useState } from 'react';
import { db } from '../db';
import { deleteSaleRemote, deleteExpenseRemote } from '../sync';
import { runAutoSync } from '../autoSync';

const EXPENSE_CATEGORIES = ['Miete', 'Strom', 'Hotel', 'Fahrtkosten', 'Sonstige'];
// Prices are gross (Brutto) and already include 19% MwSt — same basis as the PDF report.
const MWST_RATE = 0.19;

const fmt     = v => `€${Number(v).toFixed(2)}`;
const fmtDate = d => new Date(d).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Full-screen editor for one market: shows sales + costs like the PDF report, but the
// user can delete sales and add/delete costs. Numbers mirror generateReport().
export default function PazarEditor({ loc, onBack, onPdf }) {
  const [sales,    setSales]    = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note,     setNote]     = useState('');
  const [busy,     setBusy]     = useState(false);

  async function load() {
    const rawSales = await db.sales.where('locationId').equals(loc.id).toArray();
    rawSales.sort((a, b) => new Date(b.date) - new Date(a.date));
    const withItems = await Promise.all(rawSales.map(async s => ({
      ...s,
      items: await db.saleItems.where('saleId').equals(s.id).toArray(),
    })));
    const exps = await db.expenses.where('locationId').equals(loc.id).toArray();
    exps.sort((a, b) => new Date(b.date) - new Date(a.date));
    setSales(withItems);
    setExpenses(exps);
  }

  useEffect(() => {
    load();
    window.addEventListener('pos-synced', load);
    return () => window.removeEventListener('pos-synced', load);
  }, [loc.id]);

  // ── Summary — same calculation as the PDF report ──
  const totalUmsatz        = sales.reduce((s, r) => s + r.total, 0);
  const totalAusgaben      = expenses.reduce((s, r) => s + r.amount, 0);
  const totalArtikelkosten = sales.reduce(
    (s, sale) => s + sale.items.reduce((si, i) => si + (i.costPrice ?? 0) * i.quantity, 0), 0);
  const totalNetto  = totalUmsatz / (1 + MWST_RATE);
  const totalMwst   = totalUmsatz - totalNetto;
  const nettogewinn = totalNetto - totalAusgaben - totalArtikelkosten;

  const tiles = [
    ['Umsatz (Brutto)', totalUmsatz,        'text-blue-600'],
    ['Netto-Umsatz',    totalNetto,         'text-sky-600'],
    ['MwSt (19%)',      totalMwst,          'text-purple-600'],
    ['Ausgaben',        totalAusgaben,      'text-red-600'],
    ['Artikelkosten',   totalArtikelkosten, 'text-orange-600'],
    ['Nettogewinn',     nettogewinn,        nettogewinn >= 0 ? 'text-emerald-600' : 'text-red-600'],
  ];

  async function deleteSale(sale) {
    if (!window.confirm(`Verkauf über €${sale.total.toFixed(2)} löschen?`)) return;
    await db.saleItems.where('saleId').equals(sale.id).delete();
    await db.sales.delete(sale.id);
    try { await deleteSaleRemote(sale.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
    load();
  }

  async function addExpense(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    await db.expenses.add({
      amount: amt, category, locationId: loc.id, note: note.trim(),
      date: now, createdAt: now, updatedAt: now, synced: false,
    });
    setAmount(''); setNote('');
    await load();
    setBusy(false);
    runAutoSync();
  }

  async function deleteExpense(exp) {
    if (!window.confirm(`Ausgabe "${exp.category}" über €${Number(exp.amount).toFixed(2)} löschen?`)) return;
    await db.expenses.delete(exp.id);
    try { await deleteExpenseRemote(exp.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
    load();
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* ── Header ── */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:bg-gray-200"
        >‹ Zurück</button>
        <span className="font-bold text-gray-800 text-base flex-1 truncate">{loc.name}</span>
        {onPdf && (
          <button
            onClick={() => onPdf(loc)}
            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium active:bg-blue-100 shrink-0"
          >PDF</button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 pb-10 space-y-4">

          {/* Summary (like the PDF) */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tiles.map(([lbl, val, color]) => (
                <div key={lbl} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="text-[11px] text-gray-500">{lbl}</div>
                  <div className={`font-bold ${color}`}>{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Verkäufe (delete only) */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Verkäufe ({sales.length})</h3>
            {sales.length > 0 ? (
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                {sales.map(sale => (
                  <div key={sale.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400">{fmtDate(sale.date)}</div>
                      <div className="text-sm text-gray-600 truncate">
                        {sale.items.map(i => `${i.productName} ×${i.quantity}`).join(', ') || '—'}
                      </div>
                    </div>
                    <div className="text-emerald-600 font-bold shrink-0">{fmt(sale.total)}</div>
                    <button
                      onClick={() => deleteSale(sale)}
                      className="text-gray-300 hover:text-red-500 active:text-red-700 text-xl leading-none px-1 shrink-0"
                      title="Verkauf löschen"
                    >×</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">Keine Verkäufe</p>
            )}
          </div>

          {/* Ausgaben (add + delete) */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Ausgaben ({expenses.length})</h3>
            <form onSubmit={addExpense} className="flex gap-2 flex-wrap mb-3">
              <input
                type="number" min="0" step="0.5" placeholder="€ Betrag"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-24 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <select
                value={category} onChange={e => setCategory(e.target.value)}
                className="flex-1 min-w-[110px] border border-gray-300 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input
                type="text" placeholder="Notiz (optional)"
                value={note} onChange={e => setNote(e.target.value)}
                className="flex-1 min-w-[110px] border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit" disabled={busy || !amount}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl active:bg-emerald-700 disabled:opacity-40"
              >+ Hinzufügen</button>
            </form>
            {expenses.length > 0 ? (
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{exp.category}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {fmtDate(exp.date)}{exp.note ? ` · ${exp.note}` : ''}
                      </div>
                    </div>
                    <div className="text-red-500 font-bold shrink-0">{fmt(exp.amount)}</div>
                    <button
                      onClick={() => deleteExpense(exp)}
                      className="text-gray-300 hover:text-red-500 active:text-red-700 text-xl leading-none px-1 shrink-0"
                      title="Ausgabe löschen"
                    >×</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">Keine Ausgaben</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
