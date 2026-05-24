-- SEED DATA FOR DEMO
-- CRISTICO DISTRIBUCION

-- 1. Brands
insert into brands (name) values 
('Corona'), ('Quilmes'), ('Heineken'), ('Scheneider'), ('Patagonia'), ('Manush'), 
('Coca Cola'), ('Sprite'), ('Fanta'), ('Paso de los toros'), ('Levite'), ('Biofrut'), 
('Gatorade'), ('Agua Mineral'), ('Eco de los Andes'), ('Nestle'), ('Ivess'), 
('Fernet Branca'), ('Buhero'), ('Speed'), ('Vodka Skyy'), ('Vodka Sernova'), 
('Meredith'), ('Novecento'), ('Sidra 1888'), ('La Victoria'), ('Heraclito'), 
('Vino Chanchullo'), ('Carbon'), ('Lea');

-- 2. Categories
insert into categories (name) values 
('Cervezas'), ('Gaseosas'), ('Aguas y Aguas Saborizadas'), ('Isotonicas'), 
('Aperitivos'), ('Destilados'), ('Vinos y Sidras'), ('Pulpas'), ('Almacen'), 
('Lea y Carbon');

-- 3. Warehouses
insert into warehouses (name, is_main) values ('Deposito Central', true);

-- 4. Sample Products (from the image)
do $$
declare
  cerveza_id uuid;
  gaseosa_id uuid;
  corona_id uuid;
  patagonia_id uuid;
  manush_id uuid;
  coca_id uuid;
  deposito_id uuid;
begin
  select id into cerveza_id from categories where name = 'Cervezas';
  select id into gaseosa_id from categories where name = 'Gaseosas';
  select id into corona_id from brands where name = 'Corona';
  select id into patagonia_id from brands where name = 'Patagonia';
  select id into manush_id from brands where name = 'Manush';
  select id into coca_id from brands where name = 'Coca Cola';
  select id into deposito_id from warehouses where is_main = true;

  -- Corona
  insert into products (sku, barcode, name, brand_id, category_id, presentation, net_content, unit_measure, units_per_box, cost_price_net, iva_percentage)
  values ('COR-710-X12', '779000000001', 'Corona 710 ml caja x 12 uni', corona_id, cerveza_id, 'Caja', 710, 'ml', 12, 3438, 21);
  
  -- Patagonia
  insert into products (sku, barcode, name, brand_id, category_id, presentation, net_content, unit_measure, units_per_box, cost_price_net, iva_percentage)
  values ('PAT-VIPA-730-X6', '779000000002', 'Patagonia Vera Ipa 730 ml caja x 6', patagonia_id, cerveza_id, 'Caja', 730, 'ml', 6, 3132, 21);

  -- Manush (NUEVO INGRESO)
  insert into products (sku, barcode, name, brand_id, category_id, presentation, net_content, unit_measure, units_per_box, cost_price_net, iva_percentage, short_description)
  values ('MAN-IPA-473-X24', '779000000003', 'Manush IPA lata 473 Caja x 24 uni', manush_id, cerveza_id, 'Caja', 473, 'ml', 24, 2571, 21, 'NUEVO INGRESO');

  -- Coca Cola
  insert into products (sku, barcode, name, brand_id, category_id, presentation, net_content, unit_measure, units_per_box, cost_price_net, iva_percentage)
  values ('CC-225-X8', '779000000004', 'Coca Cola 2,25 lts x 8 uni', coca_id, gaseosa_id, 'Pack', 2250, 'ml', 8, 3562, 21);

  -- Initial Stock
  insert into product_stock (product_id, warehouse_id, stock_actual, stock_minimo)
  select id, deposito_id, 100, 10 from products;
end $$;
