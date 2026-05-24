import type { Product } from '../store/useStockStore';
import type { Client } from '../store/useClientsStore';
import type { Provider } from '../store/useProvidersStore';

// --- PRODUCTS ---
export function mapDbProductToApp(dbProd: any): Product {
  return {
    id: dbProd.id,
    sku: dbProd.sku || '',
    barcode: dbProd.barcode || '',
    name: dbProd.name,
    short_description: dbProd.short_description || '',
    long_description: dbProd.long_description || '',
    brand: dbProd.brand || '',
    category: dbProd.category || '',
    subcategory: dbProd.subcategory || '',
    presentation: dbProd.presentation || '',
    net_content: dbProd.net_content ? Number(dbProd.net_content) : undefined,
    unit_measure: dbProd.unit_measure || '',
    units_per_box: dbProd.units_per_box || 1,
    loose_surcharge: dbProd.loose_surcharge ? Number(dbProd.loose_surcharge) : 0,
    warehouse: dbProd.warehouse || 'Deposito Central',
    stock_actual: Number(dbProd.stock_actual || 0),
    stock_reservado: Number(dbProd.stock_reservado || 0),
    stock_minimo: Number(dbProd.stock_minimo || 0),
    cost_price: Number(dbProd.cost_price || 0),
    iva_rate: Number(dbProd.iva_rate || 21),
    status: dbProd.status === 'inactivo' ? 'inactivo' : 'activo',
    allow_overstock: !!dbProd.allow_overstock,
    only_pack_sale: !!dbProd.only_pack_sale,
    observations: dbProd.observations || '',
    image_url: dbProd.image_url || '',
    margins: {
      Minorista: Number(dbProd.margin_retail ?? 30),
      Mayorista: Number(dbProd.margin_wholesale ?? 20),
      Distribuidor: Number(dbProd.margin_distributor ?? 15),
    },
    prices: {
      Minorista: Number(dbProd.price_retail || 0),
      Mayorista: Number(dbProd.price_wholesale || 0),
      Distribuidor: Number(dbProd.price_distributor || 0),
    },
    last_update: dbProd.last_update || new Date().toLocaleString(),
  };
}

export function mapAppProductToDb(prod: Product) {
  return {
    id: prod.id,
    sku: prod.sku,
    barcode: prod.barcode,
    name: prod.name,
    short_description: prod.short_description,
    long_description: prod.long_description,
    brand: prod.brand,
    category: prod.category,
    subcategory: prod.subcategory,
    presentation: prod.presentation,
    net_content: prod.net_content,
    unit_measure: prod.unit_measure,
    units_per_box: prod.units_per_box,
    loose_surcharge: prod.loose_surcharge,
    warehouse: prod.warehouse,
    stock_actual: prod.stock_actual,
    stock_reservado: prod.stock_reservado,
    stock_minimo: prod.stock_minimo,
    cost_price: prod.cost_price,
    iva_rate: prod.iva_rate,
    status: prod.status,
    allow_overstock: prod.allow_overstock,
    only_pack_sale: prod.only_pack_sale,
    observations: prod.observations,
    image_url: prod.image_url,
    margin_retail: prod.margins.Minorista,
    margin_wholesale: prod.margins.Mayorista,
    margin_distributor: prod.margins.Distribuidor,
    price_retail: prod.prices.Minorista,
    price_wholesale: prod.prices.Mayorista,
    price_distributor: prod.prices.Distribuidor,
    last_update: prod.last_update
  };
}

// --- CLIENTS ---
export function mapDbClientToApp(dbCli: any): Client {
  return {
    id: dbCli.id,
    name: dbCli.name,
    fantasy_name: dbCli.fantasy_name || '',
    cuit: dbCli.cuit || '',
    email: dbCli.email || '',
    phone: dbCli.phone || '',
    address: dbCli.address || '',
    city: dbCli.city || '',
    zone: dbCli.zone || '',
    price_list: (dbCli.price_list as any) || 'Minorista',
    visit_days: dbCli.visit_days || [],
    status: (dbCli.status as any) || 'Activo',
    balance: Number(dbCli.balance || 0),
    tax_condition: (dbCli.tax_condition as any) || 'Consumidor Final',
    credit_limit: dbCli.credit_limit ? Number(dbCli.credit_limit) : undefined,
    credential_id: dbCli.credential_id || undefined,
  };
}

export function mapAppClientToDb(cli: Client) {
  return {
    id: cli.id,
    name: cli.name,
    fantasy_name: cli.fantasy_name,
    cuit: cli.cuit,
    email: cli.email,
    phone: cli.phone,
    address: cli.address,
    city: cli.city,
    zone: cli.zone,
    price_list: cli.price_list,
    visit_days: cli.visit_days,
    status: cli.status,
    balance: cli.balance,
    tax_condition: cli.tax_condition,
    credit_limit: cli.credit_limit,
    credential_id: cli.credential_id,
  };
}

// --- PROVIDERS ---
export function mapDbProviderToApp(dbProv: any): Provider {
  return {
    id: dbProv.id,
    name: dbProv.name,
    cuit: dbProv.cuit || '',
    tax_condition: (dbProv.tax_condition as any) || 'Responsable Inscripto',
    balance: Number(dbProv.balance || 0),
    email: dbProv.email || '',
    phone: dbProv.phone || '',
    address: dbProv.address || '',
    city: dbProv.city || '',
    status: (dbProv.status as any) || 'Activo',
  };
}

export function mapAppProviderToDb(prov: Provider) {
  return {
    id: prov.id,
    name: prov.name,
    cuit: prov.cuit,
    tax_condition: prov.tax_condition,
    balance: prov.balance,
    email: prov.email,
    phone: prov.phone,
    address: prov.address,
    city: prov.city,
    status: prov.status,
  };
}
