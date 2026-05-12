import { db } from './db';

export const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function isBackendUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/locations`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export async function pullFromBackend() {
  if (!(await isBackendUp())) return;

  const [serverLocs, serverProds] = await Promise.all([
    get('/api/locations'),
    get('/api/products'),
  ]);

  const existingLocs = await db.locations.toArray();
  const syncedLocIds = new Set(existingLocs.map(l => l.backendId).filter(Boolean));
  for (const loc of serverLocs) {
    if (!syncedLocIds.has(loc.id)) {
      await db.locations.add({ name: loc.name, createdAt: loc.createdAt, synced: true, backendId: loc.id });
    }
  }

  const existingProds = await db.products.toArray();
  const syncedProdIds = new Set(existingProds.map(p => p.backendId).filter(Boolean));
  for (const prod of serverProds) {
    if (!syncedProdIds.has(prod.id)) {
      await db.products.add({ name: prod.name, price: prod.price, createdAt: prod.createdAt, synced: true, backendId: prod.id });
    }
  }
}

export async function syncAll(onProgress) {
  if (!(await isBackendUp())) {
    throw new Error('Backend nicht erreichbar');
  }

  // 1. Locations
  onProgress?.('Märkte werden synchronisiert...');
  const unsyncedLocs = await db.locations.filter(l => !l.synced).toArray();
  for (const loc of unsyncedLocs) {
    const data = await post('/api/locations', { name: loc.name });
    await db.locations.update(loc.id, { synced: true, backendId: data.id });
  }

  // Build local→backend ID maps
  const allLocs = await db.locations.toArray();
  const locMap = {};
  allLocs.forEach(l => { if (l.backendId) locMap[l.id] = l.backendId; });

  // 2. Products
  onProgress?.('Produkte werden synchronisiert...');
  const unsyncedProds = await db.products.filter(p => !p.synced).toArray();
  for (const prod of unsyncedProds) {
    const data = await post('/api/products', { name: prod.name, price: prod.price });
    await db.products.update(prod.id, { synced: true, backendId: data.id });
  }

  const allProds = await db.products.toArray();
  const prodMap = {};
  allProds.forEach(p => { if (p.backendId) prodMap[p.id] = p.backendId; });

  // 3. Sales
  onProgress?.('Verkäufe werden synchronisiert...');
  const unsyncedSales = await db.sales.filter(s => !s.synced).toArray();
  for (const sale of unsyncedSales) {
    const backendLocationId = locMap[sale.locationId];
    if (!backendLocationId) continue;

    const items = await db.saleItems.where('saleId').equals(sale.id).toArray();
    const data = await post('/api/sales', {
      date: sale.date,
      locationId: backendLocationId,
      total: sale.total,
      items: items.map(i => ({
        productId: prodMap[i.productId] ?? null,
        productName: i.productName,
        quantity: i.quantity,
        price: i.price,
      })),
    });
    await db.sales.update(sale.id, { synced: true, backendId: data.id });
  }

  // 4. Expenses
  onProgress?.('Ausgaben werden synchronisiert...');
  const unsyncedExps = await db.expenses.filter(e => !e.synced).toArray();
  for (const exp of unsyncedExps) {
    const backendLocationId = locMap[exp.locationId];
    if (!backendLocationId) continue;

    await post('/api/expenses', {
      amount: exp.amount,
      category: exp.category,
      locationId: backendLocationId,
      note: exp.note,
      date: exp.date,
    });
    await db.expenses.update(exp.id, { synced: true });
  }

  onProgress?.('Abgeschlossen');
}

export async function countUnsynced() {
  const [locs, prods, sales, exps] = await Promise.all([
    db.locations.filter(r => !r.synced).count(),
    db.products.filter(r => !r.synced).count(),
    db.sales.filter(r => !r.synced).count(),
    db.expenses.filter(r => !r.synced).count(),
  ]);
  return locs + prods + sales + exps;
}
