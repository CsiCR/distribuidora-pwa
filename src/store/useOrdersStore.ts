import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  client_id?: string;
  date: string;
  client_name: string;
  total: number;
  status: 'Pendiente' | 'Confirmado' | 'Entregado' | 'Cancelado' | 'Devuelto';
  items: OrderItem[];
  tax_condition?: string;
  invoice_type?: 'A' | 'B';
  net_amount?: number;
  iva_amount?: number;
  observations?: string;
}

interface OrdersStore {
  orders: Order[];
  lastOrderNumber: number;
  addOrder: (order: Order) => void;
  getNextOrderNumber: () => string;
  updateOrderStatus: (id: string, status: Order['status'], updates?: Partial<Order>) => void;
  clearOrders: () => void;
  setOrders: (orders: Order[]) => void;
}

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set, get) => ({
      orders: [
        {
          id: 'REM-0001',
          date: '2026-05-14 10:30',
          client_name: 'Supermercado Horizonte S.A.',
          total: 154200.50,
          status: 'Confirmado',
          items: [
            { id: '1', name: 'Corona 710 ml', quantity: 10, price: 4992 },
            { id: '2', name: 'Patagonia Vera Ipa', quantity: 5, price: 3790 }
          ]
        }
      ],
      lastOrderNumber: 1,
      addOrder: (order) => {
        // Sync to Supabase in the background
        const syncOrder = async () => {
          try {
            await supabase.from('orders').upsert({
              id: order.id,
              client_id: order.client_id,
              client_name: order.client_name,
              date: order.date,
              total: order.total,
              status: order.status,
              tax_condition: order.tax_condition,
              invoice_type: order.invoice_type,
              net_amount: order.net_amount,
              iva_amount: order.iva_amount,
              observations: order.observations
            });
            
            if (order.items && order.items.length > 0) {
              await supabase.from('order_items').delete().eq('order_id', order.id);
              const dbItems = order.items.map((item: any) => ({
                id: `${order.id}-${item.id}`,
                order_id: order.id,
                product_id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price
              }));
              await supabase.from('order_items').insert(dbItems);
            }
          } catch (err: any) {
            console.error('Error syncing order to Supabase:', err);
          }
        };
        syncOrder();

        set((state) => ({ 
          orders: [order, ...state.orders],
          lastOrderNumber: state.lastOrderNumber + 1
        }));
      },
      getNextOrderNumber: () => {
        const next = get().lastOrderNumber;
        return `REM-${next.toString().padStart(8, '0')}`;
      },
      updateOrderStatus: (id, status, updates) => set((state) => {
        const nextOrders = state.orders.map(o => o.id === id ? { ...o, status, ...updates } : o);
        const updatedOrder = nextOrders.find(o => o.id === id);
        if (updatedOrder) {
          Promise.resolve(
            supabase.from('orders').update({
              status,
              tax_condition: updatedOrder.tax_condition,
              invoice_type: updatedOrder.invoice_type,
              net_amount: updatedOrder.net_amount,
              iva_amount: updatedOrder.iva_amount,
              observations: updatedOrder.observations
            }).eq('id', id)
          ).catch((err: any) => console.error('Error syncing order status update to Supabase:', err));
        }
        return { orders: nextOrders };
      }),
      clearOrders: () => set({ orders: [], lastOrderNumber: 1 }),
      setOrders: (orders) => set({ orders, lastOrderNumber: orders.length + 1 })
    }),
    {
      name: 'cristico-orders',
    }
  )
);
