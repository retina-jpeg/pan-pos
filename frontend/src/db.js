import Dexie from 'dexie';

export const db = new Dexie('pan-pos');

db.version(1).stores({
  locations: '++id, name, synced',
  products:  '++id, name, price, synced',
  sales:     '++id, date, locationId, total, synced',
  saleItems: '++id, saleId, productId',
  expenses:  '++id, date, locationId, category, synced',
});

export async function seedDefaultData() {
  const count = await db.locations.count();
  if (count === 0) {
    const now = new Date().toISOString();
    await db.locations.bulkAdd([
      { name: 'Ana Pazar',    createdAt: now, synced: false },
      { name: 'Salı Pazarı', createdAt: now, synced: false },
      { name: 'Cuma Pazarı', createdAt: now, synced: false },
    ]);
  }
}
