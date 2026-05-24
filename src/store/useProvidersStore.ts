import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { mapAppProviderToDb } from '../utils/dbMappers';

export interface Provider {
  id: string; // Puede ser el CUIT o ID
  name: string;
  cuit: string;
  tax_condition: 'Responsable Inscripto' | 'Monotributista' | 'Exento';
  balance: number; // Saldo de la cuenta corriente (deuda comercial). Positivo significa deuda.
  email: string;
  phone: string;
  address: string;
  city: string;
  status: 'Activo' | 'Inactivo';
}

export interface ProviderInvoiceItem {
  name: string;
  qty: number;
  cost_net: number;
  iva_rate: number;
  cost_final: number;
}

export interface ProviderInvoice {
  id: string;
  provider_id: string;
  invoice_number: string;
  date: string;
  warehouse: string; // Depósito de destino del stock
  total_net: number;
  total_iva: number;
  total: number;
  items: ProviderInvoiceItem[];
}

export interface ProviderPayment {
  id: string;
  provider_id: string;
  reference: string;
  amount: number;
  date: string;
  payment_method: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';
  notes?: string;
}

interface ProvidersStore {
  providers: Provider[];
  invoices: ProviderInvoice[];
  payments: ProviderPayment[];
  addProvider: (provider: Provider) => void;
  updateProvider: (id: string, updated: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  addInvoice: (invoice: ProviderInvoice) => void;
  addPayment: (payment: ProviderPayment) => void;
  updateProviderBalance: (id: string, amount: number) => void;
  clearStore: () => void;
  seedDemoProviders: () => void;
  setProvidersData: (providers: Provider[], invoices: ProviderInvoice[], payments: ProviderPayment[]) => void;
}

const DEMO_PROVIDERS: Provider[] = [
  {
    id: 'prov-1',
    name: 'Cervecería y Maltería Quilmes S.A.',
    cuit: '30-50000845-9',
    tax_condition: 'Responsable Inscripto',
    balance: 154980.00,
    email: 'ventas@quilmes.com.ar',
    phone: '0800-222-7845',
    address: 'Av. Antártida Argentina 1234',
    city: 'Quilmes, Buenos Aires',
    status: 'Activo'
  },
  {
    id: 'prov-2',
    name: 'Coca-Cola Andina S.A.',
    cuit: '30-50348792-2',
    tax_condition: 'Responsable Inscripto',
    balance: 0,
    email: 'contacto@cocacola.com.ar',
    phone: '0810-888-2622',
    address: 'Av. Del Libertador 850',
    city: 'CABA',
    status: 'Activo'
  },
  {
    id: 'prov-3',
    name: 'Distribuidora Mayorista Los Primos',
    cuit: '27-31098432-8',
    tax_condition: 'Monotributista',
    balance: -25000.00, // Saldo a favor (pago por adelantado)
    email: 'losprimosdist@gmail.com',
    phone: '11-6543-9876',
    address: 'Calle Falsa 123',
    city: 'San Martin, Buenos Aires',
    status: 'Activo'
  }
];

export const useProvidersStore = create<ProvidersStore>()(
  persist(
    (set) => ({
      providers: DEMO_PROVIDERS,
      invoices: [
        {
          id: 'pinv-1',
          provider_id: 'prov-1',
          invoice_number: '0001-00023456',
          date: '2026-05-18 14:20',
          warehouse: 'Deposito Central',
          total_net: 128082.64,
          total_iva: 26897.36,
          total: 154980.00,
          items: [
            {
              name: 'Corona 710 ml x6',
              qty: 10,
              cost_net: 12808.26,
              iva_rate: 21,
              cost_final: 15498.00
            }
          ]
        }
      ],
      payments: [],
      addProvider: (provider) => set((state) => {
        Promise.resolve(supabase.from('providers').insert(mapAppProviderToDb(provider))).catch((err: any) => console.error('Error syncing provider to Supabase:', err));
        return { providers: [...state.providers, provider] };
      }),
      updateProvider: (id, updated) => set((state) => {
        const nextProviders = state.providers.map(p => p.id === id ? { ...p, ...updated } : p);
        const provider = nextProviders.find(p => p.id === id);
        if (provider) {
          Promise.resolve(supabase.from('providers').upsert(mapAppProviderToDb(provider))).catch((err: any) => console.error('Error syncing provider update to Supabase:', err));
        }
        return { providers: nextProviders };
      }),
      deleteProvider: (id) => set((state) => {
        Promise.resolve(supabase.from('providers').delete().eq('id', id)).catch((err: any) => console.error('Error deleting provider from Supabase:', err));
        return { providers: state.providers.filter(p => p.id !== id) };
      }),
      addInvoice: (invoice) => set((state) => {
        const syncInvoice = async () => {
          try {
            await supabase.from('provider_invoices').upsert({
              id: invoice.id,
              provider_id: invoice.provider_id,
              invoice_number: invoice.invoice_number,
              date: invoice.date,
              warehouse: invoice.warehouse,
              total_net: invoice.total_net,
              total_iva: invoice.total_iva,
              total: invoice.total
            });
            if (invoice.items && invoice.items.length > 0) {
              await supabase.from('provider_invoice_items').delete().eq('invoice_id', invoice.id);
              const dbItems = invoice.items.map((item: any, index: number) => ({
                id: `${invoice.id}-${index}`,
                invoice_id: invoice.id,
                name: item.name,
                qty: item.qty,
                cost_net: item.cost_net,
                iva_rate: item.iva_rate,
                cost_final: item.cost_final
              }));
              await supabase.from('provider_invoice_items').insert(dbItems);
            }
          } catch (err: any) {
            console.error('Error syncing provider invoice to Supabase:', err);
          }
        };
        syncInvoice();

        return { invoices: [invoice, ...state.invoices] };
      }),
      addPayment: (payment) => set((state) => {
        Promise.resolve(
          supabase.from('provider_payments').insert({
            id: payment.id,
            provider_id: payment.provider_id,
            reference: payment.reference,
            amount: payment.amount,
            date: payment.date,
            payment_method: payment.payment_method,
            notes: payment.notes
          })
        ).catch((err: any) => console.error('Error syncing provider payment to Supabase:', err));

        return { payments: [payment, ...state.payments] };
      }),
      updateProviderBalance: (id, amount) => set((state) => {
        const nextProviders = state.providers.map(p => p.id === id ? { ...p, balance: p.balance + amount } : p);
        const provider = nextProviders.find(p => p.id === id);
        if (provider) {
          Promise.resolve(supabase.from('providers').update({ balance: provider.balance }).eq('id', id)).catch((err: any) => console.error('Error syncing provider balance to Supabase:', err));
        }
        return { providers: nextProviders };
      }),
      clearStore: () => set({
        providers: [],
        invoices: [],
        payments: []
      }),
      seedDemoProviders: () => set({
        providers: DEMO_PROVIDERS,
        invoices: [],
        payments: []
      }),
      setProvidersData: (providers, invoices, payments) => set({
        providers,
        invoices,
        payments
      })
    }),
    {
      name: 'distribuidora-providers',
    }
  )
);
