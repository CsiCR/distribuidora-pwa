-- CRÍSTICO DISTRIBUCION - COMPREHENSIVE SUPABASE SCHEMA
-- Autor: Antigravity AI
-- Regional: Argentina (ARS, UTC-3)

-- 1. PRODUCTS
create table products (
  id text primary key,
  sku text,
  barcode text,
  name text not null,
  short_description text,
  long_description text,
  brand text,
  category text,
  subcategory text,
  presentation text,
  net_content numeric,
  unit_measure text,
  units_per_box integer default 1,
  loose_surcharge numeric default 0,
  warehouse text default 'Deposito Central',
  stock_actual numeric default 0,
  stock_reservado numeric default 0,
  stock_minimo numeric default 0,
  cost_price numeric default 0,
  iva_rate numeric default 21,
  status text default 'activo', -- 'activo' | 'inactivo'
  allow_overstock boolean default false,
  only_pack_sale boolean default false,
  observations text,
  image_url text,
  
  -- Margins & Pre-calculated Prices
  margin_retail numeric default 30,
  margin_wholesale numeric default 20,
  margin_distributor numeric default 15,
  price_retail numeric default 0,
  price_wholesale numeric default 0,
  price_distributor numeric default 0,
  
  last_update text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Disable RLS for ease of use in local/online demo
alter table products disable row level security;

-- 2. CLIENTS
create table clients (
  id text primary key,
  name text not null, -- Razón Social
  fantasy_name text, -- Nombre Comercial
  cuit text,
  email text,
  phone text,
  address text,
  city text,
  zone text,
  price_list text default 'Minorista', -- Minorista, Mayorista, Distribuidor
  visit_days text[], -- Array of strings e.g. {'Lunes', 'Martes'}
  status text default 'Activo', -- Activo, Inactivo, Pendiente
  balance numeric default 0,
  tax_condition text default 'Consumidor Final', -- Responsable Inscripto, Monotributista, etc.
  credit_limit numeric default 10000,
  credential_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table clients disable row level security;

-- 3. ORDERS
create table orders (
  id text primary key,
  client_id text references clients(id) on delete set null,
  client_name text,
  date text, -- String formatted date (e.g. '2026-05-14 10:30')
  total numeric default 0,
  status text default 'Pendiente', -- Pendiente, Confirmado, Entregado, Cancelado, Devuelto
  tax_condition text,
  invoice_type text, -- A, B
  net_amount numeric default 0,
  iva_amount numeric default 0,
  observations text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table orders disable row level security;

-- 4. ORDER ITEMS
create table order_items (
  id text primary key, -- generated client-side or randomly
  order_id text references orders(id) on delete cascade not null,
  product_id text,
  name text,
  quantity numeric default 1,
  price numeric default 0,
  created_at timestamptz default now()
);

alter table order_items disable row level security;

-- 5. TRANSACTIONS (Client ledger)
create table transactions (
  id text primary key, -- client-side random string or uuid
  client_id text references clients(id) on delete cascade not null,
  type text not null, -- FACTURA, PAGO, NOTA_CREDITO, NOTA_DEBITO
  date text, -- String date
  reference text,
  amount numeric default 0,
  status text default 'PAGADO', -- PENDIENTE, PAGADO, PARCIAL
  payment_method text, -- EFECTIVO, TRANSFERENCIA, CHEQUE, MERCADO_PAGO, CREDITO, OTRO
  notes text,
  tax_condition text,
  invoice_type text, -- A, B
  net_amount numeric default 0,
  iva_amount numeric default 0,
  created_at timestamptz default now()
);

alter table transactions disable row level security;

-- 6. STOCK AUDIT LOGS
create table stock_audit_logs (
  id text primary key,
  item_id text,
  item_name text not null,
  type text not null, -- ingreso, egreso, transferencia, precio_update, info_update
  quantity numeric,
  old_value text,
  new_value text,
  warehouse_source text,
  warehouse_dest text,
  reason text,
  timestamp text,
  user_name text,
  created_at timestamptz default now()
);

alter table stock_audit_logs disable row level security;

-- 7. GLOBAL SETTINGS
create table settings (
  id text primary key default 'global',
  distributor_name text default 'Cristico',
  cuit text,
  tax_condition text default 'Monotributista',
  address text,
  phone text,
  email text,
  ingresos_brutos text,
  init_activity text,
  loose_unit_surcharge numeric default 10,
  updated_at timestamptz default now()
);

alter table settings disable row level security;

-- 8. PROVIDERS
create table providers (
  id text primary key,
  name text not null,
  cuit text,
  tax_condition text default 'Responsable Inscripto', -- Responsable Inscripto, Monotributista, Exento
  balance numeric default 0,
  email text,
  phone text,
  address text,
  city text,
  status text default 'Activo', -- Activo, Inactivo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table providers disable row level security;

-- 9. PROVIDER INVOICES
create table provider_invoices (
  id text primary key,
  provider_id text references providers(id) on delete set null,
  invoice_number text not null,
  date text,
  warehouse text default 'Deposito Central',
  total_net numeric default 0,
  total_iva numeric default 0,
  total numeric default 0,
  created_at timestamptz default now()
);

alter table provider_invoices disable row level security;

-- 10. PROVIDER INVOICE ITEMS
create table provider_invoice_items (
  id text primary key,
  invoice_id text references provider_invoices(id) on delete cascade not null,
  name text not null,
  qty numeric default 1,
  cost_net numeric default 0,
  iva_rate numeric default 21,
  cost_final numeric default 0,
  created_at timestamptz default now()
);

alter table provider_invoice_items disable row level security;

-- 11. PROVIDER PAYMENTS
create table provider_payments (
  id text primary key,
  provider_id text references providers(id) on delete set null,
  reference text,
  amount numeric default 0,
  date text,
  payment_method text default 'EFECTIVO', -- EFECTIVO, TRANSFERENCIA, CHEQUE, OTRO
  notes text,
  created_at timestamptz default now()
);

alter table provider_payments disable row level security;


