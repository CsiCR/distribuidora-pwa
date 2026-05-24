import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { mapAppProductToDb } from '../utils/dbMappers';

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  short_description: string;
  long_description?: string;
  brand: string;
  category: string;
  subcategory?: string;
  presentation: string; // Ej: Botella, Caja, Pack
  net_content?: number;
  unit_measure?: string; // Ej: ml, gr, kg
  units_per_box: number;
  loose_surcharge?: number;
  warehouse: string;
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
  cost_price: number;
  iva_rate: number;
  status: 'activo' | 'inactivo';
  allow_overstock: boolean;
  only_pack_sale?: boolean;
  observations?: string;
  image_url?: string;
  margins: {
    Minorista: number;
    Mayorista: number;
    Distribuidor: number;
  };
  prices: {
    Minorista: number;
    Mayorista: number;
    Distribuidor: number;
  };
  last_update: string;
};

export interface AuditLog {
  id: string;
  item_id?: string;
  item_name: string;
  type: 'ingreso' | 'egreso' | 'transferencia' | 'precio_update' | 'info_update';
  quantity?: number;
  old_value?: string | number;
  new_value?: string | number;
  warehouse_source?: string;
  warehouse_dest?: string;
  reason: string;
  timestamp: string;
  user: string;
}

interface StockState {
  products: Product[];
  auditLogs: AuditLog[];
  addAuditLog: (log: AuditLog) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  updateStock: (id: string, change: number) => void;
  reserveStock: (id: string, quantity: number) => void;
  releaseStock: (id: string, quantity: number) => void;
  addProduct: (product: Product) => void;
  setProducts: (products: Product[] | ((prev: Product[]) => Product[])) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  clearStore: () => void;
  seedFromProfile: (products: any[]) => void;
}

const calculatePrice = (cost: number, iva: number, margin: number) => {
  return Math.round((cost * (1 + iva/100) * (1 + margin/100)) / 10) * 10;
};

