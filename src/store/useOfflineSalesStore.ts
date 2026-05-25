import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './useStockStore';
import type { CartItem } from './useCartStore';
import { useStockStore } from './useStockStore';
import { useClientsStore } from './useClientsStore';
import { useOrdersStore } from './useOrdersStore';
import { useTransactionsStore } from './useTransactionsStore';
import { SupabaseSyncService } from '../services/supabaseSyncService';

export interface OfflineOrder {
  id: string;
  client_id?: string;
  client_name: string;
  date: string;
  items: { id: string; name: string; quantity: number; price: number }[];
  total: number;
  payment_method: 'Efectivo' | 'Cuenta Corriente' | 'Mixto';
  cash_amount: number;
  credit_amount: number;
  synced: boolean;
}

export interface OfflineCart {
  id: string;
  name: string;
  items: CartItem[];
  selectedClientId?: string;
}

interface OfflineSalesState {
  isOfflineMode: boolean;
  offlineOrders: OfflineOrder[];
  activeCarts: OfflineCart[];
  activeCartId: string;
  supabaseStatus: 'connected' | 'disconnected' | 'missing_credentials' | 'connecting';
  supabaseError: string | null;
  
  toggleOfflineMode: () => void;
  setOfflineMode: (val: boolean) => void;
  setSupabaseStatus: (status: 'connected' | 'disconnected' | 'missing_credentials' | 'connecting', error?: string | null) => void;
  
  addCartQueue: (name?: string) => string;
  removeCartQueue: (id: string) => void;
  setActiveCart: (id: string) => void;
  updateCartName: (id: string, name: string) => void;
  updateCartClient: (id: string, clientId: string | undefined) => void;
  
  addToCart: (product: Product, quantity: number) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearActiveCart: () => void;
  
  processOfflineSale: (
    paymentMethod: 'Efectivo' | 'Cuenta Corriente' | 'Mixto',
    cashPaid: number,
    creditPaid: number
  ) => { success: boolean; orderId: string };
  
  syncPendingSales: () => Promise<number>;
  clearOfflineStore: () => void;
}

