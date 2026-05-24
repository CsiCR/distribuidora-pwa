import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

const pushSetting = (updates: any) => {
  Promise.resolve(supabase.from('settings').upsert({ id: 'global', ...updates })).catch((err: any) => console.error('Error syncing settings update to Supabase:', err));
};

interface SettingsState {
  distributorName: string;
  cuit: string;
  address: string;
  phone: string;
  email: string;
  ingresosBrutos: string;
  initActivity: string;
  taxCondition: string;
  looseUnitSurcharge: number;
  setDistributorName: (name: string) => void;
  setCuit: (cuit: string) => void;
  setAddress: (address: string) => void;
  setPhone: (phone: string) => void;
  setEmail: (email: string) => void;
  setIngresosBrutos: (ib: string) => void;
  setInitActivity: (date: string) => void;
  setTaxCondition: (condition: string) => void;
  setLooseUnitSurcharge: (surcharge: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      distributorName: 'CRÍSTICO DISTRIBUIDORA',
      cuit: '30-71122334-9',
      address: 'Av. Principal 100, CABA',
      phone: '11 2222-3333',
      email: 'info@distribuidora.com',
      ingresosBrutos: '30-71122334-9',
      initActivity: '01/01/2020',
      taxCondition: 'Responsable Inscripto',
      looseUnitSurcharge: 15,
      setDistributorName: (name) => {
        pushSetting({ distributor_name: name });
        set({ distributorName: name });
      },
      setCuit: (cuit) => {
        pushSetting({ cuit });
        set({ cuit });
      },
      setAddress: (address) => {
        pushSetting({ address });
        set({ address });
      },
      setPhone: (phone) => {
        pushSetting({ phone });
        set({ phone });
      },
      setEmail: (email) => {
        pushSetting({ email });
        set({ email });
      },
      setIngresosBrutos: (ingresosBrutos) => {
        pushSetting({ ingresos_brutos: ingresosBrutos });
        set({ ingresosBrutos });
      },
      setInitActivity: (initActivity) => {
        pushSetting({ init_activity: initActivity });
        set({ initActivity });
      },
      setTaxCondition: (taxCondition) => {
        pushSetting({ tax_condition: taxCondition });
        set({ taxCondition });
      },
      setLooseUnitSurcharge: (looseUnitSurcharge) => {
        pushSetting({ loose_unit_surcharge: looseUnitSurcharge });
        set({ looseUnitSurcharge });
      },
    }),
    {
      name: 'settings-storage',
    }
  )
);
