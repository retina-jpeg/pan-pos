import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      locationId: null,

      setLocation: (locationId) => set({ locationId }),

      addItem: (product) => {
        const items = get().items;
        const existing = items.find(i => i.product.id === product.id);
        if (existing) {
          set({ items: items.map(i =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )});
        } else {
          set({ items: [...items, { product, quantity: 1, price: product.price }] });
        }
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter(i => i.product.id !== productId) });
        } else {
          set({ items: get().items.map(i =>
            i.product.id === productId ? { ...i, quantity } : i
          )});
        }
      },

      updatePrice: (productId, price) => {
        set({ items: get().items.map(i =>
          i.product.id === productId ? { ...i, price } : i
        )});
      },

      clearCart: () => set({ items: [] }),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'pan-pos-cart' }
  )
);
