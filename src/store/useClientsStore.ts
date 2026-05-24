import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { mapAppClientToDb } from '../utils/dbMappers';

export interface Client {
  id: string;
  name: string;
  fantasy_name: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zone: string;
  price_list: 'Minorista' | 'Mayorista' | 'Distribuidor';
  visit_days: string[];
  status: 'Activo' | 'Inactivo' | 'Pendiente';
  balance: number;
  tax_condition: 'Responsable Inscripto' | 'Monotributista' | 'Consumidor Final' | 'Exento';
  credit_limit?: number;
  credential_id?: string;
}

interface ClientsStore {
  clients: Client[];
  updateBalance: (clientId: string, amount: number) => void;
  setClients: (clients: Client[] | ((prev: Client[]) => Client[])) => void;
  clearClients: () => void;
  seedDemoClients: () => void;
}

export const useClientsStore = create<ClientsStore>()(
  persist(
    (set) => ({
      clients: [
        {
          id: '1',
          name: 'Supermercado Horizonte S.A.',
          fantasy_name: 'Super Horizonte',
          cuit: '30-71234567-9',
          email: 'compras@horizonte.com',
          phone: '011 4567-8900',
          address: 'Av. Libertador 1500',
          city: 'CABA',
          zone: 'Zona Norte',
          price_list: 'Mayorista',
          visit_days: ['Lunes', 'Jueves'],
          status: 'Activo',
          balance: -154200.50,
          tax_condition: 'Responsable Inscripto',
          credit_limit: 500000
        },
        {
          id: '2',
          name: 'Kiosco El Paso',
          fantasy_name: 'El Paso',
          cuit: '20-35667788-1',
          email: 'juan.perez@gmail.com',
          phone: '11 3344-5566',
          address: 'Calle Falsa 123',
          city: 'Lomas de Zamora',
          zone: 'Zona Sur',
          price_list: 'Minorista',
          visit_days: ['Martes'],
          status: 'Activo',
          balance: 12500.00,
          tax_condition: 'Monotributista',
          credit_limit: 50000
        },
        {
          id: 'student_lucas',
          name: 'Lucas Gomez',
          fantasy_name: 'Lucas Gomez (5to A)',
          cuit: 'STUD-001',
          email: 'lucas.gomez@colegio.edu.ar',
          phone: '11 9999-0001',
          address: 'Av. Sarmiento 450',
          city: 'CABA',
          zone: 'Colegio San Martin',
          price_list: 'Minorista',
          visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
          status: 'Activo',
          balance: 0,
          tax_condition: 'Consumidor Final',
          credit_limit: 10000,
          credential_id: 'STUD-001'
        },
        {
          id: 'student_martina',
          name: 'Martina Perez',
          fantasy_name: 'Martina Perez (3ro B)',
          cuit: 'STUD-002',
          email: 'martina.perez@colegio.edu.ar',
          phone: '11 9999-0002',
          address: 'Av. Cabildo 1200',
          city: 'CABA',
          zone: 'Colegio San Martin',
          price_list: 'Minorista',
          visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
          status: 'Activo',
          balance: -2500.00,
          tax_condition: 'Consumidor Final',
          credit_limit: 15000,
          credential_id: 'STUD-002'
        },
        {
          id: 'student_mateo',
          name: 'Mateo Rodriguez',
          fantasy_name: 'Mateo Rodriguez (7mo Grado)',
          cuit: 'STUD-003',
          email: 'mateo.rodriguez@colegio.edu.ar',
          phone: '11 9999-0003',
          address: 'Av. Callao 800',
          city: 'CABA',
          zone: 'Colegio San Martin',
          price_list: 'Minorista',
          visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
          status: 'Activo',
          balance: 1200.00,
          tax_condition: 'Consumidor Final',
          credit_limit: 8000,
          credential_id: 'STUD-003'
        },
        {
          id: 'teacher_carlos',
          name: 'Profesor Carlos Alberto',
          fantasy_name: 'Prof. Carlos (Secundario)',
          cuit: 'TEACH-001',
          email: 'carlos.alberto@colegio.edu.ar',
          phone: '11 9999-0004',
          address: 'Av. Santa Fe 3400',
          city: 'CABA',
          zone: 'Colegio San Martin',
          price_list: 'Minorista',
          visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
          status: 'Activo',
          balance: -9500.00,
          tax_condition: 'Consumidor Final',
          credit_limit: 30000,
          credential_id: 'TEACH-001'
        }
      ],
      updateBalance: (clientId, amount) => set((state) => {
        const nextClients = state.clients.map(c => 
          c.id === clientId || c.fantasy_name === clientId || c.credential_id === clientId
            ? { ...c, balance: c.balance + amount } 
            : c
        );
        const updatedClient = nextClients.find(c => c.id === clientId || c.fantasy_name === clientId || c.credential_id === clientId);
        if (updatedClient) {
          Promise.resolve(supabase.from('clients').update({ balance: updatedClient.balance }).eq('id', updatedClient.id)).catch((err: any) => console.error('Error syncing client balance to Supabase:', err));
        }
        return { clients: nextClients };
      }),
      setClients: (update) => set((state) => { 
        const nextClients = typeof update === 'function' ? update(state.clients) : update;
        
        // Background sync to Supabase
        const currentIds = new Set(state.clients.map(c => c.id));
        const nextIds = new Set(nextClients.map(c => c.id));
        
        // Find deleted clients
        const deletedIds = Array.from(currentIds).filter(id => !nextIds.has(id));
        if (deletedIds.length > 0) {
          Promise.resolve(supabase.from('clients').delete().in('id', deletedIds)).catch((err: any) => console.error('Error deleting client from Supabase:', err));
        }
        
        // Upsert all updated/new clients
        if (nextClients.length > 0) {
          Promise.resolve(supabase.from('clients').upsert(nextClients.map(mapAppClientToDb))).catch((err: any) => console.error('Error syncing clients batch to Supabase:', err));
        }
        
        return { clients: nextClients };
      }),
      clearClients: () => set({ clients: [] }),
      seedDemoClients: () => set({
        clients: [
          {
            id: '1',
            name: 'Cliente Mayorista S.A.',
            fantasy_name: 'Mayorista Central',
            cuit: '30-11111111-9',
            email: 'ventas@mayorista.com',
            phone: '011 1111-1111',
            address: 'Av. Principal 100',
            city: 'Buenos Aires',
            zone: 'Centro',
            price_list: 'Mayorista',
            visit_days: ['Lunes'],
            status: 'Activo',
            balance: 0,
            tax_condition: 'Responsable Inscripto',
            credit_limit: 200000
          },
          {
            id: '2',
            name: 'Kiosco de Prueba',
            fantasy_name: 'Kiosco Demo',
            cuit: '20-22222222-1',
            email: 'demo@kiosco.com',
            phone: '11 2222-2222',
            address: 'Calle Demo 456',
            city: 'Buenos Aires',
            zone: 'Centro',
            price_list: 'Minorista',
            visit_days: ['Martes'],
            status: 'Activo',
            balance: 0,
            tax_condition: 'Monotributista',
            credit_limit: 20000
          },
          {
            id: 'student_lucas',
            name: 'Lucas Gomez',
            fantasy_name: 'Lucas Gomez (5to A)',
            cuit: 'STUD-001',
            email: 'lucas.gomez@colegio.edu.ar',
            phone: '11 9999-0001',
            address: 'Av. Sarmiento 450',
            city: 'CABA',
            zone: 'Colegio San Martin',
            price_list: 'Minorista',
            visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            status: 'Activo',
            balance: 0,
            tax_condition: 'Consumidor Final',
            credit_limit: 10000,
            credential_id: 'STUD-001'
          },
          {
            id: 'student_martina',
            name: 'Martina Perez',
            fantasy_name: 'Martina Perez (3ro B)',
            cuit: 'STUD-002',
            email: 'martina.perez@colegio.edu.ar',
            phone: '11 9999-0002',
            address: 'Av. Cabildo 1200',
            city: 'CABA',
            zone: 'Colegio San Martin',
            price_list: 'Minorista',
            visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            status: 'Activo',
            balance: -2500.00,
            tax_condition: 'Consumidor Final',
            credit_limit: 15000,
            credential_id: 'STUD-002'
          },
          {
            id: 'student_mateo',
            name: 'Mateo Rodriguez',
            fantasy_name: 'Mateo Rodriguez (7mo Grado)',
            cuit: 'STUD-003',
            email: 'mateo.rodriguez@colegio.edu.ar',
            phone: '11 9999-0003',
            address: 'Av. Callao 800',
            city: 'CABA',
            zone: 'Colegio San Martin',
            price_list: 'Minorista',
            visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            status: 'Activo',
            balance: 1200.00,
            tax_condition: 'Consumidor Final',
            credit_limit: 8000,
            credential_id: 'STUD-003'
          },
          {
            id: 'teacher_carlos',
            name: 'Profesor Carlos Alberto',
            fantasy_name: 'Prof. Carlos (Secundario)',
            cuit: 'TEACH-001',
            email: 'carlos.alberto@colegio.edu.ar',
            phone: '11 9999-0004',
            address: 'Av. Santa Fe 3400',
            city: 'CABA',
            zone: 'Colegio San Martin',
            price_list: 'Minorista',
            visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
            status: 'Activo',
            balance: -9500.00,
            tax_condition: 'Consumidor Final',
            credit_limit: 30000,
            credential_id: 'TEACH-001'
          }
        ]
      })
    }),
    {
      name: 'cristico-clients',
    }
  )
);
