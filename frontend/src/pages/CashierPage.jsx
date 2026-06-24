import { useEffect, useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db';
import { useCartStore } from '../stores/cartStore';
import { runAutoSync } from '../autoSync';
import { deleteLocationRemote } from '../sync';
import NumPad from '../components/NumPad';

const EXPENSE_CATEGORIES = ['Miete', 'Strom', 'Hotel', 'Fahrtkosten', 'Sonstige'];

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

// Prices are gross (Brutto) and already include 19% MwSt.
const MWST_RATE = 0.19;

const fmt     = v  => `EUR ${Number(v).toFixed(2)}`;
const fmtDate = d  => new Date(d).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

async function generateReport(loc, e) {
  e?.stopPropagation();

  const sales = await db.sales.where('locationId').equals(loc.id).toArray();
  sales.sort((a, b) => new Date(a.date) - new Date(b.date));

  const saleIds      = sales.map(s => s.id);
  const allSaleItems = saleIds.length > 0
    ? await db.saleItems.where('saleId').anyOf(saleIds).toArray()
    : [];
  const expenses = await db.expenses.where('locationId').equals(loc.id).toArray();

  const itemsBySale = {};
  allSaleItems.forEach(si => {
    if (!itemsBySale[si.saleId]) itemsBySale[si.saleId] = [];
    itemsBySale[si.saleId].push(si);
  });

  const totalUmsatz        = sales.reduce((s, r) => s + r.total, 0);
  const totalAusgaben      = expenses.reduce((s, r) => s + r.amount, 0);
  const totalArtikelkosten = allSaleItems.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
  // Prices are gross (incl. 19% MwSt); split the Umsatz into Netto + MwSt.
  const totalNetto         = totalUmsatz / (1 + MWST_RATE);
  const totalMwst          = totalUmsatz - totalNetto;
  const nettogewinn        = totalNetto - totalAusgaben - totalArtikelkosten;

  const prodMap = {};
  allSaleItems.forEach(si => {
    const cp = si.costPrice ?? 0;
    if (!prodMap[si.productName]) prodMap[si.productName] = { qty: 0, total: 0 };
    prodMap[si.productName].qty   += si.quantity;
    prodMap[si.productName].total += cp * si.quantity;
  });

  // Product sales summary (quantity sold + revenue), excluding the Rabatt line.
  const prodSalesMap = {};
  let totalProdQty = 0;
  let totalProdRevenue = 0;
  allSaleItems.forEach(si => {
    if (si.productId === '__rabatt__' || si.productName === 'Rabatt') return;
    if (!prodSalesMap[si.productName]) prodSalesMap[si.productName] = { qty: 0, revenue: 0 };
    prodSalesMap[si.productName].qty     += si.quantity;
    prodSalesMap[si.productName].revenue += si.price * si.quantity;
    totalProdQty     += si.quantity;
    totalProdRevenue += si.price * si.quantity;
  });

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // ── Header ──
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(17, 17, 17);
  doc.text(loc.name, margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(107, 114, 128);
  let meta = `Erstellt: ${fmtDate(loc.createdAt)}`;
  if (loc.closedAt) meta += `   |   Geschlossen: ${fmtDate(loc.closedAt)}`;
  meta += `   |   Bericht: ${fmtDate(new Date().toISOString())}`;
  doc.text(meta, margin, y);
  y += 22;

  // ── Summary cards (3 per row) ──
  const cards = [
    ['Umsatz (Brutto)', fmt(totalUmsatz),        [37, 99, 235]],
    ['Netto-Umsatz',    fmt(totalNetto),         [2, 132, 199]],
    ['MwSt (19%)',      fmt(totalMwst),          [124, 58, 237]],
    ['Ausgaben',        fmt(totalAusgaben),      [220, 38, 38]],
    ['Artikelkosten',   fmt(totalArtikelkosten), [234, 88, 12]],
    ['Nettogewinn',     fmt(nettogewinn),        nettogewinn >= 0 ? [5, 150, 105] : [220, 38, 38]],
  ];
  const perRow = 3;
  const gap = 10;
  const cardW = (pageW - margin * 2 - gap * (perRow - 1)) / perRow;
  const cardH = 50;
  cards.forEach(([lbl, val, color], i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = margin + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.setDrawColor(229, 231, 235).setFillColor(249, 250, 251);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(107, 114, 128);
    doc.text(lbl, x + 10, cy + 16);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...color);
    doc.text(val, x + 10, cy + 36);
  });
  y += Math.ceil(cards.length / perRow) * (cardH + gap) - gap + 24;

  const tableOpts = {
    theme: 'grid',
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: [17, 17, 17] },
    footStyles: { fillColor: [249, 250, 251], textColor: [17, 17, 17], fontStyle: 'bold', fontSize: 9 },
    margin: { left: margin, right: margin },
    styles: { cellPadding: 5, lineColor: [243, 244, 246] },
  };

  function sectionTitle(title) {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(17, 17, 17);
    doc.text(title, margin, y);
    y += 8;
  }

  // ── Produktverkäufe ──
  const prodSalesBody = Object.entries(prodSalesMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => [name, String(v.qty), fmt(v.revenue)]);
  if (prodSalesBody.length > 0) {
    sectionTitle('Produktverkäufe');
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Produkt', 'Verkauft', 'Umsatz']],
      body: prodSalesBody,
      foot: [['Gesamt', String(totalProdQty), fmt(totalProdRevenue)]],
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  // ── Verkäufe ──
  sectionTitle(`Verkäufe (${sales.length})`);
  if (sales.length > 0) {
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Zeit', 'Artikel', 'Betrag']],
      body: sales.map(sale => [
        fmtDate(sale.date),
        (itemsBySale[sale.id] || []).map(i => `${i.productName} x${i.quantity}`).join(', '),
        fmt(sale.total),
      ]),
      foot: [['Gesamt', '', fmt(totalUmsatz)]],
      columnStyles: { 2: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 24;
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(156, 163, 175);
    doc.text('Keine Verkäufe', margin, y + 14); y += 32;
  }

  // ── Ausgaben ──
  sectionTitle(`Ausgaben (${expenses.length})`);
  if (expenses.length > 0) {
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Kategorie', 'Notiz', 'Betrag']],
      body: expenses.map(e => [e.category, e.note || '-', fmt(e.amount)]),
      foot: [['Gesamt', '', fmt(totalAusgaben)]],
      columnStyles: { 2: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 24;
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(156, 163, 175);
    doc.text('Keine Ausgaben', margin, y + 14); y += 32;
  }

  // ── Artikelkosten ──
  const artBody = Object.entries(prodMap)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => [name, String(v.qty), fmt(v.total)]);
  if (artBody.length > 0) {
    sectionTitle('Artikelkosten');
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Produkt', 'Menge', 'Kosten']],
      body: artBody,
      foot: [['Gesamt', '', fmt(totalArtikelkosten)]],
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    });
  }

  const safeName = loc.name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
  const dateStr  = new Date().toISOString().slice(0, 10);
  doc.save(`Marktbericht_${safeName}_${dateStr}.pdf`);
}

