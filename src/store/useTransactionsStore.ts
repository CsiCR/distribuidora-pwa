import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface Transaction {
  id: string;
  client_id: string;
  type: 'FACTURA' | 'PAGO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  reference: string;
  amount: number;
  date: string;
  status: 'PAGADO' | 'PENDIENTE' | 'PARCIAL';
  payment_method?: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'MERCADO_PAGO' | 'CREDITO' | 'OTRO';
  notes?: string;
  tax_condition?: string;
  invoice_type?: 'A' | 'B';
  net_amount?: number;
  iva_amount?: number;
}

interface TransactionsState {
  transactions: Transaction[];
  lastInvoiceNumber: number;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  getNextInvoiceNumber: () => string;
  getTransactionsByClient: (clientId: string) => Transaction[];
  clearTransactions: () => void;
  setTransactions: (transactions: Transaction[]) => void;
}

export const useTransactionsStore = create<TransactionsState>()(
  persist(
    (set, get) => ({
      transactions: [],
      lastInvoiceNumber: 1,
      addTransaction: (tx) => {
        const newTx: Transaction = {
          ...tx,
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toLocaleString()
        };
        
        Promise.resolve(
          supabase.from('transactions').insert({
            id: newTx.id,
            client_id: newTx.client_id,
            type: newTx.type,
            reference: newTx.reference,
            amount: newTx.amount,
            date: newTx.date,
            status: newTx.status,
            payment_method: newTx.payment_method,
            notes: newTx.notes,
            tax_condition: newTx.tax_condition,
            invoice_type: newTx.invoice_type,
            net_amount: newTx.net_amount,
            iva_amount: newTx.iva_amount
          })
        ).catch((err: any) => console.error('Error syncing transaction to Supabase:', err));

        set((state) => ({ 
          transactions: [newTx, ...state.transactions],
          lastInvoiceNumber: state.lastInvoiceNumber + 1
        }));
      },
      getNextInvoiceNumber: () => {
        const next = get().lastInvoiceNumber;
        return `FAC-${next.toString().padStart(8, '0')}`;
      },
      getTransactionsByClient: (clientId) => {
        return get().transactions.filter(t => t.client_id === clientId);
      },
      clearTransactions: () => set({ transactions: [], lastInvoiceNumber: 1 }),
      setTransactions: (transactions) => set({ transactions, lastInvoiceNumber: transactions.length + 1 })
    }),
    {
      name: 'transactions-storage',
    }
  )
);
