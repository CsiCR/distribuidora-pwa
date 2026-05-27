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
}

export const useConsignmentsStore = create<ConsignmentsState>()(
  persist(
    (set, get) => ({
      sellers: [],
      consignedProducts: [],
      
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
      }
    }),
    {
      name: 'consignments-storage'
    }
  )
);
