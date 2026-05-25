import { supabase } from '../lib/supabase';
import { useStockStore } from '../store/useStockStore';
import type { AuditLog } from '../store/useStockStore';
import { useClientsStore } from '../store/useClientsStore';
import { useOrdersStore } from '../store/useOrdersStore';
import type { Order } from '../store/useOrdersStore';
import { useTransactionsStore } from '../store/useTransactionsStore';
import type { Transaction } from '../store/useTransactionsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProvidersStore } from '../store/useProvidersStore';
import { useOfflineSalesStore } from '../store/useOfflineSalesStore';
import {
  mapDbProductToApp,
  mapAppProductToDb,
  mapDbClientToApp,
  mapAppClientToDb,
  mapDbProviderToApp,
  mapAppProviderToDb
} from '../utils/dbMappers';

export const SupabaseSyncService = {
  // Check if we can connect to Supabase
  async checkConnection(): Promise<boolean> {
    const setStatus = useOfflineSalesStore.getState().setSupabaseStatus;
    
    // Check if credentials are placeholders or undefined
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
      setStatus('missing_credentials', 'Faltan configurar las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Vercel.');
      return false;
    }

    try {
      setStatus('connecting');
      const { error } = await supabase.from('settings').select('id').limit(1);
      if (error) {
        // If table settings is missing (not run schema yet), but we can still connect
        if (error.code === 'PGRST116' || error.code === '42P01') {
          setStatus('connected', null);
          return true; // Connection works, table just not initialized yet
        }
        setStatus('disconnected', error.message);
        return false;
      }
      setStatus('connected', null);
      return true;
    } catch (e: any) {
      setStatus('disconnected', e?.message || 'Error de conexión a internet');
      return false;
    }
  },

  // Pull all data from Supabase to hydrate local stores
  async syncAll(excludeOrderIds?: string[]): Promise<boolean> {
    try {
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        console.warn('Supabase offline or unreachable. Using offline local cache.');
        return false;
      }

      console.log('Synchronizing all data from Supabase...');

      // 1. Sync Products
      const { data: products, error: prodErr } = await supabase.from('products').select('*');
      if (!prodErr && products) {
        const appProducts = products.map(mapDbProductToApp);

        // Apply offline pending stock decrements
        const offlineOrders = useOfflineSalesStore.getState().offlineOrders || [];
        const pendingOrders = offlineOrders.filter(o => 
          !o.synced && (!excludeOrderIds || !excludeOrderIds.includes(o.id))
        );
        
        if (pendingOrders.length > 0) {
          pendingOrders.forEach(order => {
            order.items.forEach(item => {
              const prod = appProducts.find(p => p.id === item.id);
              if (prod) {
                prod.stock_actual = prod.stock_actual - item.quantity;
              }
            });
          });
        }

        useStockStore.getState().setProducts(appProducts);
      }

      // 2. Sync Clients
      const { data: clients, error: cliErr } = await supabase.from('clients').select('*');
      if (!cliErr && clients) {
        const appClients = clients.map(mapDbClientToApp);

        // Apply offline pending client balance adjustments (debit Cta Cte)
        const offlineOrders = useOfflineSalesStore.getState().offlineOrders || [];
        const pendingOrders = offlineOrders.filter(o => 
          !o.synced && (!excludeOrderIds || !excludeOrderIds.includes(o.id))
        );
        
        if (pendingOrders.length > 0) {
          pendingOrders.forEach(order => {
            if (order.client_id && order.credit_amount > 0) {
              const client = appClients.find(c => c.id === order.client_id);
              if (client) {
                client.balance = client.balance - order.credit_amount;
              }
            }
          });
        }

        useClientsStore.getState().setClients(appClients);
      }

      // 3. Sync Settings
      const { data: settings, error: settErr } = await supabase.from('settings').select('*').eq('id', 'global').maybeSingle();
      if (!settErr && settings) {
        const setStore = useSettingsStore.getState();
        if (settings.distributor_name) setStore.setDistributorName(settings.distributor_name);
        if (settings.cuit) setStore.setCuit(settings.cuit);
        if (settings.address) setStore.setAddress(settings.address);
        if (settings.phone) setStore.setPhone(settings.phone);
        if (settings.email) setStore.setEmail(settings.email);
        if (settings.ingresos_brutos) setStore.setIngresosBrutos(settings.ingresos_brutos);
        if (settings.init_activity) setStore.setInitActivity(settings.init_activity);
        if (settings.tax_condition) setStore.setTaxCondition(settings.tax_condition);
        if (settings.loose_unit_surcharge) setStore.setLooseUnitSurcharge(Number(settings.loose_unit_surcharge));
      }

      // 4. Sync Orders & Items
      const { data: orders, error: ordErr } = await supabase.from('orders').select('*');
      const { data: orderItems, error: itemsErr } = await supabase.from('order_items').select('*');
      if (!ordErr && orders && !itemsErr && orderItems) {
        const appOrders: Order[] = orders.map((o: any): Order => {
          const items = orderItems
            .filter((item: any) => item.order_id === o.id)
            .map((item: any) => ({
              id: item.product_id,
              name: item.name,
              quantity: Number(item.quantity),
              price: Number(item.price)
            }));
          return {
            id: o.id,
            client_id: o.client_id || undefined,
            client_name: o.client_name,
            date: o.date,
            total: Number(o.total),
            status: o.status as Order['status'],
            tax_condition: o.tax_condition || undefined,
            invoice_type: o.invoice_type ? (o.invoice_type as 'A' | 'B') : undefined,
            net_amount: o.net_amount ? Number(o.net_amount) : undefined,
            iva_amount: o.iva_amount ? Number(o.iva_amount) : undefined,
            observations: o.observations || undefined,
            items
          };
        });

        // Preserve offline pending and just-synced orders
        const localOrders = useOrdersStore.getState().orders || [];
        const pendingOrders = useOfflineSalesStore.getState().offlineOrders || [];
        const pendingUnsynced = pendingOrders.filter(o => 
          !o.synced && (!excludeOrderIds || !excludeOrderIds.includes(o.id))
        );
        
        const idsToPreserve = new Set([
          ...pendingUnsynced.map(o => o.id),
          ...(excludeOrderIds || [])
        ]);

        idsToPreserve.forEach(id => {
          const exists = appOrders.some(o => o.id === id);
          if (!exists) {
            const localOrd = localOrders.find(o => o.id === id);
            if (localOrd) {
              appOrders.push(localOrd);
            } else {
              // Reconstruct order representation from offline queue if missing
              const offOrd = pendingOrders.find(o => o.id === id);
              if (offOrd) {
                appOrders.push({
                  id: offOrd.id,
                  client_id: offOrd.client_id,
                  client_name: offOrd.client_name,
                  date: offOrd.date,
                  total: offOrd.total,
                  status: 'Entregado',
                  items: offOrd.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                  })),
                  observations: offOrd.observations || `Venta de Recreo. Modo de cobro: ${offOrd.payment_method}`
                });
              }
            }
          }
        });

        useOrdersStore.getState().setOrders(appOrders);
      }

      // 5. Sync Transactions
      const { data: transactions, error: txErr } = await supabase.from('transactions').select('*');
      if (!txErr && transactions) {
        const appTransactions: Transaction[] = transactions.map((t: any): Transaction => ({
          id: t.id,
          client_id: t.client_id,
          type: t.type as Transaction['type'],
          reference: t.reference,
          amount: Number(t.amount),
          date: t.date,
          status: t.status as Transaction['status'],
          payment_method: t.payment_method ? (t.payment_method as Transaction['payment_method']) : undefined,
          notes: t.notes || undefined,
          tax_condition: t.tax_condition || undefined,
          invoice_type: t.invoice_type ? (t.invoice_type as 'A' | 'B') : undefined,
          net_amount: t.net_amount ? Number(t.net_amount) : undefined,
          iva_amount: t.iva_amount ? Number(t.iva_amount) : undefined
        }));

        // Preserve offline pending transactions
        const offlineOrders = useOfflineSalesStore.getState().offlineOrders || [];
        const pendingOrders = offlineOrders.filter(o => 
          !o.synced && (!excludeOrderIds || !excludeOrderIds.includes(o.id))
        );

        if (pendingOrders.length > 0) {
          const clients = useClientsStore.getState().clients || [];
          pendingOrders.forEach(order => {
            if (order.client_id && order.credit_amount > 0) {
              const exists = appTransactions.some(tx => tx.reference === order.id);
              if (!exists) {
                const client = clients.find(c => c.id === order.client_id);
                if (client) {
                  const isFacturaA = client.tax_condition === 'Responsable Inscripto';
                  const net_amount = parseFloat((order.credit_amount / 1.21).toFixed(2));
                  const iva_amount = parseFloat((order.credit_amount - net_amount).toFixed(2));
                  
                  appTransactions.push({
                    id: `TX-${order.id}`,
                    client_id: order.client_id,
                    type: 'FACTURA',
                    reference: order.id,
                    amount: order.credit_amount,
                    date: order.date,
                    status: 'PENDIENTE',
                    payment_method: 'CREDITO',
                    notes: `Venta Modo Recreo ${order.id} (Cta Cte)`,
                    tax_condition: client.tax_condition,
                    invoice_type: isFacturaA ? 'A' : 'B',
                    net_amount,
                    iva_amount
                  });
                }
              }
            }
          });
        }

        useTransactionsStore.getState().setTransactions(appTransactions);
      }

      // 6. Sync Providers, Provider Invoices, Payments
      const { data: providers, error: provErr } = await supabase.from('providers').select('*');
      const { data: provInvoices, error: pInvErr } = await supabase.from('provider_invoices').select('*');
      const { data: provItems, error: pItemsErr } = await supabase.from('provider_invoice_items').select('*');
      const { data: provPayments, error: pPayErr } = await supabase.from('provider_payments').select('*');

      if (!provErr && providers && !pInvErr && provInvoices && !pItemsErr && provItems && !pPayErr && provPayments) {
        const appProviders = providers.map(mapDbProviderToApp);
        const appInvoices = provInvoices.map((inv: any) => {
          const items = provItems
            .filter((item: any) => item.invoice_id === inv.id)
            .map((item: any) => ({
              name: item.name,
              qty: Number(item.qty),
              cost_net: Number(item.cost_net),
              iva_rate: Number(item.iva_rate),
              cost_final: Number(item.cost_final)
            }));
          return {
            id: inv.id,
            provider_id: inv.provider_id,
            invoice_number: inv.invoice_number,
            date: inv.date,
            warehouse: inv.warehouse,
            total_net: Number(inv.total_net),
            total_iva: Number(inv.total_iva),
            total: Number(inv.total),
            items
          };
        });
        const appPayments = provPayments.map((p: any) => ({
          id: p.id,
          provider_id: p.provider_id,
          reference: p.reference,
          amount: Number(p.amount),
          date: p.date,
          payment_method: p.payment_method,
          notes: p.notes
        }));
        useProvidersStore.getState().setProvidersData(appProviders, appInvoices, appPayments);
      }

      // 7. Sync Audit Logs
      const { data: auditLogs, error: auditErr } = await supabase.from('stock_audit_logs').select('*');
      if (!auditErr && auditLogs) {
        const appLogs: AuditLog[] = auditLogs.map((l: any): AuditLog => ({
          id: l.id,
          item_id: l.item_id || undefined,
          item_name: l.item_name,
          type: l.type as AuditLog['type'],
          quantity: l.quantity ? Number(l.quantity) : undefined,
          old_value: l.old_value || undefined,
          new_value: l.new_value || undefined,
          warehouse_source: l.warehouse_source || undefined,
          warehouse_dest: l.warehouse_dest || undefined,
          reason: l.reason,
          timestamp: l.timestamp,
          user: l.user_name
        }));

        // Preserve offline pending audit logs
        const offlineOrders = useOfflineSalesStore.getState().offlineOrders || [];
        const pendingOrders = offlineOrders.filter(o => 
          !o.synced && (!excludeOrderIds || !excludeOrderIds.includes(o.id))
        );

        if (pendingOrders.length > 0) {
          const localLogs = useStockStore.getState().auditLogs || [];
          pendingOrders.forEach(order => {
            const orderLogs = localLogs.filter(log => log.reason?.includes(order.id));
            orderLogs.forEach(log => {
              const exists = appLogs.some(l => l.id === log.id);
              if (!exists) {
                appLogs.push(log);
              }
            });
          });
        }

        useStockStore.setState({ auditLogs: appLogs });
      }

      console.log('Synchronization complete!');
      return true;
    } catch (e) {
      console.error('Error during synchronization:', e);
      return false;
    }
  },

  // Push all local Zustand stores to Supabase (e.g. initial upload or after reconnecting)
  async pushAllLocalData(): Promise<boolean> {
    try {
      const isConnected = await this.checkConnection();
      if (!isConnected) return false;

      console.log('Uploading local cache to Supabase...');

      // 1. Push settings
      const settings = useSettingsStore.getState();
      const { error: err1 } = await supabase.from('settings').upsert({
        id: 'global',
        distributor_name: settings.distributorName,
        cuit: settings.cuit,
        tax_condition: settings.taxCondition,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        ingresos_brutos: settings.ingresosBrutos,
        init_activity: settings.initActivity,
        loose_unit_surcharge: settings.looseUnitSurcharge
      });
      if (err1) throw new Error(`[Tabla settings]: ${err1.message}`);

      // 2. Push products
      const products = useStockStore.getState().products;
      if (products.length > 0) {
        const dbProducts = products.map(mapAppProductToDb);
        const { error: err2 } = await supabase.from('products').upsert(dbProducts);
        if (err2) throw new Error(`[Tabla products]: ${err2.message}`);
      }

      // 3. Push clients
      const clients = useClientsStore.getState().clients;
      if (clients.length > 0) {
        const dbClients = clients.map(mapAppClientToDb);
        const { error: err3 } = await supabase.from('clients').upsert(dbClients);
        if (err3) throw new Error(`[Tabla clients]: ${err3.message}`);
      }

      // 4. Push orders & order_items
      const orders = useOrdersStore.getState().orders;
      for (const order of orders) {
        const { error: errOrd } = await supabase.from('orders').upsert({
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
        if (errOrd) throw new Error(`[Tabla orders, id ${order.id}]: ${errOrd.message}`);

        if (order.items && order.items.length > 0) {
          const { error: errDelItem } = await supabase.from('order_items').delete().eq('order_id', order.id);
          if (errDelItem) throw new Error(`[Tabla order_items delete, order_id ${order.id}]: ${errDelItem.message}`);
          
          const dbItems = order.items.map((item: any) => ({
            id: `${order.id}-${item.id}`,
            order_id: order.id,
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }));
          const { error: errInsItem } = await supabase.from('order_items').insert(dbItems);
          if (errInsItem) throw new Error(`[Tabla order_items insert, order_id ${order.id}]: ${errInsItem.message}`);
        }
      }

      // 5. Push transactions
      const transactions = useTransactionsStore.getState().transactions;
      if (transactions.length > 0) {
        const { error: errTx } = await supabase.from('transactions').upsert(transactions);
        if (errTx) throw new Error(`[Tabla transactions]: ${errTx.message}`);
      }

      // 6. Push providers & provider documents
      const providers = useProvidersStore.getState().providers;
      if (providers.length > 0) {
        const dbProv = providers.map(mapAppProviderToDb);
        const { error: errProv } = await supabase.from('providers').upsert(dbProv);
        if (errProv) throw new Error(`[Tabla providers]: ${errProv.message}`);
      }

      const providerInvoices = useProvidersStore.getState().invoices;
      for (const inv of providerInvoices) {
        const { error: errPInv } = await supabase.from('provider_invoices').upsert({
          id: inv.id,
          provider_id: inv.provider_id,
          invoice_number: inv.invoice_number,
          date: inv.date,
          warehouse: inv.warehouse,
          total_net: inv.total_net,
          total_iva: inv.total_iva,
          total: inv.total
        });
        if (errPInv) throw new Error(`[Tabla provider_invoices, id ${inv.id}]: ${errPInv.message}`);

        if (inv.items && inv.items.length > 0) {
          const { error: errPDelItem } = await supabase.from('provider_invoice_items').delete().eq('invoice_id', inv.id);
          if (errPDelItem) throw new Error(`[Tabla provider_invoice_items delete, invoice_id ${inv.id}]: ${errPDelItem.message}`);
          
          const dbItems = inv.items.map((item: any, index: number) => ({
            id: `${inv.id}-${index}`,
            invoice_id: inv.id,
            name: item.name,
            qty: item.qty,
            cost_net: item.cost_net,
            iva_rate: item.iva_rate,
            cost_final: item.cost_final
          }));
          const { error: errPInsItem } = await supabase.from('provider_invoice_items').insert(dbItems);
          if (errPInsItem) throw new Error(`[Tabla provider_invoice_items insert, invoice_id ${inv.id}]: ${errPInsItem.message}`);
        }
      }

      const providerPayments = useProvidersStore.getState().payments;
      if (providerPayments.length > 0) {
        const { error: errPPay } = await supabase.from('provider_payments').upsert(providerPayments);
        if (errPPay) throw new Error(`[Tabla provider_payments]: ${errPPay.message}`);
      }

      // 7. Push audit logs
      const auditLogs = useStockStore.getState().auditLogs;
      if (auditLogs.length > 0) {
        const dbLogs = auditLogs.map((l: any) => ({
          id: l.id,
          item_id: l.item_id,
          item_name: l.item_name,
          type: l.type,
          quantity: l.quantity,
          old_value: l.old_value?.toString(),
          new_value: l.new_value?.toString(),
          warehouse_source: l.warehouse_source,
          warehouse_dest: l.warehouse_dest,
          reason: l.reason,
          timestamp: l.timestamp,
          user_name: l.user
        }));
        const { error: errAudit } = await supabase.from('stock_audit_logs').upsert(dbLogs);
        if (errAudit) throw new Error(`[Tabla stock_audit_logs]: ${errAudit.message}`);
      }

      console.log('Local cache uploaded successfully!');
      return true;
    } catch (e: any) {
      console.error('Error uploading local cache to Supabase:', e);
      throw e;
    }
  },

  // Clear all remote tables in Supabase (used when resetting database via Demo Manager)
  async clearAllSupabaseData(): Promise<boolean> {
    try {
      const isConnected = await this.checkConnection();
      if (!isConnected) return false;

      console.log('Clearing all remote data from Supabase...');
      
      // Delete all records from each table
      const { error: e1 } = await supabase.from('order_items').delete().neq('id', '_dummy_');
      if (e1) throw new Error(`[Borrar order_items]: ${e1.message}`);

      const { error: e2 } = await supabase.from('orders').delete().neq('id', '_dummy_');
      if (e2) throw new Error(`[Borrar orders]: ${e2.message}`);

      const { error: e3 } = await supabase.from('transactions').delete().neq('id', '_dummy_');
      if (e3) throw new Error(`[Borrar transactions]: ${e3.message}`);

      const { error: e4 } = await supabase.from('stock_audit_logs').delete().neq('id', '_dummy_');
      if (e4) throw new Error(`[Borrar stock_audit_logs]: ${e4.message}`);

      const { error: e5 } = await supabase.from('provider_invoice_items').delete().neq('id', '_dummy_');
      if (e5) throw new Error(`[Borrar provider_invoice_items]: ${e5.message}`);

      const { error: e6 } = await supabase.from('provider_invoices').delete().neq('id', '_dummy_');
      if (e6) throw new Error(`[Borrar provider_invoices]: ${e6.message}`);

      const { error: e7 } = await supabase.from('provider_payments').delete().neq('id', '_dummy_');
      if (e7) throw new Error(`[Borrar provider_payments]: ${e7.message}`);

      const { error: e8 } = await supabase.from('products').delete().neq('id', '_dummy_');
      if (e8) throw new Error(`[Borrar products]: ${e8.message}`);

      const { error: e9 } = await supabase.from('clients').delete().neq('id', '_dummy_');
      if (e9) throw new Error(`[Borrar clients]: ${e9.message}`);

      const { error: e10 } = await supabase.from('providers').delete().neq('id', '_dummy_');
      if (e10) throw new Error(`[Borrar providers]: ${e10.message}`);

      const { error: e11 } = await supabase.from('settings').delete().neq('id', '_dummy_');
      if (e11) throw new Error(`[Borrar settings]: ${e11.message}`);
      
      console.log('All remote data cleared successfully.');
      return true;
    } catch (e: any) {
      console.error('Error clearing remote Supabase data:', e);
      throw e;
    }
  }
};
