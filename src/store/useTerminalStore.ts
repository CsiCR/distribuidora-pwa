import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './useStockStore';

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  isPack?: boolean;
}

interface TerminalState {
  cart: CartItem[];
  selectedClientId: string | null;
  setCart: (cart: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  setSelectedClientId: (id: string | null) => void;
  clearTerminal: () => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      cart: [],
      selectedClientId: null,
      setCart: (updater) => set((state) => ({
        cart: typeof updater === 'function' ? updater(state.cart) : updater
      })),
      setSelectedClientId: (id) => set({ selectedClientId: id }),
      clearTerminal: () => set({ cart: [], selectedClientId: null })
    }),
    {
      name: 'cristico-terminal',
    }
  )
);
