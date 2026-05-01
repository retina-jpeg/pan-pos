import { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { useCartStore } from '../stores/cartStore';
import LocationSelector from '../components/LocationSelector';
import NumPad from '../components/NumPad';

function PriceCell({ item, onEdit }) {
  return (
    <button
      onClick={onEdit}
      className="text-emerald-400 text-xs font-medium active:text-emerald-300 text-left"
    >
      €{item.price}
      {item.price !== item.product.price && (
        <span className="ml-1 text-gray-500 line-through text-[10px]">€{item.product.price}</span>
      )}
    </button>
  );
}

export default function CashierPage() {
  const [products, setProducts]   = useState([]);
  const [lastSale, setLastSale]   = useState(null);
  const [editingItem, setEditingItem] = useState(null); // product.id being price-edited
  const { items, addItem, updateQuantity, updatePrice, clearCart, locationId } = useCartStore();

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  useEffect(() => {
    db.products.toArray().then(setProducts);
  }, []);

  const completeSale = useCallback(async () => {
    if (items.length === 0) return;
    if (!locationId) { alert('Lütfen pazar yeri seçin'); return; }

    const now = new Date().toISOString();
    const saleId = await db.sales.add({
      date: now,
      locationId,
      total,
      createdAt: now,
      updatedAt: now,
      synced: false,
    });

    await db.saleItems.bulkAdd(
      items.map(i => ({
        saleId,
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        price: i.price,
      }))
    );

    setLastSale({ total, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
    clearCart();
    setTimeout(() => setLastSale(null), 3000);
  }, [items, locationId, total, clearCart]);

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left: product grid */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
        <div className="px-3 py-2 bg-white border-b border-gray-200">
          <LocationSelector />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {lastSale && (
            <div className="mb-3 p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 font-medium text-center">
              Satış tamamlandı — {lastSale.itemCount} ürün · €{lastSale.total.toFixed(2)}
            </div>
          )}

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-2xl">📦</p>
              <p className="text-lg mt-2">Henüz ürün eklenmedi</p>
              <p className="text-sm mt-1">Ürünler sayfasından ekleyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {products.map(product => {
                const cartItem = items.find(i => i.product.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addItem(product)}
                    className={`relative bg-white rounded-2xl p-4 text-left shadow-sm border-2 transition-all active:scale-95 ${
                      cartItem ? 'border-emerald-500' : 'border-transparent'
                    }`}
                  >
                    {cartItem && (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {cartItem.quantity}
                      </span>
                    )}
                    <div className="font-bold text-gray-800 text-base leading-tight">{product.name}</div>
                    <div className="text-emerald-600 font-bold text-xl mt-1">€{product.price}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="w-72 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-3 font-bold text-base border-b border-gray-700 text-gray-200">
          Sepet {items.length > 0 && `(${items.reduce((s, i) => s + i.quantity, 0)} ürün)`}
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Ürün seçin
            </div>
          ) : (
            items.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.product.name}</div>
                  <PriceCell item={item} onEdit={() => setEditingItem(item.product.id)} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-7 h-7 bg-gray-700 rounded-lg text-sm font-bold active:bg-gray-600 flex items-center justify-center"
                  >−</button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-7 h-7 bg-gray-700 rounded-lg text-sm font-bold active:bg-gray-600 flex items-center justify-center"
                  >+</button>
                </div>
                <div className="text-right w-14 font-bold text-sm shrink-0">
                  €{(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700 shrink-0">
          <div className="flex justify-between items-baseline mb-4">
            <span className="text-gray-400 text-sm">TOPLAM</span>
            <span className="text-3xl font-bold text-emerald-400">€{total.toFixed(2)}</span>
          </div>
          <button
            onClick={completeSale}
            disabled={items.length === 0}
            className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl disabled:opacity-30 active:bg-emerald-700 transition-colors mb-2"
          >
            Satışı Tamamla
          </button>
          <button
            onClick={clearCart}
            disabled={items.length === 0}
            className="w-full py-2.5 bg-gray-700 text-gray-300 font-medium rounded-xl disabled:opacity-30 active:bg-gray-600 transition-colors text-sm"
          >
            Temizle
          </button>
        </div>
      </div>

      {editingItem && (() => {
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
