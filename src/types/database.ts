export const DATABASE_VERSION = '1.0.0';

export type UserRole = 'super_admin' | 'gerente' | 'supervisor' | 'vendedor' | 'deposito' | 'cliente';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  presentation: string | null;
  units_per_box: number;
  cost_price_net: number;
  iva_percentage: number;
  short_description: string | null;
  status: 'activo' | 'inactivo' | 'sin_stock';
  only_pack_sale?: boolean;
  prices?: ProductPrice;
  stock?: ProductStock;
}

export interface ProductPrice {
  cost_price_final: number;
  list_price_net: number;
  list_price_final: number;
  wholesale_price_net: number;
  wholesale_price_final: number;
}

export interface ProductStock {
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
}

export interface Order {
  id: string;
  client_id: string;
  status: 'carrito' | 'pedido_enviado' | 'pendiente_validacion_vendedor' | 'confirmado' | 'preparando' | 'en_reparto' | 'entregado' | 'cancelado';
  total_amount: number;
  created_at: string;
}

export interface StockAuditLog {
  id: string;
  item_id: string | null;
  item_name: string;
  operation_type: 'ingreso' | 'egreso' | 'transferencia' | 'precio_update' | 'info_update';
  quantity: number | null;
  old_value: string | null;
  new_value: string | null;
  warehouse_source: string | null;
  warehouse_dest: string | null;
  reason: string | null;
  user_name: string | null;
  created_at: string;
}
