import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MoreVertical, 
  X,
  Wallet,
  ShoppingCart,
  Printer,
  Trash2,
  PlusCircle,
  LayoutGrid,
  List,
  MapPin,
  TrendingUp,
  FileText,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProvidersStore } from '../../store/useProvidersStore';
import type { Provider, ProviderInvoice, ProviderPayment } from '../../store/useProvidersStore';
import { useStockStore, WAREHOUSES } from '../../store/useStockStore';
import type { Product } from '../../store/useStockStore';
import { useReactToPrint } from 'react-to-print';
import { useSettingsStore } from '../../store/useSettingsStore';
import BarcodeComponent from 'react-barcode';

const TAX_CONDITIONS = ['Responsable Inscripto', 'Monotributista', 'Exento'] as const;
const IVA_RATES = [21, 10.5, 0] as const;

export const ProvidersManagement: React.FC = () => {
  const { 
    providers, 
    invoices, 
    payments, 
    addProvider, 
    updateProvider, 
    deleteProvider, 
    addInvoice, 
    addPayment, 
    updateProviderBalance 
  } = useProvidersStore();

  const { products, updateProduct, addProduct, addAuditLog } = useStockStore();
  const settings = useSettingsStore();
  const [activeProviderIdMenu, setActiveProviderIdMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveProviderIdMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<any>(null);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const providerInvoicePrintRef = useRef<HTMLDivElement>(null);

  const [selectedPaymentTx, setSelectedPaymentTx] = useState<any>(null);
  const [isPaymentReceiptModalOpen, setIsPaymentReceiptModalOpen] = useState(false);
  const paymentReceiptPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintPaymentReceipt = useReactToPrint({
    contentRef: paymentReceiptPrintRef,
    documentTitle: `Recibo_Pago_${selectedPaymentTx?.reference || 'proveedor'}`,
    bodyClass: 'print-mode-invoice',
  });

  const handleViewPaymentReceipt = (tx: any) => {
    setSelectedPaymentTx(tx);
    setIsPaymentReceiptModalOpen(true);
  };

  const handlePrintProviderInvoice = useReactToPrint({
    contentRef: providerInvoicePrintRef,
    documentTitle: `Factura_Compra_${selectedInvoiceTx?.invoice_number || 'oficial'}`,
    bodyClass: 'print-mode-invoice',
  });

  const handleViewInvoice = (tx: any) => {
    setSelectedInvoiceTx(tx);
    setIsInvoiceDetailsOpen(true);
  };

  const invoiceDetails = useMemo(() => {
    if (!selectedInvoiceTx || selectedInvoiceTx.type !== 'FACTURA') return null;
    const provider = providers.find(p => p.id === selectedInvoiceTx.provider_id);
    const items = selectedInvoiceTx.items || [];
    
    let net21 = 0;
    let net105 = 0;
    let exempt = 0;
    let iva21 = 0;
    let iva105 = 0;

    items.forEach((item: any) => {
      const ivaRate = item.iva_rate !== undefined ? item.iva_rate : 21;
      const netSubtotal = item.cost_net * item.qty;
      const grossSubtotal = item.cost_final * item.qty;
      
      if (ivaRate === 0) {
        exempt += netSubtotal;
      } else if (ivaRate === 10.5) {
        net105 += netSubtotal;
        iva105 += (grossSubtotal - netSubtotal);
      } else {
        net21 += netSubtotal;
        iva21 += (grossSubtotal - netSubtotal);
      }
    });

    const totalNet = net21 + net105 + exempt;
    const totalIva = iva21 + iva105;

    return {
      provider: provider || { name: 'Proveedor Desconocido', cuit: 'S/D', tax_condition: 'Responsable Inscripto' as const, address: 'S/D', city: 'S/D', phone: 'S/D', email: 'S/D' },
      items,
      isFacturaA: provider?.tax_condition === 'Responsable Inscripto',
      taxBreakdown: { net21, iva21, net105, iva105, exempt, totalNet, totalIva }
    };
  }, [selectedInvoiceTx, providers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [taxFilter, setTaxFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtors' | 'creditors'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const accountPrintRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: accountPrintRef,
    documentTitle: `Cuenta_Corriente_Proveedor_${providers.find(p => p.id === selectedProviderId)?.name || 'Proveedor'}`,
  });

  // Invoice Form State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isWithoutVoucher, setIsWithoutVoucher] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [invoiceWarehouse, setInvoiceWarehouse] = useState(WAREHOUSES[0]);
  const [invoiceItems, setInvoiceItems] = useState<Array<{
    productId: string; // "new" si es completamente nuevo
    sku: string;
    name: string;
    qty: number;
    cost_net: number;
    iva_rate: number;
    brand?: string;
    category?: string;
    presentation?: string;
    units_per_box?: number;
    margin_minorista?: number;
    margin_mayorista?: number;
    margin_distribuidor?: number;
  }>>([]);

  // Payment Form State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO'>('EFECTIVO');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Provider Form State
  const [newName, setNewName] = useState('');
  const [newCuit, setNewCuit] = useState('');
  const [newTax, setNewTax] = useState<Provider['tax_condition']>('Responsable Inscripto');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');

  // Filter providers
  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cuit.includes(searchTerm);
      const matchesTax = taxFilter === 'all' || p.tax_condition === taxFilter;
      const matchesStatus = statusFilter === 'all' || (p.status || 'Activo') === statusFilter;
      const matchesBalance = balanceFilter === 'all' 
        ? true 
        : balanceFilter === 'debtors' 
          ? p.balance > 0 
          : p.balance < 0;
      return matchesSearch && matchesTax && matchesStatus && matchesBalance;
    });
  }, [providers, searchTerm, taxFilter, statusFilter, balanceFilter]);

  const debtorProviders = providers.filter(p => p.balance > 0);
  const totalDebt = debtorProviders.reduce((acc, p) => acc + p.balance, 0);

  const creditorProviders = providers.filter(p => p.balance < 0);
  const totalCredit = creditorProviders.reduce((acc, p) => acc + Math.abs(p.balance), 0);

  const netBalance = totalDebt - totalCredit;

  const activeProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId]);

  // Provider invoices & payments sorted by date (descending, just like clients!)
  const accountHistory = useMemo(() => {
    if (!selectedProviderId) return [];
    const provInvoices = invoices.filter(i => i.provider_id === selectedProviderId).map(i => ({
      ...i,
      type: 'FACTURA' as const,
      displayAmount: i.total
    }));
    const provPayments = payments.filter(p => p.provider_id === selectedProviderId).map(p => ({
      ...p,
      type: 'PAGO' as const,
      displayAmount: -p.amount
    }));
    return [...provInvoices, ...provPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, payments, selectedProviderId]);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedProviderId(null);
    setNewName(''); setNewCuit(''); setNewTax('Responsable Inscripto');
    setNewEmail(''); setNewPhone(''); setNewAddress(''); setNewCity('');
    setIsModalOpen(true);
  };

  const handleOpenInvoiceModal = () => {
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().substring(0, 10));
    setInvoiceWarehouse(WAREHOUSES[0]);
    setInvoiceItems([]);
    setIsWithoutVoucher(false);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenEditModal = (provider: Provider) => {
    setModalMode('edit');
    setSelectedProviderId(provider.id);
    setNewName(provider.name);
    setNewCuit(provider.cuit);
    setNewTax(provider.tax_condition);
    setNewEmail(provider.email);
    setNewPhone(provider.phone);
    setNewAddress(provider.address);
    setNewCity(provider.city);
    setIsModalOpen(true);
  };

  const handleSaveProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCuit) {
      alert("Nombre y CUIT son requeridos");
      return;
    }

    if (modalMode === 'add') {
      const newProvider: Provider = {
        id: 'prov-' + Math.random().toString(36).substring(2, 9),
        name: newName,
        cuit: newCuit,
        tax_condition: newTax,
        email: newEmail,
        phone: newPhone,
        address: newAddress,
        city: newCity,
        balance: 0,
        status: 'Activo'
      };
      addProvider(newProvider);
    } else if (selectedProviderId) {
      updateProvider(selectedProviderId, {
        name: newName,
        cuit: newCuit,
        tax_condition: newTax,
        email: newEmail,
        phone: newPhone,
        address: newAddress,
        city: newCity
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteProvider = (id: string) => {
    const prov = providers.find(p => p.id === id);
    if (!prov) return;
    if (prov.balance > 0) {
      alert("⚠️ No se puede eliminar un proveedor con cuenta corriente deudora activa.");
      return;
    }
    if (window.confirm(`¿Está seguro de eliminar definitivamente al proveedor "${prov.name}"?`)) {
      deleteProvider(id);
    }
  };

  const toggleStatus = (id: string) => {
    const prov = providers.find(p => p.id === id);
    if (!prov) return;
    updateProvider(id, { status: (prov.status || 'Activo') === 'Activo' ? 'Inactivo' : 'Activo' });
  };

  // Payment Handler
  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !selectedProviderId) {
      alert("Monto inválido");
      return;
    }

    const newPay: ProviderPayment = {
      id: 'pay-' + Math.random().toString(36).substring(2, 9),
      provider_id: selectedProviderId,
      amount: amountNum,
      reference: paymentRef || 'S/R',
      date: new Date().toLocaleString(),
      payment_method: paymentMethod,
      notes: paymentNotes
    };

    addPayment(newPay);
    updateProviderBalance(selectedProviderId, -amountNum); // Reduce deuda
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentNotes('');
    setIsPaymentModalOpen(false);
  };

  const handleWhatsApp = (provider: Provider) => {
    // 1. Disparar diálogo de impresión
    handlePrint();
    
    // 2. Notificación en pantalla instructiva
    alert("📄 Se ha abierto el asistente de impresión para generar el PDF de la Cuenta Corriente.\n\nGuarde el archivo como PDF en su dispositivo y luego de presionar 'Aceptar', se abrirá WhatsApp para adjuntarlo y enviarlo.");
    
    // 3. Abrir WhatsApp
    const message = `Hola ${provider.name}, te adjunto el estado detallado de nuestra cuenta corriente en formato PDF. Saludos!`;
    const encodedMessage = encodeURIComponent(message);
    const phone = provider.phone.replace(/\D/g, ''); 
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  // Invoice Items Helpers
  const addInvoiceItemRow = () => {
    setInvoiceItems(prev => [
      ...prev,
      {
        productId: '',
        sku: '',
        name: '',
        qty: 1,
        cost_net: 0,
        iva_rate: 21,
        brand: '',
        category: '',
        presentation: 'Unidad',
        units_per_box: 1,
        margin_minorista: 30,
        margin_mayorista: 20,
        margin_distribuidor: 15
      }
    ]);
  };

  const removeInvoiceItemRow = (idx: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateInvoiceItemRow = (idx: number, updates: any) => {
    setInvoiceItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const calculatePrice = (cost: number, iva: number, margin: number) => {
    return Math.round((cost * (1 + iva / 100) * (1 + margin / 100)) / 10) * 10;
  };

  // Manual Invoice Handler
  const handleSaveInvoiceManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || invoiceItems.length === 0 || !selectedProviderId) {
      alert("Complete el número de factura y añada al menos un artículo.");
      return;
    }

    let totalNet = 0;
    let totalIva = 0;

    // Process each item
    invoiceItems.forEach(item => {
      const itemNet = item.qty * item.cost_net;
      const itemIva = itemNet * (item.iva_rate / 100);
      totalNet += itemNet;
      totalIva += itemIva;

      // Stock logic
      if (item.productId === 'new') {
        // Completely new product
        const newProd: Product = {
          id: 'prod-' + Math.random().toString(36).substring(2, 9),
          sku: item.sku,
          barcode: '',
          name: item.name,
          short_description: item.name.substring(0, 20),
          brand: item.brand || 'Varios',
          category: item.category || 'Varios',
          presentation: item.presentation || 'Unidad',
          units_per_box: item.units_per_box || 1,
          warehouse: invoiceWarehouse,
          stock_actual: item.qty,
          stock_reservado: 0,
          stock_minimo: 5,
          cost_price: item.cost_net, // Guardamos costo NETO
          iva_rate: item.iva_rate,
          status: 'activo',
          allow_overstock: false,
          margins: {
            Minorista: item.margin_minorista || 30,
            Mayorista: item.margin_mayorista || 20,
            Distribuidor: item.margin_distribuidor || 15
          },
          prices: {
            Minorista: calculatePrice(item.cost_net, item.iva_rate, item.margin_minorista || 30),
            Mayorista: calculatePrice(item.cost_net, item.iva_rate, item.margin_mayorista || 20),
            Distribuidor: calculatePrice(item.cost_net, item.iva_rate, item.margin_distribuidor || 15)
          },
          last_update: new Date().toLocaleString()
        };
        addProduct(newProd);
        addAuditLog({
          id: Math.random().toString(36).substring(2, 9),
          item_name: newProd.name,
          type: 'ingreso',
          quantity: item.qty,
          new_value: item.qty,
          warehouse_dest: invoiceWarehouse,
          reason: `Ingreso por Factura Manual ${invoiceNumber}`,
          timestamp: new Date().toLocaleString(),
          user: 'Admin'
        });
      } else {
        // Existing product
        const matched = products.find(p => p.id === item.productId);
        if (matched) {
          // If in same warehouse, update cost and stock
          if (matched.warehouse === invoiceWarehouse) {
            updateProduct(matched.id, {
              cost_price: item.cost_net,
              stock_actual: matched.stock_actual + item.qty,
              prices: {
                Minorista: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Minorista),
                Mayorista: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Mayorista),
                Distribuidor: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Distribuidor)
              },
              last_update: new Date().toLocaleString()
            });
            addAuditLog({
              id: Math.random().toString(36).substring(2, 9),
              item_name: matched.name,
              type: 'ingreso',
              quantity: item.qty,
              old_value: matched.stock_actual,
              new_value: matched.stock_actual + item.qty,
              warehouse_dest: invoiceWarehouse,
              reason: `Ingreso por Factura Manual ${invoiceNumber}`,
              timestamp: new Date().toLocaleString(),
              user: 'Admin'
            });
          } else {
            // Check if there is another entry of the product in this warehouse
            const localMatched = products.find(p => p.sku === matched.sku && p.warehouse === invoiceWarehouse);
            if (localMatched) {
              updateProduct(localMatched.id, {
                cost_price: item.cost_net,
                stock_actual: localMatched.stock_actual + item.qty,
                prices: {
                  Minorista: calculatePrice(item.cost_net, localMatched.iva_rate, localMatched.margins.Minorista),
                  Mayorista: calculatePrice(item.cost_net, localMatched.iva_rate, localMatched.margins.Mayorista),
                  Distribuidor: calculatePrice(item.cost_net, localMatched.iva_rate, localMatched.margins.Distribuidor)
                },
                last_update: new Date().toLocaleString()
              });
            } else {
              // Clone to new warehouse
              const cloned: Product = {
                ...matched,
                id: 'prod-' + Math.random().toString(36).substring(2, 9),
                warehouse: invoiceWarehouse,
                stock_actual: item.qty,
                stock_reservado: 0,
                cost_price: item.cost_net,
                prices: {
                  Minorista: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Minorista),
                  Mayorista: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Mayorista),
                  Distribuidor: calculatePrice(item.cost_net, matched.iva_rate, matched.margins.Distribuidor)
                },
                last_update: new Date().toLocaleString()
              };
              addProduct(cloned);
            }
          }
        }
      }
    });

    const totalInvoice = totalNet + totalIva;

    const newInvoice: ProviderInvoice = {
      id: 'pinv-' + Math.random().toString(36).substring(2, 9),
      provider_id: selectedProviderId,
      invoice_number: invoiceNumber,
      date: invoiceDate + ' 12:00',
      warehouse: invoiceWarehouse,
      total_net: totalNet,
      total_iva: totalIva,
      total: totalInvoice,
      items: invoiceItems.map(i => ({
        name: i.name,
        qty: i.qty,
        cost_net: i.cost_net,
        iva_rate: i.iva_rate,
        cost_final: i.cost_net * (1 + i.iva_rate / 100)
      }))
    };

    addInvoice(newInvoice);
    updateProviderBalance(selectedProviderId, totalInvoice); // Incrementa deuda

    // Clean states
    setInvoiceNumber('');
    setIsWithoutVoucher(false);
    setInvoiceItems([]);
    setIsInvoiceModalOpen(false);
    alert("Ingreso registrado correctamente. Se ha incrementado el stock y actualizado la cuenta corriente.");
  };

  const getProductOptions = () => {
    // Unique products by SKU/name for selection list
    const seen = new Set();
    return products.filter(p => {
      const duplicate = seen.has(p.sku);
      seen.add(p.sku);
      return !duplicate;
    });
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-brand-smoke uppercase tracking-tight">Gestión de Proveedores</h1>
          <p className="text-brand-steel text-sm font-medium">Gestión de cuentas corrientes, facturas de compra e ingresos de stock</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="btn-gold px-6 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 self-start md:self-auto shadow-lg shadow-brand-gold/10 cursor-pointer"
        >
          <Plus size={16} /> Registrar Proveedor
        </button>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        {/* Deuda con Proveedor (Con Deuda) */}
        <button 
          onClick={() => setBalanceFilter(prev => prev === 'debtors' ? 'all' : 'debtors')}
          className={cn(
            "glass-card p-3 sm:px-5 sm:py-3 border-rose-500/20 bg-rose-500/5 transition-all hover:scale-105 active:scale-95 text-left flex flex-col justify-between cursor-pointer",
            balanceFilter === 'debtors' && "ring-2 ring-rose-500 bg-rose-500/10"
          )}
          title={`Deuda total a proveedores: $${totalDebt.toLocaleString()} (${debtorProviders.length} cuentas)`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-rose-500 tracking-widest mb-1 truncate" title="Deuda Proveedores">Deuda Proveedores</div>
          <div className="text-xs sm:text-xl font-display font-bold text-rose-400 truncate" title={`${debtorProviders.length} Cuentas`}>
            {debtorProviders.length} <span className="text-[8px] sm:text-[10px] font-sans text-rose-500/60 uppercase">Cts</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-rose-400 mt-1 truncate" title={`$${totalDebt.toLocaleString()}`}>${totalDebt.toLocaleString()}</div>
        </button>

        {/* A Favor de la Distribuidora */}
        <button 
          onClick={() => setBalanceFilter(prev => prev === 'creditors' ? 'all' : 'creditors')}
          className={cn(
            "glass-card p-3 sm:px-5 sm:py-3 border-emerald-500/20 bg-emerald-500/5 transition-all hover:scale-105 active:scale-95 text-left flex flex-col justify-between cursor-pointer",
            balanceFilter === 'creditors' && "ring-2 ring-emerald-500 bg-emerald-500/10"
          )}
          title={`Saldo a favor distribuidora: $${totalCredit.toLocaleString()} (${creditorProviders.length} cuentas)`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-emerald-500 tracking-widest mb-1 truncate" title="A Favor Dist.">A Favor Dist.</div>
          <div className="text-xs sm:text-xl font-display font-bold text-emerald-400 truncate" title={`${creditorProviders.length} Cuentas`}>
            {creditorProviders.length} <span className="text-[8px] sm:text-[10px] font-sans text-emerald-500/60 uppercase">Cts</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 truncate" title={`$${totalCredit.toLocaleString()}`}>${totalCredit.toLocaleString()}</div>
        </button>

        {/* Balance Neto */}
        <div 
          className="glass-card p-3 sm:px-5 sm:py-3 border-brand-charcoal bg-brand-charcoal/20 flex flex-col justify-between"
          title={`Balance Neto: ${netBalance > 0 ? 'A Pagar' : netBalance < 0 ? 'A Favor' : 'Neutro'} $${Math.abs(netBalance).toLocaleString()}`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-brand-steel tracking-widest mb-1 truncate" title="Balance Neto">Balance Neto</div>
          <div className={cn(
            "text-xs sm:text-xl md:text-2xl font-display font-black truncate",
            netBalance > 0 ? "text-rose-400" : netBalance < 0 ? "text-emerald-400" : "text-brand-smoke"
          )} title={`$${Math.abs(netBalance).toLocaleString()}`}>${Math.abs(netBalance).toLocaleString()}</div>
          <div className="text-[7px] sm:text-[9px] uppercase font-bold tracking-widest text-brand-steel mt-1 truncate" title={netBalance > 0 ? 'A Pagar' : netBalance < 0 ? 'A Favor' : 'Neutro'}>
            {netBalance > 0 ? 'A Pagar' : netBalance < 0 ? 'A Favor' : 'Neutro'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-3 sm:p-4 flex flex-col md:flex-row gap-3 border-brand-charcoal items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Razón Social o CUIT..." 
            className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-11 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap md:flex-nowrap gap-2 items-center justify-between md:justify-end">
          <select 
            className="flex-1 md:flex-none bg-brand-black border border-brand-charcoal rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-brand-gold h-[38px] cursor-pointer"
            value={taxFilter}
            onChange={(e) => setTaxFilter(e.target.value)}
          >
            <option value="all">📍 Todas las Cond. IVA</option>
            {TAX_CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
          </select>

          <select 
            className="flex-1 md:flex-none bg-brand-black border border-brand-charcoal rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-brand-gold h-[38px] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">🟢 Todos los Estados</option>
            <option value="Activo">🟢 Activos</option>
            <option value="Inactivo">🔴 Inactivos</option>
          </select>
          
          {balanceFilter !== 'all' && (
            <button 
              onClick={() => setBalanceFilter('all')}
              className={cn(
                "text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 shrink-0 h-[38px] cursor-pointer",
                balanceFilter === 'debtors' ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              <X size={10} /> {balanceFilter === 'debtors' ? 'Deuda' : 'Favor'}
            </button>
          )}

          {/* Selector de modo de vista */}
          <div className="flex items-center bg-brand-black border border-brand-charcoal rounded-xl overflow-hidden p-0.5 shrink-0 h-[38px]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid' 
                  ? "bg-brand-wine text-white shadow-sm" 
                  : "text-brand-steel hover:text-brand-smoke"
              )}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'list' 
                  ? "bg-brand-wine text-white shadow-sm" 
                  : "text-brand-steel hover:text-brand-smoke"
              )}
              title="Vista de Lista"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List of Providers */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProviders.length === 0 ? (
            <div className="col-span-full py-12 text-center text-brand-steel bg-brand-charcoal/10 rounded-2xl border border-brand-charcoal border-dashed">
              No se encontraron proveedores con los filtros seleccionados.
            </div>
          ) : (
            filteredProviders.map(p => (
              <div key={p.id} className={cn("glass-card group hover:border-brand-gold/30 transition-all duration-500 overflow-hidden flex flex-col relative", (p.status || 'Activo') === 'Inactivo' && "opacity-60 bg-brand-charcoal/20 grayscale-[0.5]")}>
                {(p.status || 'Activo') === 'Inactivo' && (
                  <div className="absolute top-0 inset-x-0 bg-rose-600/90 text-white text-[9px] font-black uppercase tracking-widest py-1 text-center z-[15] select-none shadow">
                    Proveedor Suspendido
                  </div>
                )}
                <div className={cn("p-6 border-b border-brand-charcoal flex justify-between items-start", (p.status || 'Activo') === 'Inactivo' && "pt-10")}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-2 h-2 rounded-full shadow-sm", (p.status || 'Activo') === 'Activo' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-brand-steel shadow-brand-steel/50")} />
                      <span className="text-[10px] font-black uppercase text-brand-steel tracking-widest">{p.tax_condition}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-brand-smoke group-hover:text-brand-gold transition-colors">{p.name}</h3>
                    <p className="text-xs text-brand-steel font-mono">CUIT: {p.cuit}</p>
                  </div>
                  <div className="relative group/menu">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProviderIdMenu(activeProviderIdMenu === p.id ? null : p.id);
                      }}
                      className="p-2 hover:bg-brand-charcoal rounded-lg text-brand-steel transition-colors cursor-pointer"
                    >
                      <MoreVertical size={18} />
                    </button>
                    <div className={cn(
                      "absolute right-0 top-full mt-2 w-48 bg-brand-graphite border border-brand-charcoal rounded-xl shadow-2xl transition-all z-50 overflow-hidden",
                      activeProviderIdMenu === p.id 
                        ? "opacity-100 visible pointer-events-auto" 
                        : "opacity-0 invisible pointer-events-none group-hover/menu:opacity-100 group-hover/menu:visible group-hover/menu:pointer-events-auto"
                    )}>
                      <button onClick={() => handleOpenEditModal(p)} className="w-full px-4 py-3 text-left text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3 cursor-pointer">
                        <Plus size={14} className="rotate-45 text-brand-gold" /> Editar Datos
                      </button>
                      <button onClick={() => toggleStatus(p.id)} className="w-full px-4 py-3 text-left text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3 cursor-pointer border-t border-brand-charcoal/50">
                        {(p.status || 'Activo') === 'Activo' ? <X size={14} className="text-rose-500" /> : <Check size={14} className="text-emerald-500" />}
                        {(p.status || 'Activo') === 'Activo' ? 'Suspender Proveedor' : 'Activar Proveedor'}
                      </button>
                      <button onClick={() => handleDeleteProvider(p.id)} disabled={p.balance > 0} className="w-full px-4 py-3 text-left text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 border-t border-brand-charcoal/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:text-brand-steel cursor-pointer">
                        <Trash2 size={14} /> Dar de Baja
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4 flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs text-brand-steel">
                      <MapPin size={14} className="text-brand-gold" />
                      <span>{p.address || 'S/D'}, {p.city || 'S/D'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-steel">
                      <Phone size={14} className="text-brand-gold" />
                      <span>{p.phone || 'Sin Teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-steel">
                      <Mail size={14} className="text-brand-gold" />
                      <span>{p.email || 'Sin Email'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-brand-charcoal flex justify-between items-center">
                    <div>
                      <span className="text-[8px] uppercase font-black text-brand-steel tracking-wider block">Saldo Cuenta</span>
                      <span className={cn(
                        "font-mono font-bold text-base",
                        p.balance > 0 ? "text-rose-400" : p.balance < 0 ? "text-emerald-400" : "text-brand-steel"
                      )}>
                        {p.balance > 0 ? `Debemos $${p.balance.toLocaleString()}` : p.balance < 0 ? `A favor $${Math.abs(p.balance).toLocaleString()}` : 'Al día'}
                      </span>
                    </div>

                    <button 
                      onClick={() => {
                        setSelectedProviderId(p.id);
                        setIsAccountOpen(true);
                      }}
                      className="px-3.5 py-2 bg-brand-wine/20 hover:bg-brand-wine text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border border-brand-wine/30"
                    >
                      Cuenta
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="glass-card border-brand-charcoal overflow-hidden">
          {/* Mobile/Tablet view: list cards */}
          <div className="block lg:hidden bg-brand-black/20 p-3 sm:p-4">
            {filteredProviders.length === 0 ? (
              <div className="p-6 text-center text-brand-steel">No se encontraron proveedores.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProviders.map(p => (
                  <div key={p.id} className={cn("glass-card p-4 space-y-3 flex flex-col justify-between border-brand-charcoal/40 bg-brand-charcoal/10 relative overflow-hidden", (p.status || 'Activo') === 'Inactivo' && "opacity-60 bg-brand-charcoal/20 grayscale-[0.5]")}>
                    {(p.status || 'Activo') === 'Inactivo' && (
                      <div className="absolute top-0 inset-x-0 bg-rose-600/90 text-white text-[8px] font-black uppercase tracking-widest py-0.5 text-center z-[15] select-none shadow">
                        Proveedor Suspendido
                      </div>
                    )}
                    <div className={cn("space-y-3", (p.status || 'Activo') === 'Inactivo' && "pt-3")}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-display font-bold text-sm text-brand-smoke truncate max-w-[180px]" title={p.name}>{p.name}</h4>
                          <p className="text-[10px] text-brand-steel font-mono font-medium">CUIT: {p.cuit}</p>
                        </div>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0",
                          p.tax_condition === 'Responsable Inscripto' 
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : p.tax_condition === 'Monotributista'
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}>
                          {p.tax_condition}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div className="text-brand-steel space-y-1">
                          <div className="flex items-center gap-1">
                            <Phone size={10} className="text-brand-gold" /> {p.phone || 'S/T'}
                          </div>
                          <p className="text-[10px] truncate max-w-[150px]">{p.city || 'S/D'} • {p.email || 'S/E'}</p>
                        </div>
                        <div className={cn(
                          "font-mono font-bold text-xs text-right",
                          p.balance > 0 ? "text-rose-400" : p.balance < 0 ? "text-emerald-400" : "text-brand-steel"
                        )}>
                          {p.balance > 0 ? `Debemos $${p.balance.toLocaleString()}` : p.balance < 0 ? `A favor $${Math.abs(p.balance).toLocaleString()}` : 'Al día'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-brand-charcoal/20 mt-auto">
                      <button 
                        onClick={() => {
                          setSelectedProviderId(p.id);
                          setIsAccountOpen(true);
                        }}
                        className="py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Wallet size={12} className="text-brand-gold" /> Cuenta
                      </button>
                      <button 
                        onClick={() => handleOpenEditModal(p)}
                        className="py-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Ficha
                      </button>
                      <button 
                        type="button"
                        onClick={() => toggleStatus(p.id)}
                        className={cn(
                          "py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border",
                          (p.status || 'Activo') === 'Activo' 
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20" 
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                        )}
                      >
                        {(p.status || 'Activo') === 'Activo' ? 'Suspender' : 'Activar'}
                      </button>
                      <button 
                        onClick={() => handleDeleteProvider(p.id)}
                        disabled={p.balance > 0}
                        className="py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-brand-charcoal/10 disabled:border-brand-charcoal/20 disabled:text-brand-steel"
                      >
                        Baja
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop view: standard table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-brand-charcoal/50 border-b border-brand-charcoal text-[9px] uppercase font-black text-brand-steel tracking-wider">
                  <th className="px-6 py-4">Proveedor / CUIT</th>
                  <th className="px-6 py-4">Condición Fiscal</th>
                  <th className="px-6 py-4">Contacto / Localidad</th>
                  <th className="px-6 py-4 text-right">Saldo Cuenta</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-charcoal/30">
                {filteredProviders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-brand-steel">No se encontraron proveedores.</td>
                  </tr>
                ) : (
                  filteredProviders.map(p => (
                    <tr key={p.id} className={cn("hover:bg-brand-charcoal/10 transition-colors", (p.status || 'Activo') === 'Inactivo' && "opacity-60 bg-brand-charcoal/20 grayscale-[0.5]")}>
                      <td className="px-6 py-4">
                        <div className="font-display font-bold text-sm text-brand-smoke">{p.name}</div>
                        <div className="text-[10px] text-brand-steel font-mono font-medium">CUIT: {p.cuit}</div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={cn(
                           "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                           p.tax_condition === 'Responsable Inscripto' 
                             ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                             : p.tax_condition === 'Monotributista'
                               ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                               : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                         )}>
                           {p.tax_condition}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-brand-smoke">
                          <Phone size={12} className="text-brand-gold" /> {p.phone || 'S/T'}
                        </div>
                        <div className="text-[10px] text-brand-steel">{p.email || 'S/E'} • {p.city || 'S/D'}</div>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-mono font-bold text-sm",
                        p.balance > 0 ? "text-rose-400" : p.balance < 0 ? "text-emerald-400" : "text-brand-steel"
                      )}>
                        {p.balance > 0 ? `Debemos $${p.balance.toLocaleString()}` : p.balance < 0 ? `A favor $${Math.abs(p.balance).toLocaleString()}` : 'Al día'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => {
                              setSelectedProviderId(p.id);
                              setIsAccountOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Wallet size={12} className="text-brand-gold" /> Cuenta
                          </button>
                          <button 
                            onClick={() => handleOpenEditModal(p)}
                            className="px-2.5 py-1.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-lg text-[10px] font-black border border-brand-gold/20 uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Ficha
                          </button>
                          <button 
                            type="button"
                            onClick={() => toggleStatus(p.id)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wider transition-all cursor-pointer",
                              (p.status || 'Activo') === 'Activo' 
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20" 
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                            )}
                          >
                            {(p.status || 'Activo') === 'Activo' ? 'Suspender' : 'Activar'}
                          </button>
                          <button 
                            onClick={() => handleDeleteProvider(p.id)}
                            disabled={p.balance > 0}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-black border border-rose-500/20 uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-brand-charcoal/10 disabled:border-brand-charcoal/20 disabled:text-brand-steel"
                          >
                            Baja
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Provider */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <form 
            onSubmit={handleSaveProvider} 
            className="glass-card max-w-lg w-full border-brand-charcoal relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-6 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-brand-charcoal pb-4 mb-6">
              <div>
                <h3 className="text-lg font-display font-black text-brand-gold uppercase tracking-wider">
                  {modalMode === 'add' ? 'Registrar Proveedor' : 'Editar Proveedor'}
                </h3>
                <p className="text-[9px] font-black text-brand-steel uppercase tracking-widest mt-1">
                  {modalMode === 'add' ? 'Ingreso de nuevo proveedor al sistema' : `Modificando: ${newName}`}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="text-brand-steel hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Razón Social</label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  placeholder="Ej: Quilmes S.A." 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">CUIT</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke font-mono focus:border-brand-gold outline-none transition-all" 
                    placeholder="30-12345678-9" 
                    required 
                    value={newCuit} 
                    onChange={e => setNewCuit(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Condición Frente al IVA</label>
                  <select 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer" 
                    value={newTax} 
                    onChange={e => setNewTax(e.target.value as any)}
                  >
                    {TAX_CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="Ej: 0800..." 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="proveedor@correo.com" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-brand-charcoal/50 pt-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Dirección</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="Calle y Número" 
                    value={newAddress} 
                    onChange={e => setNewAddress(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Ciudad / Localidad</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="Ej: Quilmes" 
                    value={newCity} 
                    onChange={e => setNewCity(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 mt-6 border-t border-brand-charcoal pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 btn-gold py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cuenta Corriente (Ficha de Proveedor) */}
      {isAccountOpen && activeProvider && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-card max-w-4xl w-full border-brand-charcoal p-0 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
              <div>
                <span className="text-[8px] bg-brand-gold/10 px-2 py-0.5 border border-brand-gold/20 rounded font-black text-brand-gold uppercase tracking-widest">Cuenta Corriente Proveedor</span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-1">{activeProvider.name}</h3>
                <p className="text-[10px] text-brand-steel font-mono">CUIT: {activeProvider.cuit} • {activeProvider.tax_condition}</p>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                   onClick={handlePrint}
                   className="p-2.5 bg-brand-charcoal hover:bg-brand-gold/10 text-brand-steel hover:text-brand-gold rounded-xl border border-brand-charcoal hover:border-brand-gold/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                 >
                   <Printer size={16} /> Imprimir Cta Cte
                 </button>
                 <button onClick={() => setIsAccountOpen(false)} className="p-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-steel rounded-full cursor-pointer"><X size={20} /></button>
              </div>
            </div>

            {/* Content & History Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-brand-black/40 border border-brand-charcoal rounded-2xl p-4">
                <div>
                   <p className="text-[8px] text-brand-steel font-black uppercase tracking-wider">Saldo Comercial</p>
                   <p className={cn(
                     "text-xl font-display font-black",
                     activeProvider.balance > 0 ? "text-rose-400" : activeProvider.balance < 0 ? "text-emerald-400" : "text-brand-smoke"
                   )}>
                     {activeProvider.balance > 0 ? `Debemos $${activeProvider.balance.toLocaleString()}` : activeProvider.balance < 0 ? `A favor $${Math.abs(activeProvider.balance).toLocaleString()}` : 'Al día'}
                   </p>
                </div>
                <div>
                   <p className="text-[8px] text-brand-steel font-black uppercase tracking-wider">Último Pago Registrado</p>
                   <p className="text-base font-bold text-brand-smoke mt-0.5">
                     {payments.filter(p => p.provider_id === activeProvider.id).length > 0 
                       ? `$${payments.filter(p => p.provider_id === activeProvider.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].amount.toLocaleString()}`
                       : 'S/D'
                     }
                   </p>
                </div>
                <div className="flex flex-col gap-2 justify-center">
                   <div className="flex gap-2">
                     <button 
                       onClick={handleOpenInvoiceModal}
                       className="flex-1 px-3 py-2 bg-brand-wine hover:bg-brand-wine/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-wine/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                     >
                       <ShoppingCart size={12} /> Factura
                     </button>
                     <button 
                       onClick={() => setIsPaymentModalOpen(true)}
                       className="flex-1 px-3 py-2 btn-gold text-brand-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-gold/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                     >
                       <Wallet size={12} /> Pago
                     </button>
                   </div>
                   <button
                     onClick={() => handleWhatsApp(activeProvider)}
                     className="w-full bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2 border border-brand-charcoal cursor-pointer text-center"
                   >
                     <Phone size={12} className="text-emerald-500" /> WhatsApp PDF
                   </button>
                </div>
              </div>

              {/* Ledger Table (Libro Mayor) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase text-brand-steel tracking-[0.3em] flex items-center gap-2">
                    <TrendingUp size={12} className="text-brand-gold" /> Libro Mayor (Cta Cte)
                  </h4>
                  <span className="text-[9px] text-brand-steel font-bold italic">Mostrando {accountHistory.length} movimientos, del más reciente al más antiguo</span>
                </div>

                <div className="glass-card border-brand-charcoal overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-charcoal/50 border-b border-brand-charcoal text-[9px] uppercase font-black text-brand-steel tracking-wider">
                          <th className="px-4 py-3">Fecha / Hora</th>
                          <th className="px-4 py-3">Comprobante / Tipo</th>
                          <th className="px-4 py-3">Detalle / Referencia</th>
                          <th className="px-4 py-3 text-right">Debe (Débito)</th>
                          <th className="px-4 py-3 text-right">Haber (Crédito)</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-charcoal/30 font-medium">
                        {accountHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-brand-steel">No se registran movimientos en la cuenta corriente.</td>
                          </tr>
                        ) : (
                          accountHistory.map(transaction => {
                            const tx = transaction as any;
                            const isDebito = tx.type === 'FACTURA';
                            return (
                              <tr key={tx.id} className="hover:bg-brand-charcoal/10 transition-colors">
                                <td className="px-4 py-3 text-brand-steel font-mono">{tx.date}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                                    tx.type === 'PAGO' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  )}>
                                    {tx.type}
                                  </span>
                                  {tx.invoice_number && <span className="ml-2 font-mono font-bold text-brand-smoke">{tx.invoice_number}</span>}
                                </td>
                                <td className="px-4 py-3 text-brand-smoke max-w-[200px] truncate" title={tx.notes || tx.reference}>
                                  <span>{tx.type === 'FACTURA' ? `Ingreso de stock en: ${tx.warehouse}` : tx.reference}</span>
                                  {tx.notes && <span className="text-[10px] text-brand-steel block mt-0.5 font-normal">({tx.notes})</span>}
                                  {tx.payment_method && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-0.5 block">[{tx.payment_method}]</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-rose-400 font-mono font-bold">
                                  {isDebito ? `$${tx.displayAmount.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-emerald-400 font-mono font-bold">
                                  {!isDebito ? `$${Math.abs(tx.displayAmount).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {tx.type === 'FACTURA' ? (
                                    <button
                                      onClick={() => handleViewInvoice(tx)}
                                      className="px-2.5 py-1 bg-brand-gold/10 hover:bg-brand-gold/25 border border-brand-gold/20 text-brand-gold rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      title="Ver Factura Compra Oficial"
                                    >
                                      <FileText size={12} />
                                      <span>Ver Factura</span>
                                    </button>
                                  ) : tx.type === 'PAGO' ? (
                                    <button
                                      onClick={() => handleViewPaymentReceipt(tx)}
                                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      title="Ver Recibo de Pago"
                                    >
                                      <FileText size={12} />
                                      <span>Ver Recibo</span>
                                    </button>
                                  ) : (
                                    <span className="text-brand-steel text-[10px] font-bold">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable template for react-to-print */}
      <div className="hidden">
        <div ref={accountPrintRef} className="p-8 bg-white text-black font-sans text-xs">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">Estado de Cuenta Corriente Proveedor</h1>
              <p className="text-gray-600 font-bold mt-1 uppercase text-[9px] tracking-widest">Resumen detallado de movimientos de compra y pagos</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold">DISTRIBUIDORA</h2>
              <p className="text-[10px] text-gray-500">Fecha de Reporte: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {activeProvider && (
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 border border-gray-200 rounded">
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Proveedor / Razón Social</p>
                <p className="font-bold text-sm text-black">{activeProvider.name}</p>
                <p className="text-gray-600">{activeProvider.address || 'S/D'}, {activeProvider.city || 'S/D'}</p>
                <p className="text-gray-600">Tel: {activeProvider.phone || 'S/D'} • Email: {activeProvider.email || 'S/D'}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Detalles Impositivos</p>
                <p className="font-bold text-gray-700">CUIT: {activeProvider.cuit}</p>
                <p className="text-gray-600">Condición IVA: {activeProvider.tax_condition}</p>
                <p className="font-bold text-black mt-1">
                  Saldo Actual: {activeProvider.balance > 0 ? `DEBEMOS $${activeProvider.balance.toLocaleString()}` : activeProvider.balance < 0 ? `A FAVOR $${Math.abs(activeProvider.balance).toLocaleString()}` : 'AL DÍA'}
                </p>
              </div>
            </div>
          )}

          <table className="w-full text-left border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 text-[8px] uppercase font-bold text-gray-700">
                <th className="border border-gray-300 px-3 py-2">Fecha / Hora</th>
                <th className="border border-gray-300 px-3 py-2">Tipo</th>
                <th className="border border-gray-300 px-3 py-2">Referencia / Detalle</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Debe (Compra)</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Haber (Pago)</th>
              </tr>
            </thead>
            <tbody>
              {accountHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-3 py-6 text-center text-gray-500">No se registran movimientos.</td>
                </tr>
              ) : (
                accountHistory.map(transaction => {
                  const tx = transaction as any;
                  const isDebito = tx.type === 'FACTURA';
                  return (
                    <tr key={tx.id} className="border-b border-gray-200">
                      <td className="border border-gray-300 px-3 py-2 font-mono text-[9px]">{tx.date}</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-[9px]">{tx.type}</td>
                      <td className="border border-gray-300 px-3 py-2 text-gray-800">
                        {tx.type === 'FACTURA' ? `Ingreso de stock en: ${tx.warehouse} (Nro ${tx.invoice_number || 'S/N'})` : tx.reference}
                        {tx.notes && ` (${tx.notes})`}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold text-red-600">
                        {isDebito ? `$${tx.displayAmount.toLocaleString()}` : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold text-green-600">
                        {!isDebito ? `$${Math.abs(tx.displayAmount).toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-8 border-t border-black pt-4 flex justify-between items-center text-[10px]">
            <p className="text-gray-500">Documento emitido comercialmente.</p>
            <p className="font-bold">Distribuidora Oficial</p>
          </div>
        </div>
      </div>

      {/* Modal: Registrar Pago a Proveedor */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsPaymentModalOpen(false)} />
          <form 
            onSubmit={handleRegisterPayment} 
            className="glass-card max-w-md w-full border-brand-charcoal relative z-10 animate-in zoom-in duration-150 p-6"
          >
            <div className="flex justify-between items-center border-b border-brand-charcoal pb-3 mb-5">
              <h3 className="text-base font-display font-black text-brand-gold uppercase tracking-wider">Registrar Pago a Proveedor</h3>
              <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="text-brand-steel hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">Monto del Pago</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold font-bold">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)} 
                    required
                    placeholder="0.00"
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl pl-8 pr-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">Método de Pago</label>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer"
                  >
                    <option value="EFECTIVO">💵 EFECTIVO</option>
                    <option value="TRANSFERENCIA">🏦 TRANSFERENCIA</option>
                    <option value="CHEQUE">📄 CHEQUE</option>
                    <option value="OTRO">⚙️ OTRO</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">Nro de Referencia / Recibo</label>
                  <input 
                    type="text" 
                    value={paymentRef} 
                    onChange={(e) => setPaymentRef(e.target.value)} 
                    placeholder="Ej: REC-987"
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">Observaciones</label>
                <textarea 
                  value={paymentNotes} 
                  onChange={(e) => setPaymentNotes(e.target.value)} 
                  placeholder="Detalles adicionales del pago..."
                  rows={2}
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 border-t border-brand-charcoal pt-4">
              <button 
                type="button" 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 btn-gold py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest cursor-pointer"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cargar Factura Manual con Carga de Stock por Depósito */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsInvoiceModalOpen(false)} />
          <form 
            onSubmit={handleSaveInvoiceManual} 
            className="glass-card max-w-4xl w-full border-brand-charcoal relative z-10 p-6 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200"
          >
            <div className="flex justify-between items-center border-b border-brand-charcoal pb-3 mb-5">
              <div>
                <h3 className="text-base font-display font-black text-brand-gold uppercase tracking-wider">Cargar Factura de Compra (Ingreso Manual)</h3>
                <p className="text-[10px] text-brand-steel mt-0.5">Ingresará los productos y cantidades al stock y registrará el saldo de deuda con el proveedor.</p>
              </div>
              <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="text-brand-steel hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] uppercase font-black text-brand-steel block">Nro de Factura / Remito</label>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="checkbox" 
                        id="noVoucher" 
                        checked={isWithoutVoucher}
                        onChange={(e) => {
                          setIsWithoutVoucher(e.target.checked);
                          if (e.target.checked) {
                            setInvoiceNumber(`S/C-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
                          } else {
                            setInvoiceNumber('');
                          }
                        }}
                        className="rounded bg-brand-black border-brand-charcoal text-brand-gold focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                      <label htmlFor="noVoucher" className="text-[8px] text-brand-steel font-bold uppercase cursor-pointer select-none">Sin Comprobante</label>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={(e) => setInvoiceNumber(e.target.value)} 
                    required
                    disabled={isWithoutVoucher}
                    placeholder={isWithoutVoucher ? "Generado automáticamente" : "0001-00012345"}
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">Fecha Emisión</label>
                  <input 
                    type="date" 
                    value={invoiceDate} 
                    onChange={(e) => setInvoiceDate(e.target.value)} 
                    required
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-brand-steel block mb-1">📥 Depósito de Destino (Stock)</label>
                  <select 
                    value={invoiceWarehouse} 
                    onChange={(e) => setInvoiceWarehouse(e.target.value)}
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer"
                  >
                    {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>

              {/* Items List Rows */}
              <div className="space-y-3 pt-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest">Ítems Comprados / Cargados</p>
                  <button 
                    type="button" 
                    onClick={addInvoiceItemRow}
                    className="text-xs text-brand-gold hover:text-yellow-400 font-bold flex items-center gap-1.5 bg-brand-gold/10 border border-brand-gold/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <PlusCircle size={14} /> Añadir Fila
                  </button>
                </div>

                <div className="space-y-3">
                  {invoiceItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-brand-charcoal/20 border border-brand-charcoal rounded-2xl space-y-4">
                       {/* Selector de Producto */}
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-2">
                           <label className="text-[8px] uppercase font-black text-brand-steel block mb-1">Producto</label>
                           <select
                             className="w-full bg-brand-black border border-brand-charcoal rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                             value={item.productId}
                             onChange={(e) => {
                               const val = e.target.value;
                               if (val === 'new') {
                                 updateInvoiceItemRow(idx, { productId: 'new', sku: '', name: '', brand: '', category: '', presentation: 'Unidad', units_per_box: 1 });
                               } else {
                                 const matched = products.find(p => p.id === val);
                                 if (matched) {
                                   updateInvoiceItemRow(idx, { productId: val, sku: matched.sku, name: matched.name, cost_net: matched.cost_price, iva_rate: matched.iva_rate });
                                 }
                               }
                             }}
                             required
                           >
                             <option value="">Seleccionar Producto...</option>
                             <option value="new">🆕 [Crear Nuevo Producto en Catálogo]</option>
                             {getProductOptions().map(p => (
                               <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                             ))}
                           </select>
                         </div>

                         <div>
                           <label className="text-[8px] uppercase font-black text-brand-steel block mb-1">Cantidad (Cajas/Uni)</label>
                           <input 
                             type="number" 
                             min="1" 
                             value={item.qty}
                             onChange={(e) => updateInvoiceItemRow(idx, { qty: parseInt(e.target.value) || 0 })}
                             className="w-full bg-brand-black border border-brand-charcoal rounded-lg px-3 py-2 text-xs text-brand-smoke outline-none"
                             required
                           />
                         </div>

                         <div>
                           <label className="text-[8px] uppercase font-black text-brand-steel block mb-1">Costo Unitario NETO</label>
                           <input 
                             type="number" 
                             step="0.01" 
                             value={item.cost_net}
                             onChange={(e) => updateInvoiceItemRow(idx, { cost_net: parseFloat(e.target.value) || 0 })}
                             className="w-full bg-brand-black border border-brand-charcoal rounded-lg px-3 py-2 text-xs text-brand-smoke outline-none"
                             required
                           />
                         </div>
                       </div>

                       {/* Campos dinámicos si es producto nuevo */}
                       {item.productId === 'new' && (
                         <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-brand-black/30 p-3 rounded-xl border border-brand-charcoal/50">
                           <div className="col-span-2">
                             <label className="text-[8px] uppercase font-black text-brand-gold block mb-0.5">Nombre Nuevo Producto</label>
                             <input 
                               type="text" 
                               value={item.name} 
                               onChange={(e) => updateInvoiceItemRow(idx, { name: e.target.value })}
                               placeholder="Ej: Quilmes Clásica 1L"
                               className="w-full bg-brand-black border border-brand-charcoal rounded px-2 py-1 text-xs text-brand-smoke"
                               required
                             />
                           </div>
                           <div>
                             <label className="text-[8px] uppercase font-black text-brand-steel block mb-0.5">SKU Nuevo</label>
                             <input 
                               type="text" 
                               value={item.sku} 
                               onChange={(e) => updateInvoiceItemRow(idx, { sku: e.target.value })}
                               placeholder="QUI-1L-X6"
                               className="w-full bg-brand-black border border-brand-charcoal rounded px-2 py-1 text-xs text-brand-smoke"
                               required
                             />
                           </div>
                           <div>
                             <label className="text-[8px] uppercase font-black text-brand-steel block mb-0.5">Marca</label>
                             <input 
                               type="text" 
                               value={item.brand} 
                               onChange={(e) => updateInvoiceItemRow(idx, { brand: e.target.value })}
                               placeholder="Quilmes"
                               className="w-full bg-brand-black border border-brand-charcoal rounded px-2 py-1 text-xs text-brand-smoke"
                             />
                           </div>
                           <div>
                             <label className="text-[8px] uppercase font-black text-brand-steel block mb-0.5">Categoría</label>
                             <input 
                               type="text" 
                               value={item.category} 
                               onChange={(e) => updateInvoiceItemRow(idx, { category: e.target.value })}
                               placeholder="Cervezas"
                               className="w-full bg-brand-black border border-brand-charcoal rounded px-2 py-1 text-xs text-brand-smoke"
                             />
                           </div>
                         </div>
                       )}

                       {/* Fila de Tasa IVA e Info de Totales de Fila */}
                       <div className="flex flex-wrap items-center justify-between gap-4 pt-1.5 border-t border-brand-charcoal/30">
                         <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] uppercase font-black text-brand-steel">% IVA:</span>
                             <select
                               value={item.iva_rate}
                               onChange={(e) => updateInvoiceItemRow(idx, { iva_rate: parseInt(e.target.value) })}
                               className="bg-brand-black border border-brand-charcoal rounded px-2 py-1 text-xs text-white cursor-pointer"
                             >
                               {IVA_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                             </select>
                           </div>
                         </div>

                         <div className="flex items-center gap-6 text-xs text-brand-steel">
                            <p>Neto: <b className="text-brand-smoke">${(item.qty * item.cost_net).toLocaleString()}</b></p>
                            <p>IVA: <b className="text-brand-smoke">${((item.qty * item.cost_net) * (item.iva_rate / 100)).toLocaleString()}</b></p>
                            <p className="text-brand-gold font-bold">Subtotal Fila: ${(item.qty * item.cost_net * (1 + item.iva_rate / 100)).toLocaleString()}</p>
                            <button 
                              type="button" 
                              onClick={() => removeInvoiceItemRow(idx)}
                              className="text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 p-1.5 rounded transition-all ml-2 cursor-pointer"
                              title="Quitar Fila"
                            >
                              <Trash2 size={14} />
                            </button>
                         </div>
                       </div>
                    </div>
                  ))}
                  {invoiceItems.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-brand-charcoal rounded-2xl text-brand-steel">
                       No hay artículos en esta factura de compra. Haga clic en "Añadir Fila" para comenzar.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Totales y Botones */}
            <div className="border-t border-brand-charcoal pt-4 mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-6 text-sm text-brand-steel">
                <p>Base Neto: <b className="text-brand-smoke">${invoiceItems.reduce((acc, item) => acc + (item.qty * item.cost_net), 0).toLocaleString()}</b></p>
                <p>Total IVA: <b className="text-brand-smoke">${invoiceItems.reduce((acc, item) => acc + ((item.qty * item.cost_net) * (item.iva_rate / 100)), 0).toLocaleString()}</b></p>
                <p className="text-lg text-brand-gold font-display font-black">TOTAL COMPRA: ${invoiceItems.reduce((acc, item) => acc + (item.qty * item.cost_net * (1 + item.iva_rate / 100)), 0).toLocaleString()}</p>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  type="button" 
                  onClick={() => setIsInvoiceModalOpen(false)} 
                  className="flex-1 md:flex-none bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke px-6 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={invoiceItems.length === 0} 
                  className="flex-1 md:flex-none btn-gold px-6 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest disabled:opacity-30 disabled:grayscale cursor-pointer"
                >
                  Confirmar e Ingresar Stock
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Invoice Detail Modal (Compra) */}
      {isInvoiceDetailsOpen && selectedInvoiceTx && invoiceDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsInvoiceDetailsOpen(false)} />
          <div className="glass-card max-w-2xl w-full border-brand-charcoal relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-0 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.2em] bg-brand-gold/10 px-2 py-1 rounded">
                  Comprobante Impositivo Compra
                </span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-2">
                  Factura de Compra {invoiceDetails.isFacturaA ? 'A' : 'B'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintProviderInvoice()}
                  className="px-4 py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-brand-charcoal cursor-pointer"
                >
                  <FileText size={14} className="text-brand-gold" /> Imprimir Factura
                </button>
                <button 
                  onClick={() => setIsInvoiceDetailsOpen(false)} 
                  className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-brand-black">
              {/* Printable Invoice Container */}
              <div ref={providerInvoicePrintRef} className="bg-white text-black p-8 rounded-xl space-y-6 text-xs font-sans">
                {/* Interno Header Style */}
                <div className="border-2 border-black p-4 relative">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black w-14 h-14 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black leading-none">{invoiceDetails.isFacturaA ? 'A' : 'B'}</span>
                      <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">Comp.Int.</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-8 pt-4">
                      <div>
                         <h1 className="text-base font-bold tracking-tight uppercase">{invoiceDetails.provider.name}</h1>
                         <p className="text-[9px] text-gray-500">{invoiceDetails.provider.tax_condition}</p>
                         <p className="mt-2 text-[9px]">{invoiceDetails.provider.address || 'S/D'}</p>
                         <p className="text-[9px]">Teléfono: {invoiceDetails.provider.phone || 'S/D'}</p>
                         <p className="text-[9px]">Email: {invoiceDetails.provider.email || 'S/D'}</p>
                      </div>
                      <div className="text-right pl-12">
                         <h2 className="text-sm font-bold uppercase">Factura Compra</h2>
                         <p className="text-xs font-mono font-bold mt-0.5">Nro: {selectedInvoiceTx.invoice_number || selectedInvoiceTx.reference || 'S/N'}</p>
                         <p className="text-[9px] text-gray-500 mt-2">Fecha: {selectedInvoiceTx.date.split(',')[0]}</p>
                         <p className="text-[9px] text-gray-500">CUIT: {invoiceDetails.provider.cuit}</p>
                         <p className="text-[9px] text-gray-500">Condición Fiscal: {invoiceDetails.provider.tax_condition}</p>
                      </div>
                   </div>
                </div>

                {/* Receiver Section (Distribuidora) */}
                <div className="border border-black p-4 grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[8px] uppercase tracking-wider text-gray-500">Comprador / Adquirente:</p>
                      <p className="text-xs font-bold">{settings.distributorName}</p>
                      <p className="text-[9px] mt-1">Dirección: {settings.address}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px]"><b>CUIT:</b> {settings.cuit}</p>
                      <p className="text-[9px]"><b>Condición IVA:</b> {settings.taxCondition}</p>
                      <p className="text-[9px]"><b>Destino Stock:</b> {selectedInvoiceTx.warehouse || 'Depósito Central'}</p>
                   </div>
                </div>

                {/* Items Table */}
                {invoiceDetails.items.length > 0 ? (
                  <table className="w-full text-left border-collapse border border-black text-black">
                     <thead>
                        <tr className="bg-gray-100 border-b border-black text-[8px] uppercase font-bold text-gray-700">
                           <th className="px-2 py-1.5 border-r border-black">Detalle Artículo</th>
                           <th className="px-2 py-1.5 border-r border-black text-right">Cant</th>
                           <th className="px-2 py-1.5 border-r border-black text-right">{invoiceDetails.isFacturaA ? 'Neto Unit' : 'Costo Unit'}</th>
                           <th className="px-2 py-1.5 border-r border-black text-center">Alic IVA</th>
                           <th className="px-2 py-1.5 text-right">Subtotal</th>
                        </tr>
                     </thead>
                     <tbody>
                        {invoiceDetails.items.map((item: any, idx: number) => {
                           const ivaRate = item.iva_rate !== undefined ? item.iva_rate : 21;
                           const costNet = item.cost_net;
                           const costFinal = item.cost_final || (costNet * (1 + ivaRate/100));
                           const rowSubtotal = costFinal * item.qty;
                           return (
                              <tr key={idx} className="border-b border-gray-300 text-[9px] text-black">
                                 <td className="px-2 py-1.5 border-r border-gray-300">{item.name}</td>
                                 <td className="px-2 py-1.5 border-r border-gray-300 text-right">{item.qty}</td>
                                 <td className="px-2 py-1.5 border-r border-gray-300 text-right font-mono">
                                    ${invoiceDetails.isFacturaA ? costNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : costFinal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                 </td>
                                 <td className="px-2 py-1.5 border-r border-gray-300 text-center font-mono">{ivaRate}%</td>
                                 <td className="px-2 py-1.5 text-right font-mono">${rowSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
                ) : (
                  <div className="border border-black p-6 text-center text-gray-500 italic bg-gray-50">
                    Detalle de artículos no disponible para esta factura de compra.
                  </div>
                )}

                {/* Bottom summary Block */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      {/* Interno Barcode / QR Simulation */}
                      <div className="border border-gray-300 p-1.5 rounded w-36 flex flex-col items-center bg-gray-50">
                         <BarcodeComponent 
                           value={selectedInvoiceTx.invoice_number || 'FAC-0000'} 
                           format="CODE128" 
                           width={1.0} 
                           height={24} 
                           displayValue={false} 
                           background="transparent"
                           lineColor="#000000"
                         />
                         <span className="text-[6px] font-mono text-gray-500 uppercase mt-0.5">Comprobante Autorizado Interno</span>
                      </div>
                   </div>

                   <div className="text-right space-y-1 text-[9px] pl-12">
                      {invoiceDetails.isFacturaA && invoiceDetails.items.length > 0 ? (
                         <div className="space-y-0.5">
                            {invoiceDetails.taxBreakdown.net21 > 0 && <p>Neto Gravado 21%: <span className="font-mono font-bold">${invoiceDetails.taxBreakdown.net21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                            {invoiceDetails.taxBreakdown.iva21 > 0 && <p>IVA 21%: <span className="font-mono font-bold">${invoiceDetails.taxBreakdown.iva21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                            {invoiceDetails.taxBreakdown.net105 > 0 && <p>Neto Gravado 10.5%: <span className="font-mono font-bold">${invoiceDetails.taxBreakdown.net105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                            {invoiceDetails.taxBreakdown.iva105 > 0 && <p>IVA 10.5%: <span className="font-mono font-bold">${invoiceDetails.taxBreakdown.iva105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                            {invoiceDetails.taxBreakdown.exempt > 0 && <p>Neto Exento: <span className="font-mono font-bold">${invoiceDetails.taxBreakdown.exempt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                         </div>
                      ) : (
                         <p className="text-[8px] italic text-gray-500">IVA Discriminado (21%): ${(selectedInvoiceTx.total - (selectedInvoiceTx.total / 1.21)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                      )}
                      <div className="pt-1.5 border-t border-black flex justify-between items-end">
                         <span className="text-[9px] font-bold uppercase">Importe Total</span>
                         <span className="text-sm font-bold font-mono">${selectedInvoiceTx.total.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {isPaymentReceiptModalOpen && selectedPaymentTx && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsPaymentReceiptModalOpen(false)} />
          <div className="glass-card max-w-2xl w-full border-brand-charcoal relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-0 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-[0.2em] bg-emerald-500/10 px-2 py-1 rounded">
                  Comprobante Interno de Pago
                </span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-2">
                  Recibo de Pago
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintPaymentReceipt()}
                  className="px-4 py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-brand-charcoal cursor-pointer"
                >
                  <FileText size={14} className="text-brand-gold" /> Imprimir Recibo
                </button>
                <button 
                  onClick={() => setIsPaymentReceiptModalOpen(false)} 
                  className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-brand-black">
              {/* Printable Payment Receipt Container */}
              <div ref={paymentReceiptPrintRef} className="bg-white text-black p-8 rounded-xl space-y-6 text-xs font-sans">
                {/* Interno Header Style */}
                <div className="border-2 border-black p-4 relative">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black w-14 h-14 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black leading-none">X</span>
                      <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">Comp.Int.</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-8 pt-4">
                      <div>
                         <h1 className="text-base font-bold tracking-tight uppercase">{activeProvider?.name}</h1>
                         <p className="text-[9px] text-gray-500">{activeProvider?.tax_condition}</p>
                         <p className="mt-2 text-[9px]">{activeProvider?.address || 'S/D'}</p>
                         <p className="text-[9px]">Teléfono: {activeProvider?.phone || 'S/D'}</p>
                         <p className="text-[9px]">Email: {activeProvider?.email || 'S/D'}</p>
                      </div>
                      <div className="text-right pl-12">
                         <h2 className="text-sm font-bold uppercase">Recibo de Pago</h2>
                         <p className="text-xs font-mono font-bold mt-0.5">Ref: {selectedPaymentTx.reference}</p>
                         <p className="text-[9px] text-gray-500 mt-2">Fecha: {selectedPaymentTx.date.split(',')[0]}</p>
                         <p className="text-[9px] text-gray-500">CUIT: {activeProvider?.cuit || 'S/D'}</p>
                         <p className="text-[9px] text-gray-500">Condición Fiscal: {activeProvider?.tax_condition}</p>
                      </div>
                   </div>
                </div>

                <div className="text-center text-[10px] font-black tracking-widest text-red-600 border border-red-600 py-1 uppercase">
                   DOCUMENTO NO VÁLIDO COMO FACTURA
                </div>

                {/* Receiver Section (Distribuidora) */}
                <div className="border border-black p-4 grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[8px] uppercase tracking-wider text-gray-500">Pagado por / Entregado por:</p>
                      <p className="text-xs font-bold">{settings.distributorName}</p>
                      <p className="text-[9px] mt-1">Dirección: {settings.address}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px]"><b>CUIT:</b> {settings.cuit}</p>
                      <p className="text-[9px]"><b>Condición IVA:</b> {settings.taxCondition}</p>
                   </div>
                </div>

                {/* Receipt Details Table */}
                <table className="w-full text-left border-collapse border border-black text-black">
                   <thead>
                      <tr className="bg-gray-100 border-b border-black text-[8px] uppercase font-bold text-gray-700">
                         <th className="px-2 py-1.5 border-r border-black">Concepto</th>
                         <th className="px-2 py-1.5 border-r border-black">Medio de Pago</th>
                         <th className="px-2 py-1.5 border-r border-black">Referencia</th>
                         <th className="px-2 py-1.5 text-right">Monto Abonado</th>
                      </tr>
                   </thead>
                   <tbody>
                      <tr className="border-b border-gray-300 text-[9px] text-black">
                         <td className="px-2 py-1.5 border-r border-gray-300">Pago Cuenta Corriente Proveedor</td>
                         <td className="px-2 py-1.5 border-r border-gray-300 font-bold">{selectedPaymentTx.payment_method || 'EFECTIVO'}</td>
                         <td className="px-2 py-1.5 border-r border-gray-300">{selectedPaymentTx.reference || 'S/D'}</td>
                         <td className="px-2 py-1.5 text-right font-mono font-bold">${Math.abs(selectedPaymentTx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                   </tbody>
                </table>

                {/* Bottom summary Block */}
                <div className="grid grid-cols-2 gap-4 pt-8">
                   <div className="flex flex-col justify-end">
                      <p className="text-[8px] text-gray-500 uppercase tracking-widest">Observaciones:</p>
                      <p className="text-[9px] italic text-gray-700 mt-1">{selectedPaymentTx.notes || 'Sin observaciones adicionales.'}</p>
                   </div>

                   <div className="text-right space-y-4">
                      <div className="border-b border-black pb-2 flex justify-between items-end">
                         <span className="text-[9px] font-bold uppercase">Total Abonado</span>
                         <span className="text-sm font-bold font-mono text-emerald-600">${Math.abs(selectedPaymentTx.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                      </div>
                      
                      <div className="pt-8 flex flex-col items-end">
                         <div className="w-40 border-t border-dashed border-black mt-8"></div>
                         <p className="text-[8px] font-bold uppercase tracking-wider text-center w-40 mt-1">Firma de Conformidad</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvidersManagement;
