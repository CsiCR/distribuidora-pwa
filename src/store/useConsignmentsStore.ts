import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface Seller {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'activo' | 'inactivo';
  created_at: string;
  feed_url?: string;
}

export interface ConsignedProduct {
  id: string;
  seller_id: string;
  product_id: string;
  price: number;
  quantity: number;
  stock_sold: number;
  stock_returned: number;
  last_update: string;
}

interface ConsignmentsState {
  sellers: Seller[];
  consignedProducts: ConsignedProduct[];
  addSeller: (seller: Omit<Seller, 'id' | 'created_at'>) => void;
  updateSeller: (id: string, updates: Partial<Seller>) => void;
  deleteSeller: (id: string) => void;
  addConsignment: (consignment: Omit<ConsignedProduct, 'id' | 'last_update' | 'stock_sold' | 'stock_returned'>) => void;
  updateConsignment: (id: string, updates: Partial<ConsignedProduct>) => void;
  deleteConsignment: (id: string) => void;
  syncFeedFile: (sellerId: string, csvContent: string) => Promise<string | null>;
  clearStore: () => void;
  seedDemoConsignments: (products: any[]) => void;
}

export const useConsignmentsStore = create<ConsignmentsState>()(
  persist(
    (set, get) => ({
      sellers: [],
      consignedProducts: [],
      clearStore: () => set({ sellers: [], consignedProducts: [] }),
      
      addSeller: (sellerData) => set((state) => {
        const newSeller: Seller = {
          ...sellerData,
          id: 'sel-' + Math.random().toString(36).substring(2, 9),
          created_at: new Date().toLocaleString()
        };
        return { sellers: [...state.sellers, newSeller] };
      }),
      
      updateSeller: (id, updates) => set((state) => ({
        sellers: state.sellers.map(s => s.id === id ? { ...s, ...updates } : s)
      })),
      
      deleteSeller: (id) => set((state) => ({
        sellers: state.sellers.filter(s => s.id !== id),
        consignedProducts: state.consignedProducts.filter(cp => cp.seller_id !== id)
      })),
      
      addConsignment: (consignmentData) => set((state) => {
        // Check if product is already consigned to this seller
        const existing = state.consignedProducts.find(
          cp => cp.seller_id === consignmentData.seller_id && cp.product_id === consignmentData.product_id
        );
        
        if (existing) {
          // Accumulate quantity
          return {
            consignedProducts: state.consignedProducts.map(cp => 
              cp.id === existing.id 
                ? { 
                    ...cp, 
                    quantity: cp.quantity + consignmentData.quantity,
                    price: consignmentData.price, // update to latest price
                    last_update: new Date().toLocaleString()
                  }
                : cp
            )
          };
        }
        
        const newConsignment: ConsignedProduct = {
          ...consignmentData,
          id: 'con-' + Math.random().toString(36).substring(2, 9),
          stock_sold: 0,
          stock_returned: 0,
          last_update: new Date().toLocaleString()
        };
        return { consignedProducts: [...state.consignedProducts, newConsignment] };
      }),
      
      updateConsignment: (id, updates) => set((state) => ({
        consignedProducts: state.consignedProducts.map(cp => 
          cp.id === id 
            ? { ...cp, ...updates, last_update: new Date().toLocaleString() } 
            : cp
        )
      })),
      
      deleteConsignment: (id) => set((state) => ({
        consignedProducts: state.consignedProducts.filter(cp => cp.id !== id)
      })),
      
      syncFeedFile: async (sellerId, csvContent) => {
        try {
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const fileName = `seller-${sellerId}.csv`;
          
          // Try to upload the CSV to a bucket named 'feeds'
          const { error } = await supabase.storage
            .from('feeds')
            .upload(fileName, blob, {
              contentType: 'text/csv',
              upsert: true
            });
            
          if (error) {
            // If the error indicates bucket doesn't exist, we'll guide the user
            console.warn('Supabase storage upload error:', error.message);
            return null;
          }
          
          // Get public URL
          const { data } = supabase.storage.from('feeds').getPublicUrl(fileName);
          const publicUrl = data?.publicUrl || null;
          
          if (publicUrl) {
            get().updateSeller(sellerId, { feed_url: publicUrl });
          }
          
          return publicUrl;
        } catch (err) {
          console.error('Error syncing feed file:', err);
          return null;
        }
      },

      seedDemoConsignments: (products) => set(() => {
        const sellerId1 = 'sel-mx1ac6q';
        const sellerId2 = 'sel-brenda';
        
        const demoSellers: Seller[] = [
          {
            id: sellerId1,
            name: 'Adrián',
            phone: '+5492975131896',
            email: 'infocsicr@gmail.com',
            status: 'activo',
            created_at: new Date().toLocaleString(),
            feed_url: 'https://rvnsclqmjyirocyvwfie.supabase.co/storage/v1/object/public/feeds/seller-sel-mx1ac6q.csv'
          },
          {
            id: sellerId2,
            name: 'Brenda Promotora',
            phone: '+5491122334455',
            email: 'brenda@demo.com',
            status: 'activo',
            created_at: new Date().toLocaleString()
          }
        ];

        // Seed consigned products using the products list if available
        const demoConsigned: ConsignedProduct[] = [];
        if (products.length >= 2) {
          // Consign to Adrián:
          // Product 1: 15 consigned, 5 sold, 2 returned => 8 available
          demoConsigned.push({
            id: 'con-demo1',
            seller_id: sellerId1,
            product_id: products[0].id,
            price: products[0].prices.Minorista,
            quantity: 15,
            stock_sold: 5,
            stock_returned: 2,
            last_update: new Date().toLocaleString()
          });
          // Product 2: 10 consigned, 3 sold, 0 returned => 7 available
          // Total available = 8 + 7 = 15 u.
          demoConsigned.push({
            id: 'con-demo2',
            seller_id: sellerId1,
            product_id: products[1].id,
            price: products[1].prices.Minorista,
            quantity: 10,
            stock_sold: 3,
            stock_returned: 0,
            last_update: new Date().toLocaleString()
          });

          // Consign to Brenda:
          // Product 1: 5 consigned, 1 sold, 0 returned => 4 available
          demoConsigned.push({
            id: 'con-demo3',
            seller_id: sellerId2,
            product_id: products[0].id,
            price: products[0].prices.Minorista,
            quantity: 5,
            stock_sold: 1,
            stock_returned: 0,
            last_update: new Date().toLocaleString()
          });
        }

        return {
          sellers: demoSellers,
          consignedProducts: demoConsigned
        };
      })
    }),
    {
      name: 'consignments-storage'
    }
  )
);
