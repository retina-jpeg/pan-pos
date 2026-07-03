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

// A product can belong to multiple categories: categoryId (single) → categoryIds (array).
db.version(4).stores({
  products: '++id, name, price, synced, *categoryIds',
}).upgrade(async tx => {
  await tx.table('products').toCollection().modify(p => {
    if (p.categoryIds == null) {
      p.categoryIds = (p.categoryId != null) ? [p.categoryId] : [];
    }
    delete p.categoryId;
  });
});

export async function seedDefaultData() {}
