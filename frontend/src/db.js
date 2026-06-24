import Dexie from 'dexie';

export const db = new Dexie('pan-pos');

db.version(1).stores({
  locations: '++id, name, synced',
  products:  '++id, name, price, synced',
  sales:     '++id, date, locationId, total, synced',
  saleItems: '++id, saleId, productId',
  expenses:  '++id, date, locationId, category, synced',
});

db.version(2).stores({
  locations: '++id, name, synced, closed',
});

db.version(3).stores({
  categories: '++id, name, sortOrder, synced',
  products:   '++id, name, price, synced, categoryId',
});

export async function seedDefaultData() {}
