import { subDays, format } from 'date-fns';
import type { Product } from '../store/useStockStore';
import type { Client } from '../store/useClientsStore';
import type { Provider, ProviderInvoice, ProviderPayment } from '../store/useProvidersStore';
import type { Order } from '../store/useOrdersStore';
import type { Transaction } from '../store/useTransactionsStore';

const calculatePrice = (cost: number, iva: number, margin: number) => {
  return Math.round((cost * (1 + iva / 100) * (1 + margin / 100)) / 10) * 10;
};

const getDateStr = (daysAgo: number, timeStr: string) => {
  const d = subDays(new Date(), daysAgo);
  return `${format(d, 'yyyy-MM-dd')} ${timeStr}`;
};

export const generateDemoData = (profileProducts: any[]) => {
  // 1. Generate Products (ensure normal, low stock, out of stock and overstock)
  const products: Product[] = profileProducts.map((p, index) => {
    const cost = p.cost;
    const id = (index + 1).toString();
    
    // Distribute stock states for demo variety
    let stock_actual = 50;
    let stock_minimo = 15;
    let stock_reservado = 0;

    if (index === 0) {
      stock_actual = 45;
      stock_minimo = 15;
      stock_reservado = 12;
    } else if (index === 1) {
      stock_actual = 8;
      stock_minimo = 15;
      stock_reservado = 5;
    } else if (index === 2) {
      stock_actual = 0;
      stock_minimo = 10;
      stock_reservado = 0;
    } else if (index === 3) {
      stock_actual = 120;
      stock_minimo = 20;
      stock_reservado = 0;
    }

    return {
      id,
      sku: `${p.brand.slice(0, 3).toUpperCase()}-${p.name.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      barcode: `77900000000${id}`,
      name: p.name,
      short_description: p.name,
      brand: p.brand,
      category: p.category,
      subcategory: '',
      presentation: 'Unidad',
      units_per_box: 1,
      loose_surcharge: 15,
      warehouse: 'Deposito Central',
      stock_actual,
      stock_reservado,
      stock_minimo,
      cost_price: cost,
      iva_rate: 21,
      status: 'activo' as 'activo' | 'inactivo',
      allow_overstock: false,
      margins: { Minorista: 30, Mayorista: 20, Distribuidor: 15 },
      prices: {
        Minorista: calculatePrice(cost, 21, 30),
        Mayorista: calculatePrice(cost, 21, 20),
        Distribuidor: calculatePrice(cost, 21, 15)
      },
      last_update: getDateStr(0, '09:00')
    };
  });

  // Ensure we have at least 4 products in list to map properly
  while (products.length < 4) {
    const id = (products.length + 1).toString();
    products.push({
      id,
      sku: `GEN-PROD-${id}`,
      barcode: `77900000000${id}`,
      name: `Producto Genérico ${id}`,
      short_description: `Prod Genérico ${id}`,
      brand: 'Genérico',
      category: 'Otros',
      presentation: 'Unidad',
      units_per_box: 1,
      loose_surcharge: 15,
      warehouse: 'Deposito Central',
      stock_actual: 50,
      stock_reservado: 0,
      stock_minimo: 10,
      cost_price: 1000,
      iva_rate: 21,
      status: 'activo',
      allow_overstock: false,
      margins: { Minorista: 30, Mayorista: 20, Distribuidor: 15 },
      prices: { Minorista: 1570, Mayorista: 1450, Distribuidor: 1390 },
      last_update: getDateStr(0, '09:00')
    });
  }

  // 2. Define standard Clients (including school students/teachers for Recess terminal)
  const clients: Client[] = [
    {
      id: 'student_1',
      name: 'Lucas Alarcón',
      fantasy_name: 'Lucas Alarcón (5to Año)',
      cuit: '1001',
      email: 'lucas@colegio.edu.ar',
      phone: '11 9999-8888',
      address: 'Recreo',
      city: 'Lomas de Zamora',
      zone: 'Recreo',
      price_list: 'Minorista',
      visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
      status: 'Activo',
      balance: -2500,
      tax_condition: 'Consumidor Final',
      credit_limit: 8000,
      credential_id: '1001'
    },
    {
      id: 'student_2',
      name: 'Martina Gómez',
      fantasy_name: 'Martina Gómez (3er Año)',
      cuit: '1002',
      email: 'martina@colegio.edu.ar',
      phone: '11 7777-6666',
      address: 'Recreo',
      city: 'Lomas de Zamora',
      zone: 'Recreo',
      price_list: 'Minorista',
      visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
      status: 'Activo',
      balance: 1500,
      tax_condition: 'Consumidor Final',
      credit_limit: 5000,
      credential_id: '1002'
    },
    {
      id: 'teacher_1',
      name: 'Carlos Espósito',
      fantasy_name: 'Prof. Carlos Espósito (Primaria)',
      cuit: '2001',
      email: 'carlos.esposito@colegio.edu.ar',
      phone: '11 5555-4444',
      address: 'Recreo',
      city: 'Lomas de Zamora',
      zone: 'Recreo',
      price_list: 'Minorista',
      visit_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
      status: 'Activo',
      balance: 0,
      tax_condition: 'Monotributista',
      credit_limit: 15000,
      credential_id: '2001'
    },
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
      balance: 0, // Will compute dynamically
      tax_condition: 'Responsable Inscripto'
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
      balance: 0, // Will compute dynamically
      tax_condition: 'Monotributista'
    },
    {
      id: '3',
      name: 'Minimercado San Jorge',
      fantasy_name: 'San Jorge',
      cuit: '23-45678901-9',
      email: 'contacto@sanjorge.com',
      phone: '11 5566-7788',
      address: 'Av. San Martín 2300',
      city: 'Avellaneda',
      zone: 'Zona Sur',
      price_list: 'Distribuidor',
      visit_days: ['Miércoles', 'Sábado'],
      status: 'Activo',
      balance: 0, // Will compute dynamically
      tax_condition: 'Responsable Inscripto'
    }
  ];

  // 3. Define standard Providers
  const providers: Provider[] = [
    {
      id: 'prov-1',
      name: 'Cervecería y Maltería Quilmes S.A.',
      cuit: '30-50000845-9',
      tax_condition: 'Responsable Inscripto',
      balance: 0, // Will compute dynamically
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
      balance: 0, // Will compute dynamically
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
      balance: 0, // Will compute dynamically
      email: 'losprimosdist@gmail.com',
      phone: '11-6543-9876',
      address: 'Calle Falsa 123',
      city: 'San Martin, Buenos Aires',
      status: 'Activo'
    }
  ];

  // Calculate prices based on list
  const p1_may = products[0].prices.Mayorista;
  const p2_may = products[1].prices.Mayorista;
  const p1_min = products[0].prices.Minorista;
  const p2_min = products[1].prices.Minorista;
  const p3_dist = products[2].prices.Distribuidor;
  const p4_dist = products[3].prices.Distribuidor;

  // 4. Generate Orders (5 days of movements)
  const orders: Order[] = [
    // 4 days ago
    {
      id: 'REM-0001',
      date: getDateStr(4, '10:30'),
      client_name: 'Super Horizonte',
      total: (p1_may * 20) + (p2_may * 10),
      status: 'Entregado',
      items: [
        { id: products[0].id, name: products[0].name, quantity: 20, price: p1_may },
        { id: products[1].id, name: products[1].name, quantity: 10, price: p2_may }
      ]
    },
    // 3 days ago
    {
      id: 'REM-0002',
      date: getDateStr(3, '14:20'),
      client_name: 'El Paso',
      total: (p1_min * 5) + (p2_min * 2),
      status: 'Entregado',
      items: [
        { id: products[0].id, name: products[0].name, quantity: 5, price: p1_min },
        { id: products[1].id, name: products[1].name, quantity: 2, price: p2_min }
      ]
    },
    // 2 days ago
    {
      id: 'REM-0003',
      date: getDateStr(2, '15:45'),
      client_name: 'El Paso',
      total: (p1_min * 8) + (p2_min * 5),
      status: 'Confirmado',
      items: [
        { id: products[0].id, name: products[0].name, quantity: 8, price: p1_min },
        { id: products[1].id, name: products[1].name, quantity: 5, price: p2_min }
      ]
    },
    // 1 day ago
    {
      id: 'REM-0004',
      date: getDateStr(1, '09:15'),
      client_name: 'San Jorge',
      total: (p3_dist * 15) + (p4_dist * 10),
      status: 'Entregado',
      items: [
        { id: products[2].id, name: products[2].name, quantity: 15, price: p3_dist },
        { id: products[3].id, name: products[3].name, quantity: 10, price: p4_dist }
      ]
    },
    // Today
    {
      id: 'REM-0005',
      date: getDateStr(0, '10:15'),
      client_name: 'Super Horizonte',
      total: (p1_may * 10) + (p4_dist * 5),
      status: 'Confirmado',
      items: [
        { id: products[0].id, name: products[0].name, quantity: 10, price: p1_may },
        { id: products[3].id, name: products[3].name, quantity: 5, price: p4_dist }
      ]
    },
    // Today (Cancelled)
    {
      id: 'REM-0006',
      date: getDateStr(0, '11:15'),
      client_name: 'El Paso',
      total: p1_min * 4,
      status: 'Cancelado',
      items: [
        { id: products[0].id, name: products[0].name, quantity: 4, price: p1_min }
      ]
    }
  ];

  // 5. Generate Client Transactions (Invoices and Payments)
  const transactions: Transaction[] = [
    // Invoice 1 (Super Horizonte - Order REM-0001)
    {
      id: 'tx-1',
      client_id: '1',
      type: 'FACTURA',
      reference: 'FAC-00000001',
      amount: orders[0].total,
      date: getDateStr(4, '10:30'),
      status: 'PARCIAL',
      notes: 'Venta vinculada a REM-0001',
      tax_condition: 'Responsable Inscripto',
      invoice_type: 'A',
      net_amount: Math.round(orders[0].total / 1.21),
      iva_amount: Math.round(orders[0].total - (orders[0].total / 1.21))
    },
    // Invoice 2 (El Paso - Order REM-0002)
    {
      id: 'tx-2',
      client_id: '2',
      type: 'FACTURA',
      reference: 'FAC-00000002',
      amount: orders[1].total,
      date: getDateStr(3, '14:20'),
      status: 'PAGADO',
      notes: 'Venta vinculada a REM-0002',
      tax_condition: 'Monotributista',
      invoice_type: 'B',
      net_amount: Math.round(orders[1].total / 1.21),
      iva_amount: Math.round(orders[1].total - (orders[1].total / 1.21))
    },
    // Client Payment 1 (El Paso pays Invoice 2)
    {
      id: 'tx-pay-1',
      client_id: '2',
      type: 'PAGO',
      reference: 'Recibo MP-1049',
      amount: orders[1].total,
      date: getDateStr(2, '11:00'),
      status: 'PAGADO',
      payment_method: 'TRANSFERENCIA',
      notes: 'Pago total factura FAC-00000002'
    },
    // Invoice 3 (El Paso - Order REM-0003)
    {
      id: 'tx-3',
      client_id: '2',
      type: 'FACTURA',
      reference: 'FAC-00000003',
      amount: orders[2].total,
      date: getDateStr(2, '15:45'),
      status: 'PENDIENTE',
      notes: 'Venta vinculada a REM-0003',
      tax_condition: 'Monotributista',
      invoice_type: 'B',
      net_amount: Math.round(orders[2].total / 1.21),
      iva_amount: Math.round(orders[2].total - (orders[2].total / 1.21))
    },
    // Client Payment 2 (Super Horizonte pays part of Invoice 1)
    {
      id: 'tx-pay-2',
      client_id: '1',
      type: 'PAGO',
      reference: 'Efectivo en Caja',
      amount: 80000,
      date: getDateStr(2, '16:00'),
      status: 'PAGADO',
      payment_method: 'EFECTIVO',
      notes: 'Pago parcial factura FAC-00000001'
    },
    // Invoice 4 (San Jorge - Order REM-0004)
    {
      id: 'tx-4',
      client_id: '3',
      type: 'FACTURA',
      reference: 'FAC-00000004',
      amount: orders[3].total,
      date: getDateStr(1, '09:15'),
      status: 'PENDIENTE',
      notes: 'Venta vinculada a REM-0004',
      tax_condition: 'Responsable Inscripto',
      invoice_type: 'A',
      net_amount: Math.round(orders[3].total / 1.21),
      iva_amount: Math.round(orders[3].total - (orders[3].total / 1.21))
    },
    // Client Payment 3 (San Jorge pays Invoice 4 + extra credit)
    {
      id: 'tx-pay-3',
      client_id: '3',
      type: 'PAGO',
      reference: 'Transf Galicia 8493',
      amount: orders[3].total + 25000, // Pays invoice plus 25000 credit
      date: getDateStr(1, '12:00'),
      status: 'PAGADO',
      payment_method: 'TRANSFERENCIA',
      notes: 'Pago FAC-00000004 y saldo a favor'
    },
    // Invoice 5 (Super Horizonte - Order REM-0005)
    {
      id: 'tx-5',
      client_id: '1',
      type: 'FACTURA',
      reference: 'FAC-00000005',
      amount: orders[4].total,
      date: getDateStr(0, '10:15'),
      status: 'PENDIENTE',
      notes: 'Venta vinculada a REM-0005',
      tax_condition: 'Responsable Inscripto',
      invoice_type: 'A',
      net_amount: Math.round(orders[4].total / 1.21),
      iva_amount: Math.round(orders[4].total - (orders[4].total / 1.21))
    }
  ];

  // Calculate client balances dynamically
  // balance = payments - invoices
  clients.forEach(c => {
    const clientTxs = transactions.filter(t => t.client_id === c.id);
    let bal = 0;
    clientTxs.forEach(t => {
      if (t.type === 'PAGO' || t.type === 'NOTA_CREDITO') {
        bal += t.amount;
      } else {
        bal -= t.amount;
      }
    });
    c.balance = bal;
  });

  // 6. Generate Provider Invoices (Compras)
  const providerInvoices: ProviderInvoice[] = [
    // Invoice 1 (Quilmes)
    {
      id: 'pinv-1',
      provider_id: 'prov-1',
      invoice_number: '0001-00023456',
      date: getDateStr(4, '09:00'),
      warehouse: 'Deposito Central',
      total_net: 128082.64,
      total_iva: 26897.36,
      total: 154980.00,
      items: [
        {
          name: products[0].name,
          qty: 50,
          cost_net: products[0].cost_price,
          iva_rate: 21,
          cost_final: products[0].cost_price * 1.21
        }
      ]
    },
    // Invoice 2 (Coca-Cola)
    {
      id: 'pinv-2',
      provider_id: 'prov-2',
      invoice_number: '0005-00011244',
      date: getDateStr(3, '11:00'),
      warehouse: 'Deposito Central',
      total_net: 70247.93,
      total_iva: 14752.07,
      total: 85000.00,
      items: [
        {
          name: products[1].name,
          qty: 30,
          cost_net: products[1].cost_price,
          iva_rate: 21,
          cost_final: products[1].cost_price * 1.21
        }
      ]
    },
    // Invoice 3 (Los Primos)
    {
      id: 'pinv-3',
      provider_id: 'prov-3',
      invoice_number: '0002-00008431',
      date: getDateStr(1, '08:30'),
      warehouse: 'Deposito Central',
      total_net: 44628.10,
      total_iva: 9371.90,
      total: 54000.00,
      items: [
        {
          name: products[2].name,
          qty: 20,
          cost_net: products[2].cost_price,
          iva_rate: 21,
          cost_final: products[2].cost_price * 1.21
        }
      ]
    }
  ];

  // 7. Generate Provider Payments
  const providerPayments: ProviderPayment[] = [
    // Payment 1 to Quilmes
    {
      id: 'ppay-1',
      provider_id: 'prov-1',
      reference: 'Transf Santander 4892',
      amount: 80000,
      date: getDateStr(2, '15:00'),
      payment_method: 'TRANSFERENCIA',
      notes: 'Pago a cuenta de mercadería'
    },
    // Payment 2 to Coca-Cola
    {
      id: 'ppay-2',
      provider_id: 'prov-2',
      reference: 'Cheque Diferido #39420',
      amount: 85000,
      date: getDateStr(1, '10:00'),
      payment_method: 'CHEQUE',
      notes: 'Pago total factura 0005-00011244'
    }
  ];

  // Calculate provider balances dynamically
  // balance = invoices - payments (Positive means we owe provider)
  providers.forEach(p => {
    const provInvs = providerInvoices.filter(i => i.provider_id === p.id);
    const provPays = providerPayments.filter(pay => pay.provider_id === p.id);
    const totalInvs = provInvs.reduce((sum, inv) => sum + inv.total, 0);
    const totalPays = provPays.reduce((sum, pay) => sum + pay.amount, 0);
    p.balance = totalInvs - totalPays;
  });

  return {
    products,
    clients,
    providers,
    orders,
    transactions,
    providerInvoices,
    providerPayments
  };
};