export const useStockStore = create<StockState>()(
  persist(
    (set) => ({
      auditLogs: [],
      addAuditLog: (log) => set((state) => {
        Promise.resolve(
          supabase.from('stock_audit_logs').insert({
            id: log.id,
            item_id: log.item_id,
            item_name: log.item_name,
            type: log.type,
            quantity: log.quantity,
            old_value: log.old_value?.toString(),
            new_value: log.new_value?.toString(),
            warehouse_source: log.warehouse_source,
            warehouse_dest: log.warehouse_dest,
            reason: log.reason,
            timestamp: log.timestamp,
            user_name: log.user
          })
        ).catch((err: any) => console.error('Error syncing audit log to Supabase:', err));
        return { auditLogs: [log, ...state.auditLogs] };
      }),
      products: [
        {
          id: '1',
          sku: 'COR-710-X12',
          barcode: '779000000001',
          name: 'Corona 710 ml caja x 12 uni',
          short_description: 'Corona 710ml',
          brand: 'Corona',
          category: 'Cervezas',
          subcategory: 'Importadas',
          presentation: 'Caja x 12',
          units_per_box: 12,
          loose_surcharge: 15,
          warehouse: 'Deposito Central',
          stock_actual: 45,
          stock_reservado: 12,
          stock_minimo: 20,
          cost_price: 34500,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: false,
          margins: { Minorista: 30, Mayorista: 20, Distribuidor: 15 },
          prices: { 
            Minorista: calculatePrice(34500, 21, 30), 
            Mayorista: calculatePrice(34500, 21, 20), 
            Distribuidor: calculatePrice(34500, 21, 15) 
          },
          last_update: new Date().toLocaleString()
        },
        {
          id: '2',
          sku: 'PAT-VIPA-730-X6',
          barcode: '',
          name: 'Patagonia Vera Ipa 730 ml caja x 6',
          short_description: 'Patagonia Vera IPA',
          brand: 'Patagonia',
          category: 'Cervezas Artesanales',
          presentation: 'Caja x 6',
          units_per_box: 6,
          loose_surcharge: 15,
          warehouse: 'Deposito Central',
          stock_actual: 8,
          stock_reservado: 5,
          stock_minimo: 15,
          cost_price: 15800,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: false,
          margins: { Minorista: 25, Mayorista: 18, Distribuidor: 12 },
          prices: { 
            Minorista: calculatePrice(15800, 21, 25), 
            Mayorista: calculatePrice(15800, 21, 18), 
            Distribuidor: calculatePrice(15800, 21, 12) 
          },
          last_update: new Date().toLocaleString()
        },
        {
          id: 'sch_1',
          sku: 'ALF-GUAY-CHO',
          barcode: '7790001',
          name: 'Alfajor Guaymallén Chocolate',
          short_description: 'Alfajor Guaymallén',
          brand: 'Guaymallén',
          category: 'Alfajores',
          presentation: 'Unidad 40g',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 150,
          stock_reservado: 0,
          stock_minimo: 20,
          cost_price: 400,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 23.96, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 600, Mayorista: 550, Distribuidor: 500 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1548907040-4d42b52145ea?w=150&auto=format&fit=crop&q=60'
        },
        {
          id: 'sch_2',
          sku: 'JUG-BAG-NAR',
          barcode: '7790002',
          name: 'Jugo Baggio Naranja 200ml',
          short_description: 'Jugo Baggio Naranja',
          brand: 'Baggio',
          category: 'Bebidas',
          presentation: 'Cajita 200ml',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 90,
          stock_reservado: 0,
          stock_minimo: 15,
          cost_price: 480,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 20.30, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 700, Mayorista: 650, Distribuidor: 600 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=150&auto=format&fit=crop&q=60'
        },
        {
          id: 'sch_3',
          sku: 'GOL-TUR-ARC',
          barcode: '7790003',
          name: 'Turrón de Maní Arcor',
          short_description: 'Turrón de Maní',
          brand: 'Arcor',
          category: 'Golosinas',
          presentation: 'Unidad 25g',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 200,
          stock_reservado: 0,
          stock_minimo: 30,
          cost_price: 270,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 22.56, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 400, Mayorista: 350, Distribuidor: 300 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=150&auto=format&fit=crop&q=60'
        },
        {
          id: 'sch_4',
          sku: 'SNA-PAP-LAY',
          barcode: '7790004',
          name: 'Papas Fritas Lay\'s Clásicas 80g',
          short_description: 'Papas Lay\'s 80g',
          brand: 'Lay\'s',
          category: 'Snacks',
          presentation: 'Bolsa 80g',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 40,
          stock_reservado: 0,
          stock_minimo: 10,
          cost_price: 820,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 20.93, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 1200, Mayorista: 1100, Distribuidor: 1000 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=150&auto=format&fit=crop&q=60'
        },
        {
          id: 'sch_5',
          sku: 'BEB-CIN-CHO',
          barcode: '7790005',
          name: 'Chocolatada Cindor 250ml',
          short_description: 'Chocolatada Cindor',
          brand: 'Cindor',
          category: 'Bebidas',
          presentation: 'Cajita 250ml',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 60,
          stock_reservado: 0,
          stock_minimo: 12,
          cost_price: 750,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 21.13, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 1100, Mayorista: 1000, Distribuidor: 900 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=150&auto=format&fit=crop&q=60'
        },
        {
          id: 'sch_6',
          sku: 'GOL-GOM-MOG',
          barcode: '7790006',
          name: 'Gomitas Mogul Eucalipto',
          short_description: 'Gomitas Mogul',
          brand: 'Mogul',
          category: 'Golosinas',
          presentation: 'Bolsita 30g',
          units_per_box: 1,
          warehouse: 'Kiosco Colegio',
          stock_actual: 80,
          stock_reservado: 0,
          stock_minimo: 15,
          cost_price: 340,
          iva_rate: 21,
          status: 'activo',
          allow_overstock: true,
          margins: { Minorista: 21.65, Mayorista: 15, Distribuidor: 10 },
          prices: { Minorista: 500, Mayorista: 450, Distribuidor: 400 },
          last_update: new Date().toLocaleString(),
          image_url: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=150&auto=format&fit=crop&q=60'
        }
      ],
      updateProduct: (id, updates) => set((state) => {
        const nextProducts = state.products.map((p) => p.id === id ? { ...p, ...updates, last_update: new Date().toLocaleString() } : p);
        const updatedProduct = nextProducts.find(p => p.id === id);
        if (updatedProduct) {
          Promise.resolve(supabase.from('products').upsert(mapAppProductToDb(updatedProduct))).catch((err: any) => console.error('Error syncing product to Supabase:', err));
        }
        return { products: nextProducts };
      }),
      updateStock: (id, change) => set((state) => {
        const nextProducts = state.products.map((p) => p.id === id ? { 
          ...p, 
          stock_actual: p.stock_actual + change, 
          last_update: new Date().toLocaleString() 
        } : p);
        const updatedProduct = nextProducts.find(p => p.id === id);
        if (updatedProduct) {
          Promise.resolve(
            supabase.from('products').update({ 
              stock_actual: updatedProduct.stock_actual, 
              last_update: updatedProduct.last_update 
            }).eq('id', id)
          ).catch((err: any) => console.error('Error syncing stock update to Supabase:', err));
        }
        return { products: nextProducts };
      }),
      reserveStock: (id, quantity) => set((state) => {
        const nextProducts = state.products.map((p) => p.id === id ? { 
          ...p, 
          stock_reservado: p.stock_reservado + quantity, 
          last_update: new Date().toLocaleString() 
        } : p);
        const updatedProduct = nextProducts.find(p => p.id === id);
        if (updatedProduct) {
          Promise.resolve(
            supabase.from('products').update({ 
              stock_reservado: updatedProduct.stock_reservado, 
              last_update: updatedProduct.last_update 
            }).eq('id', id)
          ).catch((err: any) => console.error('Error syncing stock reservation to Supabase:', err));
        }
        return { products: nextProducts };
      }),
      releaseStock: (id, quantity) => set((state) => {
        const nextProducts = state.products.map((p) => p.id === id ? { 
          ...p, 
          stock_reservado: Math.max(0, p.stock_reservado - quantity), 
          last_update: new Date().toLocaleString() 
        } : p);
        const updatedProduct = nextProducts.find(p => p.id === id);
        if (updatedProduct) {
          Promise.resolve(
            supabase.from('products').update({ 
              stock_reservado: updatedProduct.stock_reservado, 
              last_update: updatedProduct.last_update 
            }).eq('id', id)
          ).catch((err: any) => console.error('Error syncing stock release to Supabase:', err));
        }
        return { products: nextProducts };
      }),
      addProduct: (product) => set((state) => {
        Promise.resolve(supabase.from('products').insert(mapAppProductToDb(product))).catch((err: any) => console.error('Error syncing new product to Supabase:', err));
        return { products: [...state.products, product] };
      }),
      setProducts: (newProducts) => set((state) => {
        const nextProducts = typeof newProducts === 'function' ? newProducts(state.products) : newProducts;
        
        // Sync deletions/upserts in background
        const currentIds = new Set(state.products.map(p => p.id));
        const nextIds = new Set(nextProducts.map(p => p.id));
        const deletedIds = Array.from(currentIds).filter(id => !nextIds.has(id));
        if (deletedIds.length > 0) {
          Promise.resolve(supabase.from('products').delete().in('id', deletedIds)).catch((err: any) => console.error('Error deleting products from Supabase:', err));
        }
        if (nextProducts.length > 0) {
          Promise.resolve(supabase.from('products').upsert(nextProducts.map(mapAppProductToDb))).catch((err: any) => console.error('Error syncing products batch to Supabase:', err));
        }
        
        return { products: nextProducts };
      }),
      setAuditLogs: (logs) => set({ auditLogs: logs }),
      clearStore: () => set({ products: [], auditLogs: [] }),
      seedFromProfile: (seedProducts) => {
        const calculatePrice = (cost: number, iva: number, margin: number) => {
          return Math.round((cost * (1 + iva/100) * (1 + margin/100)) / 10) * 10;
        };
        
        const products: Product[] = seedProducts.map((p, index) => ({
          id: (index + 1).toString(),
          sku: `${p.brand.slice(0,3).toUpperCase()}-${p.name.slice(0,3).toUpperCase()}-${Math.floor(Math.random()*1000)}`,
          barcode: '',
          name: p.name,
          short_description: p.name,
          brand: p.brand,
          category: p.category,
          subcategory: '',
          presentation: 'Unidad',
          units_per_box: 1,
          warehouse: 'Deposito Central',
          stock_actual: 100,
          stock_reservado: 0,
          stock_minimo: 10,
          cost_price: p.cost,
          iva_rate: 21,
          status: 'activo' as 'activo' | 'inactivo',
          allow_overstock: false,
          margins: { Minorista: 30, Mayorista: 20, Distribuidor: 15 },
          prices: { 
            Minorista: calculatePrice(p.cost, 21, 30), 
            Mayorista: calculatePrice(p.cost, 21, 20), 
            Distribuidor: calculatePrice(p.cost, 21, 15) 
          },
          last_update: new Date().toLocaleString()
        }));
        set({ products });
      }
    }),
    {
      name: 'stock-storage',
    }
  )
);
