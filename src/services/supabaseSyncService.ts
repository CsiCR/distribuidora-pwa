import { supabase } from '../lib/supabase';
import { useStockStore } from '../store/useStockStore';
import { useClientsStore } from '../store/useClientsStore';
import { useOrdersStore } from '../store/useOrdersStore';
import { useTransactionsStore } from '../store/useTransactionsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProvidersStore } from '../store/useProvidersStore';
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
    try {
      const { error } = await supabase.from('settings').select('id').limit(1);
      if (error) {
        // If table settings is missing (not run schema yet), but we can still connect
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return true; // Connection works, table just not initialized yet
        }
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  // Pull all data from Supabase to hydrate local stores
  async syncAll(): Promise<boolean> {
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
        useStockStore.getState().setProducts(appProducts);
      }

      // 2. Sync Clients
      const { data: clients, error: cliErr } = await supabase.from('clients').select('*');
      if (!cliErr && clients) {
        const appClients = clients.map(mapDbClientToApp);
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
        const appOrders = orders.map((o: any) => {
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
            client_id: o.client_id,
            client_name: o.client_name,
            date: o.date,
            total: Number(o.total),
            status: o.status,
            tax_condition: o.tax_condition,
            invoice_type: o.invoice_type,
            net_amount: o.net_amount ? Number(o.net_amount) : undefined,
            iva_amount: o.iva_amount ? Number(o.iva_amount) : undefined,
            observations: o.observations,
            items
          };
        });
        useOrdersStore.getState().setOrders(appOrders);
      }

      // 5. Sync Transactions
      const { data: transactions, error: txErr } = await supabase.from('transactions').select('*');
      if (!txErr && transactions) {
        const appTransactions = transactions.map((t: any) => ({
          id: t.id,
          client_id: t.client_id,
          type: t.type,
          reference: t.reference,
          amount: Number(t.amount),
          date: t.date,
          status: t.status,
          payment_method: t.payment_method,
          notes: t.notes,
          tax_condition: t.tax_condition,
          invoice_type: t.invoice_type,
          net_amount: t.net_amount ? Number(t.net_amount) : undefined,
          iva_amount: t.iva_amount ? Number(t.iva_amount) : undefined
        }));
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
        const appLogs = auditLogs.map((l: any) => ({
          id: l.id,
          item_id: l.item_id,
          item_name: l.item_name,
          type: l.type,
          quantity: l.quantity ? Number(l.quantity) : undefined,
          old_value: l.old_value,
          new_value: l.new_value,
          warehouse_source: l.warehouse_source,
          warehouse_dest: l.warehouse_dest,
          reason: l.reason,
          timestamp: l.timestamp,
          user: l.user_name
        }));
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
      await supabase.from('settings').upsert({
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

      // 2. Push products
      const products = useStockStore.getState().products;
      if (products.length > 0) {
        const dbProducts = products.map(mapAppProductToDb);
        await supabase.from('products').upsert(dbProducts);
      }

      // 3. Push clients
      const clients = useClientsStore.getState().clients;
      if (clients.length > 0) {
        const dbClients = clients.map(mapAppClientToDb);
        await supabase.from('clients').upsert(dbClients);
      }

      // 4. Push orders & order_items
      const orders = useOrdersStore.getState().orders;
      for (const order of orders) {
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
      }

      // 5. Push transactions
      const transactions = useTransactionsStore.getState().transactions;
      if (transactions.length > 0) {
        await supabase.from('transactions').upsert(transactions);
      }

      // 6. Push providers & provider documents
      const providers = useProvidersStore.getState().providers;
      if (providers.length > 0) {
        const dbProv = providers.map(mapAppProviderToDb);
        await supabase.from('providers').upsert(dbProv);
      }

      const providerInvoices = useProvidersStore.getState().invoices;
      for (const inv of providerInvoices) {
        await supabase.from('provider_invoices').upsert({
          id: inv.id,
          provider_id: inv.provider_id,
          invoice_number: inv.invoice_number,
          date: inv.date,
          warehouse: inv.warehouse,
          total_net: inv.total_net,
          total_iva: inv.total_iva,
          total: inv.total
        });

        if (inv.items && inv.items.length > 0) {
          await supabase.from('provider_invoice_items').delete().eq('invoice_id', inv.id);
          const dbItems = inv.items.map((item: any, index: number) => ({
            id: `${inv.id}-${index}`,
            invoice_id: inv.id,
            name: item.name,
            qty: item.qty,
            cost_net: item.cost_net,
            iva_rate: item.iva_rate,
            cost_final: item.cost_final
          }));
          await supabase.from('provider_invoice_items').insert(dbItems);
        }
      }

      const providerPayments = useProvidersStore.getState().payments;
      if (providerPayments.length > 0) {
        await supabase.from('provider_payments').upsert(providerPayments);
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
        await supabase.from('stock_audit_logs').upsert(dbLogs);
      }

      console.log('Local cache uploaded successfully!');
      return true;
    } catch (e) {
      console.error('Error uploading local cache to Supabase:', e);
      return false;
    }
  }
};
