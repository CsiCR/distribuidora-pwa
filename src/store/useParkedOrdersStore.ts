import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './useStockStore';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

interface ParkedOrder {
  id: string;
  client_id: string | null;
  client_name: string;
  cart: CartItem[];
  timestamp: string;
}

interface ParkedOrdersState {
  parkedOrders: ParkedOrder[];
  parkOrder: (order: Omit<ParkedOrder, 'id' | 'timestamp'>) => void;
  resumeOrder: (id: string) => ParkedOrder | null;
  removeParkedOrder: (id: string) => void;
  clearParkedOrders: () => void;
}

export const useParkedOrdersStore = create<ParkedOrdersState>()(
  persist(
    (set, get) => ({
      parkedOrders: [],
      parkOrder: (orderData) => {
        const newOrder: ParkedOrder = {
          ...orderData,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleString()
        };
        set((state) => ({ parkedOrders: [newOrder, ...state.parkedOrders] }));
      },
      resumeOrder: (id) => {
        const order = get().parkedOrders.find(o => o.id === id);
        if (order) {
          set((state) => ({ parkedOrders: state.parkedOrders.filter(o => o.id !== id) }));
          return order;
        }
        return null;
      },
      removeParkedOrder: (id) => set((state) => ({
        parkedOrders: state.parkedOrders.filter(o => o.id !== id)
      })),
      clearParkedOrders: () => set({ parkedOrders: [] })
    }),
    {
      name: 'parked-orders-storage',
    }
  )
);