export const useOfflineSalesStore = create<OfflineSalesState>()(
  persist(
    (set, get) => ({
      isOfflineMode: false,
      offlineOrders: [],
      activeCarts: [
        { id: '1', name: 'Cola 1', items: [], selectedClientId: undefined }
      ],
      activeCartId: '1',
      supabaseStatus: 'connecting',
      supabaseError: null,
      
      toggleOfflineMode: () => set((state) => ({ isOfflineMode: !state.isOfflineMode })),
      setOfflineMode: (val) => set({ isOfflineMode: val }),
      setSupabaseStatus: (status, error = null) => set({ supabaseStatus: status, supabaseError: error }),
      
      addCartQueue: (name) => {
        const id = 'cart_' + Date.now();
        const count = get().activeCarts.length + 1;
        const newCart: OfflineCart = {
          id,
          name: name || `Cola ${count}`,
          items: [],
          selectedClientId: undefined
        };
        
        set((state) => ({
          activeCarts: [...state.activeCarts, newCart],
          activeCartId: id
        }));
        
        return id;
      },
      
      removeCartQueue: (id) => {
        const activeCarts = get().activeCarts;
        if (activeCarts.length <= 1) return; // Keep at least one
        
        const filtered = activeCarts.filter(c => c.id !== id);
        let nextActiveId = get().activeCartId;
        
        if (get().activeCartId === id) {
          nextActiveId = filtered[0].id;
        }
        
        set({
          activeCarts: filtered,
          activeCartId: nextActiveId
        });
      },
      
      setActiveCart: (id) => set({ activeCartId: id }),
      
      updateCartName: (id, name) => set((state) => ({
        activeCarts: state.activeCarts.map(c => c.id === id ? { ...c, name } : c)
      })),
      
      updateCartClient: (id, clientId) => set((state) => ({
        activeCarts: state.activeCarts.map(c => c.id === id ? { ...c, selectedClientId: clientId } : c)
      })),
      
      addToCart: (product, quantity) => {
        const activeCartId = get().activeCartId;
        
        set((state) => ({
          activeCarts: state.activeCarts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            const existingItem = cart.items.find(i => i.id === product.id);
            let updatedItems;
            
            if (existingItem) {
              updatedItems = cart.items.map(item =>
                item.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              );
            } else {
              updatedItems = [...cart.items, { ...product, quantity, isPack: false }];
            }
            
            return { ...cart, items: updatedItems };
          })
        }));
      },
      
      updateCartQty: (productId, quantity) => {
        const activeCartId = get().activeCartId;
        
        set((state) => ({
          activeCarts: state.activeCarts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            return {
              ...cart,
              items: cart.items.map(item =>
                item.id === productId ? { ...item, quantity } : item
              )
            };
          })
        }));
      },
      
      removeFromCart: (productId) => {
        const activeCartId = get().activeCartId;
        
        set((state) => ({
          activeCarts: state.activeCarts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            
            return {
              ...cart,
              items: cart.items.filter(item => item.id !== productId)
            };
          })
        }));
      },
      
      clearActiveCart: () => {
        const activeCartId = get().activeCartId;
        
        set((state) => ({
          activeCarts: state.activeCarts.map(cart => {
            if (cart.id !== activeCartId) return cart;
            return { ...cart, items: [], selectedClientId: undefined };
          })
        }));
      },
      
      processOfflineSale: (paymentMethod, cashPaid, creditPaid) => {
        const activeCarts = get().activeCarts;
        const activeCartId = get().activeCartId;
        const currentCart = activeCarts.find(c => c.id === activeCartId);
        
        if (!currentCart || currentCart.items.length === 0) {
          return { success: false, orderId: '' };
        }
        
        const clientId = currentCart.selectedClientId;
        const clients = useClientsStore.getState().clients;
        const selectedClient = clients.find(c => c.id === clientId);
        const clientName = selectedClient ? (selectedClient.fantasy_name || selectedClient.name) : 'Consumidor Final';
        
        const total = currentCart.items.reduce((acc, item) => {
          const price = item.prices.Minorista || 0;
          return acc + (price * item.quantity);
        }, 0);
        
        const orderId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
        
        const newOrder: OfflineOrder = {
          id: orderId,
          client_id: clientId,
          client_name: clientName,
          date: new Date().toLocaleString('es-AR'),
          items: currentCart.items.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.prices.Minorista || 0
          })),
          total,
          payment_method: paymentMethod,
          cash_amount: paymentMethod === 'Efectivo' ? total : paymentMethod === 'Cuenta Corriente' ? 0 : cashPaid,
          credit_amount: paymentMethod === 'Cuenta Corriente' ? total : paymentMethod === 'Efectivo' ? 0 : creditPaid,
          synced: false
        };
        
        // 1. Register local offline sale
        set((state) => ({
          offlineOrders: [...state.offlineOrders, newOrder]
        }));
        
        // 2. Decrement stock levels locally
        const stockStore = useStockStore.getState();
        currentCart.items.forEach(item => {
          stockStore.updateStock(item.id, -item.quantity);
          stockStore.addAuditLog({
            id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            item_id: item.id,
            item_name: item.name,
            type: 'egreso',
            quantity: item.quantity,
            reason: `Venta Rápida Kiosco (Offline: ${orderId})`,
            timestamp: new Date().toLocaleString(),
            user: 'Kiosco Recreo'
          });
        });
        
        // 3. Update client credit account balance locally & register ledger transactions (Only for credit/debt portion)
        if (selectedClient) {
          const isFacturaA = selectedClient.tax_condition === 'Responsable Inscripto';
          
          // The actual debt amount charged to the current account
          const debtAmount = paymentMethod === 'Cuenta Corriente' ? total : (paymentMethod === 'Mixto' ? creditPaid : 0);

          if (debtAmount > 0) {
            const net_amount = parseFloat((debtAmount / 1.21).toFixed(2));
            const iva_amount = parseFloat((debtAmount - net_amount).toFixed(2));

            // Register invoice for the credit debt portion in the client's ledger history
            useTransactionsStore.getState().addTransaction({
              client_id: selectedClient.id,
              type: 'FACTURA',
              reference: orderId,
              amount: debtAmount,
              status: 'PENDIENTE',
              notes: `Venta Modo Recreo ${orderId} (Cta Cte)`,
              tax_condition: selectedClient.tax_condition,
              invoice_type: isFacturaA ? 'A' : 'B',
              net_amount,
              iva_amount
            });

            // Update client outstanding balance
            useClientsStore.getState().updateBalance(selectedClient.id, -debtAmount);
          }
        }
        
        // 4. Reset or remove active cart tab
        const currentCarts = get().activeCarts;
        if (currentCarts.length > 1) {
          get().removeCartQueue(activeCartId);
        } else {
          // If only 1 cart remains, reset its properties and set name back to 'Cola 1'
          set((state) => ({
            activeCarts: state.activeCarts.map(c => 
              c.id === activeCartId 
                ? { ...c, name: 'Cola 1', items: [], selectedClientId: undefined }
                : c
            )
          }));
        }
        
        return { success: true, orderId };
      },
      
      syncPendingSales: async () => {
        const pending = get().offlineOrders.filter(o => !o.synced);
        
        if (pending.length > 0) {
          const ordersStore = useOrdersStore.getState();
          
          pending.forEach(order => {
            ordersStore.addOrder({
              id: order.id,
              client_id: order.client_id,
              client_name: order.client_name,
              date: order.date,
              total: order.total,
              status: 'Entregado',
              items: order.items.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price
              })),
              observations: `Venta de Recreo. Modo de cobro: ${order.payment_method}`
            });
          });

          // Wait 1.2 seconds for individual background sync orders to settle
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
        
        // Push all updated local caches (stocks, client balances, transactions, audit logs) to Supabase
        await SupabaseSyncService.pushAllLocalData();
        
        // Pull latest database state to remain synchronized
        await SupabaseSyncService.syncAll();
        
        // Clear synced items to keep store light
        set((state) => ({
          offlineOrders: state.offlineOrders.filter(o => !pending.some(p => p.id === o.id))
        }));
        
        return pending.length;
      },
      
      clearOfflineStore: () => set({
        offlineOrders: [],
        activeCarts: [{ id: '1', name: 'Cola 1', items: [], selectedClientId: undefined }],
        activeCartId: '1'
      })
    }),
    {
      name: 'recess-sales-storage',
      partialize: (state) => ({
        isOfflineMode: state.isOfflineMode,
        offlineOrders: state.offlineOrders,
        activeCarts: state.activeCarts,
        activeCartId: state.activeCartId,
      }),
    }
  )
);
