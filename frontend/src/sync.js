import { db } from './db';

export const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Compare two id arrays regardless of order.
function sameIds(a, b) {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function isBackendUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/locations`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

// Like get(), but never throws: returns `fallback` if the endpoint is missing or
// errors. Keeps one broken resource (e.g. an outdated backend) from aborting the
// whole sync.
async function getSafe(path, fallback) {
  try {
    return await get(path);
  } catch (err) {
    console.warn(`Pull übersprungen: ${path} (${err.message})`);
    return fallback;
  }
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

async function put(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

// Delete a record on the backend so it is not pulled back on the next sync.
// Best-effort: if the backend is unreachable the local delete still stands.
export async function deleteLocationRemote(backendId) {
  if (!backendId || !(await isBackendUp())) return;
  await del(`/api/locations/${backendId}`);
}

export async function deleteProductRemote(backendId) {
  if (!backendId || !(await isBackendUp())) return;
  await del(`/api/products/${backendId}`);
}

export async function deleteCategoryRemote(backendId) {
  if (!backendId || !(await isBackendUp())) return;
  await del(`/api/categories/${backendId}`);
}

// ── PULL: bring remote data down into the local DB (locations, products, sales, expenses).
// Records are matched to their backend counterpart via `backendId` to avoid duplicates.
// Returns true if any local data was added/updated (so the UI can refresh).
export async function pullFromBackend() {
  if (!(await isBackendUp())) return false;

  const [serverLocs, serverCats, serverProds, serverSales, serverExps] = await Promise.all([
    getSafe('/api/locations', null),
    getSafe('/api/categories', null),
    getSafe('/api/products', null),
    getSafe('/api/sales', null),
    getSafe('/api/expenses', null),
  ]);

  let changed = false;
  // Whether categories were actually fetched. If not (e.g. backend not updated yet),
  // we must NOT touch local category assignments — they live only locally for now.
  const catsOk = Array.isArray(serverCats);

  // ── Categories ──
  const localCats    = await db.categories.toArray();
  const catByBackend = new Map();
  localCats.forEach(c => { if (c.backendId) catByBackend.set(c.backendId, c); });
  for (const cat of (serverCats ?? [])) {
    const existing = catByBackend.get(cat.id);
    if (!existing) {
      const newId = await db.categories.add({
        name: cat.name,
        sortOrder: cat.sortOrder ?? 0,
        createdAt: cat.createdAt,
        synced: true,
        backendId: cat.id,
      });
      catByBackend.set(cat.id, { id: newId, backendId: cat.id });
      changed = true;
    } else if (existing.synced) {
      if (existing.name !== cat.name || (existing.sortOrder ?? 0) !== (cat.sortOrder ?? 0)) {
        await db.categories.update(existing.id, {
          name: cat.name,
          sortOrder: cat.sortOrder ?? 0,
        });
        changed = true;
      }
    }
  }
  const catLocalId = id => (id == null ? null : catByBackend.get(id)?.id ?? null);

  // ── Locations ──
  const localLocs   = await db.locations.toArray();
  const locByBackend = new Map();
  localLocs.forEach(l => { if (l.backendId) locByBackend.set(l.backendId, l); });
  for (const loc of (serverLocs ?? [])) {
    const existing = locByBackend.get(loc.id);
    if (!existing) {
      const newId = await db.locations.add({
        name: loc.name,
        closed: loc.closed ?? false,
        closedAt: loc.closedAt ?? null,
        createdAt: loc.createdAt,
        synced: true,
        backendId: loc.id,
      });
      locByBackend.set(loc.id, { id: newId, backendId: loc.id });
      changed = true;
    } else if (existing.synced) {
      // Server wins only when there is no pending local change.
      if (existing.name !== loc.name || !!existing.closed !== !!loc.closed) {
        await db.locations.update(existing.id, {
          name: loc.name,
          closed: loc.closed ?? false,
          closedAt: loc.closedAt ?? null,
        });
        changed = true;
      }
    }
  }

  // ── Products ──
  const localProds    = await db.products.toArray();
  const prodByBackend = new Map();
  localProds.forEach(p => { if (p.backendId) prodByBackend.set(p.backendId, p); });
  for (const prod of (serverProds ?? [])) {
    const existing = prodByBackend.get(prod.id);
    // Map the server's category ids to local ids (only when categories were fetched).
    const localCategoryIds = catsOk
      ? (prod.categoryIds ?? []).map(catLocalId).filter(v => v != null)
      : undefined;
    if (!existing) {
      const newId = await db.products.add({
        name: prod.name,
        price: prod.price,
        einkaufspreis: prod.costPrice ?? null,
        categoryIds: catsOk ? localCategoryIds : [],
        createdAt: prod.createdAt,
        synced: true,
        backendId: prod.id,
      });
      prodByBackend.set(prod.id, { id: newId, backendId: prod.id });
      changed = true;
    } else if (existing.synced) {
      const catChanged = catsOk && !sameIds(existing.categoryIds, localCategoryIds);
      if (existing.name !== prod.name ||
          existing.price !== prod.price ||
          (existing.einkaufspreis ?? null) !== (prod.costPrice ?? null) ||
          catChanged) {
        const upd = {
          name: prod.name,
          price: prod.price,
          einkaufspreis: prod.costPrice ?? null,
        };
        if (catsOk) upd.categoryIds = localCategoryIds;  // preserve local categories if backend lacks them
        await db.products.update(existing.id, upd);
        changed = true;
      }
    }
  }

  // backendId -> local id lookups
  const locLocalId  = id => locByBackend.get(id)?.id ?? null;
  const prodLocalId = id => prodByBackend.get(id)?.id ?? null;

  // ── Sales (+ items) ──
  const localSales    = await db.sales.toArray();
  const saleBackendIds = new Set(localSales.map(s => s.backendId).filter(Boolean));
  for (const sale of (serverSales ?? [])) {
    if (saleBackendIds.has(sale.id)) continue;
    const newSaleId = await db.sales.add({
      date: sale.date,
      locationId: locLocalId(sale.locationId),
      total: sale.total,
      createdAt: sale.createdAt ?? sale.date,
      synced: true,
      backendId: sale.id,
    });
    if (sale.items && sale.items.length) {
      await db.saleItems.bulkAdd(sale.items.map(i => ({
        saleId: newSaleId,
        productId: prodLocalId(i.productId),
        productName: i.productName,
        quantity: i.quantity,
        price: i.price,
        costPrice: i.costPrice ?? 0,
      })));
    }
    changed = true;
  }

  // ── Expenses ──
  const localExps     = await db.expenses.toArray();
  const expBackendIds = new Set(localExps.map(e => e.backendId).filter(Boolean));
  // Transitional fallback: older synced expenses have no backendId. Match them by
  // content so they get stamped instead of duplicated on the first pull.
  const legacyExps = new Map();
  localExps.filter(e => !e.backendId).forEach(e => {
    legacyExps.set(`${e.locationId}|${e.category}|${e.amount}`, e);
  });
  for (const exp of (serverExps ?? [])) {
    if (expBackendIds.has(exp.id)) continue;
    const localLoc = locLocalId(exp.locationId);
    const key = `${localLoc}|${exp.category}|${exp.amount}`;
    const legacy = legacyExps.get(key);
    if (legacy) {
      await db.expenses.update(legacy.id, { backendId: exp.id, synced: true });
      legacyExps.delete(key);
      continue;
    }
    await db.expenses.add({
      amount: exp.amount,
      category: exp.category,
      locationId: localLoc,
      note: exp.note ?? '',
      date: exp.date,
      createdAt: exp.createdAt ?? exp.date,
      synced: true,
      backendId: exp.id,
    });
    changed = true;
  }

  return changed;
}

// ── PUSH: send unsynced local records up to the backend.
export async function syncAll(onProgress) {
  if (!(await isBackendUp())) {
    throw new Error('Backend nicht erreichbar');
  }

  // 1. Locations — update if already on backend, otherwise create.
  onProgress?.('Märkte werden synchronisiert...');
  const unsyncedLocs = await db.locations.filter(l => !l.synced).toArray();
  for (const loc of unsyncedLocs) {
    if (loc.backendId) {
      await put(`/api/locations/${loc.backendId}`, {
        name: loc.name,
        closed: !!loc.closed,
        closedAt: loc.closedAt ?? null,
      });
      await db.locations.update(loc.id, { synced: true });
    } else {
      const data = await post('/api/locations', {
        name: loc.name,
        createdAt: loc.createdAt,
        closed: !!loc.closed,
        closedAt: loc.closedAt ?? null,
      });
      await db.locations.update(loc.id, { synced: true, backendId: data.id });
    }
  }

  // Build local→backend ID maps
  const allLocs = await db.locations.toArray();
  const locMap = {};
  allLocs.forEach(l => { if (l.backendId) locMap[l.id] = l.backendId; });

  // 2. Categories — update if already on backend, otherwise create.
  // Skipped gracefully if the backend has no /api/categories yet (older build).
  onProgress?.('Kategorien werden synchronisiert...');
  const unsyncedCats = await db.categories.filter(c => !c.synced).toArray();
  try {
    for (const cat of unsyncedCats) {
      const body = { name: cat.name, sortOrder: cat.sortOrder ?? 0 };
      if (cat.backendId) {
        await put(`/api/categories/${cat.backendId}`, body);
        await db.categories.update(cat.id, { synced: true });
      } else {
        const data = await post('/api/categories', { ...body, createdAt: cat.createdAt });
        await db.categories.update(cat.id, { synced: true, backendId: data.id });
      }
    }
  } catch (err) {
    console.warn(`Kategorien-Sync übersprungen (${err.message})`);
  }

  const allCats = await db.categories.toArray();
  const catMap = {};
  allCats.forEach(c => { if (c.backendId) catMap[c.id] = c.backendId; });

  // 3. Products — update if already on backend, otherwise create.
  onProgress?.('Produkte werden synchronisiert...');
  const unsyncedProds = await db.products.filter(p => !p.synced).toArray();
  for (const prod of unsyncedProds) {
    const body = {
      name: prod.name,
      price: prod.price,
      costPrice: prod.einkaufspreis ?? null,
      categoryIds: (prod.categoryIds ?? []).map(id => catMap[id]).filter(v => v != null),
    };
    if (prod.backendId) {
      await put(`/api/products/${prod.backendId}`, body);
      await db.products.update(prod.id, { synced: true });
    } else {
      const data = await post('/api/products', { ...body, createdAt: prod.createdAt });
      await db.products.update(prod.id, { synced: true, backendId: data.id });
    }
  }

  const allProds = await db.products.toArray();
  const prodMap = {};
  allProds.forEach(p => { if (p.backendId) prodMap[p.id] = p.backendId; });

  // 4. Sales
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
        costPrice: i.costPrice ?? 0,
      })),
    });
    await db.sales.update(sale.id, { synced: true, backendId: data.id });
  }

  // 5. Expenses
  onProgress?.('Ausgaben werden synchronisiert...');
  const unsyncedExps = await db.expenses.filter(e => !e.synced).toArray();
  for (const exp of unsyncedExps) {
    const backendLocationId = locMap[exp.locationId];
    if (!backendLocationId) continue;

    const data = await post('/api/expenses', {
      amount: exp.amount,
      category: exp.category,
      locationId: backendLocationId,
      note: exp.note,
      date: exp.date,
    });
    await db.expenses.update(exp.id, { synced: true, backendId: data.id });
  }

  onProgress?.('Abgeschlossen');
}

export async function countUnsynced() {
  const [locs, cats, prods, sales, exps] = await Promise.all([
    db.locations.filter(r => !r.synced).count(),
    db.categories.filter(r => !r.synced).count(),
    db.products.filter(r => !r.synced).count(),
    db.sales.filter(r => !r.synced).count(),
    db.expenses.filter(r => !r.synced).count(),
  ]);
  return locs + cats + prods + sales + exps;
}