export default function CashierPage() {
  const [activePazar, setActivePazar] = useState(null);
  const [locations, setLocations]     = useState([]);
  const [filter, setFilter]           = useState('30days');
  const [showModal, setShowModal]     = useState(false);
  const [pazarName, setPazarName]     = useState('');
  const [expenses, setExpenses]       = useState({});

  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [activeCategory, setActiveCategory] = useState(null); // category id, '__none__', or null (= show categories)
  const [lastSale, setLastSale]       = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const { items, addItem, updateQuantity, updatePrice, setRabatt, clearCart, setLocation } = useCartStore();
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function loadLocations() {
    db.locations.toArray().then(locs =>
      setLocations(locs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    );
  }

  function loadCatalog() {
    db.products.toArray().then(setProducts);
    db.categories.orderBy('sortOrder').toArray().then(setCategories);
  }

  useEffect(() => { loadLocations(); }, []);
  useEffect(() => { if (activePazar) loadCatalog(); }, [activePazar]);
  useEffect(() => {
    const onSync = () => {
      loadLocations();
      if (activePazar) loadCatalog();
    };
    window.addEventListener('pos-synced', onSync);
    return () => window.removeEventListener('pos-synced', onSync);
  }, [activePazar]);

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
    setActiveCategory(null);
    setActivePazar(loc);
  }

  function goBack() {
    clearCart();
    setActiveCategory(null);
    setActivePazar(null);
    loadLocations();
  }

  async function closePazar() {
    if (!window.confirm(`"${activePazar.name}" abschließen? Der Markt kann danach nicht mehr geöffnet werden.`)) return;
    const now = new Date().toISOString();
    await db.locations.update(activePazar.id, { closed: true, closedAt: now, synced: false });
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
    // Also remove from backend so it doesn't get pulled back on the next sync.
    try { await deleteLocationRemote(loc.backendId); } catch (err) { console.warn('Backend-Löschung fehlgeschlagen:', err); }
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
              <div
                key={loc.id}
                className={`rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2 ${loc.closed ? 'bg-gray-50' : 'bg-white'}`}
              >
                {loc.closed ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-400">{loc.name}</span>
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium shrink-0">
                        Geschlossen
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      {fmtDate(loc.createdAt)}
                      {loc.closedAt && ` – ${fmtDate(loc.closedAt)}`}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => selectPazar(loc)} className="flex-1 text-left active:opacity-70 min-w-0">
                    <div className="font-bold text-gray-800">{loc.name}</div>
                    <div className="text-sm text-gray-400 mt-0.5">{fmtDate(loc.createdAt)}</div>
                  </button>
                )}
                {!loc.closed && <span className="text-gray-300 text-xl shrink-0">›</span>}
                <button
                  onClick={e => generateReport(loc, e)}
                  className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium active:bg-blue-100 shrink-0"
                  title="PDF Bericht"
                >PDF</button>
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
                    <span className="w-24 text-sm text-gray-600 shrink-0">{cat}</span>
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
  // Category-first navigation: show categories, then the products under one.
  const validCatIds   = new Set(categories.map(c => c.id));
  const isUncategorized = p => p.categoryId == null || !validCatIds.has(p.categoryId);
  const hasUncategorized = products.some(isUncategorized);
  const useCategories = categories.length > 0;
  const visibleProducts = !useCategories
    ? products
    : activeCategory === '__none__'
      ? products.filter(isUncategorized)
      : products.filter(p => p.categoryId === activeCategory);
  const countIn = cat =>
    cat === '__none__' ? products.filter(isUncategorized).length
                       : products.filter(p => p.categoryId === cat.id).length;

  const productTile = (product) => {
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
  };

  const rabattTile = (
    <button
      key="__rabatt__"
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
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">

      {/* ── Products ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-100">
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
          <button onClick={goBack}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:bg-gray-200"
          >‹ Zurück</button>
          <span className="font-bold text-gray-800 text-base flex-1 truncate">{activePazar.name}</span>
          <button
            onClick={e => generateReport(activePazar, e)}
            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium active:bg-blue-100 shrink-0"
          >PDF</button>
          <button
            onClick={closePazar}
            className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium active:bg-red-100 shrink-0"
          >Abschließen</button>
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
          ) : useCategories && activeCategory === null ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className="rounded-2xl p-4 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm bg-white border-2 border-transparent active:scale-95 transition-all"
                >
                  <div className="font-bold text-base text-gray-800 leading-tight">{cat.name}</div>
                  <div className="text-sm text-gray-400 mt-1">{countIn(cat)} Artikel</div>
                </button>
              ))}
              {hasUncategorized && (
                <button onClick={() => setActiveCategory('__none__')}
                  className="rounded-2xl p-4 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm bg-white border-2 border-dashed border-gray-200 active:scale-95 transition-all"
                >
                  <div className="font-bold text-base text-gray-500 leading-tight">Ohne Kategorie</div>
                  <div className="text-sm text-gray-400 mt-1">{countIn('__none__')} Artikel</div>
                </button>
              )}
            </div>
          ) : (
            <>
              {useCategories && (
                <button onClick={() => setActiveCategory(null)}
                  className="mb-3 px-4 py-2 bg-white text-gray-600 rounded-xl text-sm font-medium shadow-sm active:bg-gray-100"
                >‹ Kategorien</button>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleProducts.map(productTile)}
                {rabattTile}
              </div>
              {visibleProducts.length === 0 && (
                <p className="text-center text-gray-400 py-8">Keine Produkte in dieser Kategorie</p>
              )}
            </>
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
