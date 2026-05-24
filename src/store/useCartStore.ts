import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './useStockStore';

export interface CartItem extends Product {
  quantity: number;
  isPack?: boolean;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity: number, isPack?: boolean) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: (clientList?: string, looseUnitSurcharge?: number) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity, isPack = false) => {
        const currentItems = get().items;
        const existingItem = currentItems.find((item) => item.id === product.id);

        if (existingItem) {
          const newIsPack = isPack || existingItem.isPack || false;
          set({
            items: currentItems.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity, isPack: newIsPack }
                : item
            ),
          });
        } else {
          set({ items: [...currentItems, { ...product, quantity, isPack }] });
        }
      },
      removeItem: (productId) =>
        set({ items: get().items.filter((item) => item.id !== productId) }),
      updateQuantity: (productId, quantity) =>
        set({
          items: get().items.map((item) =>
            item.id === productId ? { ...item, quantity } : item
          ),
        }),
      clearCart: () => set({ items: [] }),
      getTotal: (clientList = 'Minorista', looseUnitSurcharge = 15) => {
        return get().items.reduce((acc, item) => {
          const upb = item.units_per_box;
          
          if (upb <= 1) {
            const price = item.prices[clientList as keyof typeof item.prices] || item.prices.Minorista || 0;
            return acc + price * item.quantity;
          }
          
          let packPriceList = clientList;
          if (clientList === 'Minorista') {
            packPriceList = 'Mayorista';
          } else if (clientList === 'Mayorista') {
            packPriceList = 'Distribuidor';
          } else {
            packPriceList = 'Distribuidor';
          }
          
          const resolvedPackPrice = item.prices[packPriceList as keyof typeof item.prices] || item.prices[clientList as keyof typeof item.prices] || item.prices.Minorista || 0;
          const normalPackPrice = item.prices[clientList as keyof typeof item.prices] || item.prices.Minorista || 0;
          const surchargePercent = item.loose_surcharge ?? looseUnitSurcharge;
          
          const fullPacks = Math.floor(item.quantity / upb);
          const looseUnits = item.quantity % upb;
          
          const packPriceVal = Math.round((resolvedPackPrice / upb) * 100) / 100;
          const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
          
          let itemTotal = 0;
          if (item.only_pack_sale || item.isPack || item.quantity >= upb) {
            itemTotal = (fullPacks * upb * packPriceVal) + (looseUnits * loosePriceVal);
          } else {
            itemTotal = item.quantity * loosePriceVal;
          }
          
          return acc + itemTotal;
        }, 0);
      },
    }),
    {
      name: 'cristico-cart',
    }
  )
);
