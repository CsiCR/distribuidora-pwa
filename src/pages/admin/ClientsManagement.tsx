import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  TrendingUp, 
  MoreVertical, 
  ExternalLink,
  X,
  Check,
  Building2,
  Wallet,
  LayoutGrid,
  List,
  FileText,
  Copy
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useClientsStore } from '../../store/useClientsStore';
import { useTransactionsStore } from '../../store/useTransactionsStore';
import { useOrdersStore } from '../../store/useOrdersStore';
import { useStockStore } from '../../store/useStockStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import BarcodeComponent from 'react-barcode';
import { useReactToPrint } from 'react-to-print';

interface Client {
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
  last_purchase?: string;
  tax_condition: 'Responsable Inscripto' | 'Monotributista' | 'Consumidor Final' | 'Exento';
}

const ZONES = ['Zona Norte', 'Zona Sur', 'Centro', 'Periferia', 'Interior'];
const PRICE_LISTS = ['Minorista', 'Mayorista', 'Distribuidor'];
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ClientsManagement: React.FC = () => {
  const { clients, setClients, updateBalance } = useClientsStore();
  const { transactions, addTransaction, getTransactionsByClient } = useTransactionsStore();
  const { orders } = useOrdersStore();
  const { products } = useStockStore();
  const settings = useSettingsStore();
  const [activeClientIdMenu, setActiveClientIdMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveClientIdMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const activeClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const invoicePrintRef = useRef<HTMLDivElement>(null);

  const handlePrintInvoice = useReactToPrint({
    contentRef: invoicePrintRef,
    documentTitle: `Factura_${selectedInvoiceTx?.reference || 'oficial'}`,
    bodyClass: 'print-mode-invoice',
  });

  const handleViewInvoice = (tx: any) => {
    setSelectedInvoiceTx(tx);
    setIsInvoiceModalOpen(true);
  };

  const [selectedPaymentTx, setSelectedPaymentTx] = useState<any>(null);
  const [isPaymentReceiptModalOpen, setIsPaymentReceiptModalOpen] = useState(false);
  const paymentReceiptPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintPaymentReceipt = useReactToPrint({
    contentRef: paymentReceiptPrintRef,
    documentTitle: `Recibo_${selectedPaymentTx?.reference || 'cobro'}`,
    bodyClass: 'print-mode-invoice',
  });

  const handleViewPaymentReceipt = (tx: any) => {
    setSelectedPaymentTx(tx);
    setIsPaymentReceiptModalOpen(true);
  };

  const invoiceDetails = useMemo(() => {
    if (!selectedInvoiceTx) return null;
    const client = clients.find(c => c.id === selectedInvoiceTx.client_id);
    const orderId = selectedInvoiceTx.notes?.match(/REM-\d+/)?.[0];
    let order = orderId ? orders.find(o => o.id === orderId) : null;
    if (!order) {
      order = orders.find(o => o.total === selectedInvoiceTx.amount && (o.client_name === client?.fantasy_name || o.client_name === client?.name));
    }
    const items = order?.items || [];

    let net21 = 0;
    let net105 = 0;
    let exempt = 0;
    let iva21 = 0;
    let iva105 = 0;

    items.forEach((item: any) => {
      const prod = products.find(p => p.id === item.id || p.name === item.name);
      const ivaRate = prod?.iva_rate !== undefined ? prod.iva_rate : 21;
      const grossPrice = item.price;
      const quantity = item.quantity;
      
      if (ivaRate === 0) {
        exempt += grossPrice * quantity;
      } else if (ivaRate === 10.5) {
        const net = (grossPrice * quantity) / 1.105;
        const iva = (grossPrice * quantity) - net;
        net105 += net;
        iva105 += iva;
      } else {
        const net = (grossPrice * quantity) / 1.21;
        const iva = (grossPrice * quantity) - net;
        net21 += net;
        iva21 += iva;
      }
    });

    const totalNet = net21 + net105 + exempt;
    const totalIva = iva21 + iva105;

    return {
      order,
      client: client || { name: activeClient?.name || 'Consumidor Final', fantasy_name: activeClient?.fantasy_name || 'Consumidor Final', cuit: 'S/D', tax_condition: 'Consumidor Final', address: 'S/D', city: 'S/D' },
      items,
      isFacturaA: client?.tax_condition === 'Responsable Inscripto',
      taxBreakdown: { net21, iva21, net105, iva105, exempt, totalNet, totalIva }
    };
  }, [selectedInvoiceTx, orders, clients, products, activeClient]);



  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtors' | 'creditors'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const accountPrintRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: accountPrintRef,
    documentTitle: `Cuenta_Corriente_${clients.find(c => c.id === selectedClientId)?.fantasy_name || 'Cliente'}`,
    bodyClass: 'print-mode-ticket',
  });


  
  // Payment Form State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<any>('EFECTIVO');

  // Delete Form State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteAction, setDeleteAction] = useState<'inactivate' | 'delete'>('inactivate');
  const [deleteReason, setDeleteReason] = useState('');

  // Form States
  const [newName, setNewName] = useState('');
  const [newFantasy, setNewFantasy] = useState('');
  const [newCuit, setNewCuit] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newZone, setNewZone] = useState(ZONES[0]);
  const [newList, setNewList] = useState<Client['price_list']>('Minorista');
  const [newDays, setNewDays] = useState<string[]>([]);
  const [newTax, setNewTax] = useState<Client['tax_condition']>('Consumidor Final');

  const openAddModal = () => {
    setModalMode('add');
    setSelectedClientId(null);
    setNewName(''); setNewFantasy(''); setNewCuit(''); setNewEmail(''); setNewPhone('');
    setNewAddress(''); setNewCity(''); setNewZone(ZONES[0]); setNewList('Minorista'); setNewDays([]);
    setNewTax('Consumidor Final');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setModalMode('edit');
    setSelectedClientId(client.id);
    setNewName(client.name || '');
    setNewFantasy(client.fantasy_name || '');
    setNewCuit(client.cuit || '');
    setNewEmail(client.email || '');
    setNewPhone(client.phone || '');
    setNewAddress(client.address || '');
    setNewCity(client.city || '');
    setNewZone(client.zone || ZONES[0]);
    setNewList(client.price_list || 'Minorista');
    setNewDays(client.visit_days || []);
    setNewTax(client.tax_condition || 'Consumidor Final');
    setIsModalOpen(true);
  };

  const toggleStatus = (id: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'Activo' ? 'Inactivo' : 'Activo' } : c));
  };

  const handleDeleteClick = (client: Client) => {
    if (client.balance < 0) {
      alert("⚠️ No se puede dar de baja a un cliente con deuda pendiente (Saldo Negativo). Por favor, registre los pagos correspondientes antes de continuar.");
      return;
    }
    if (client.balance > 0) {
      alert(`⚠️ No se puede dar de baja a un cliente con saldo a favor ($${client.balance.toLocaleString()}). Por favor, liquide o devuelva el saldo antes de continuar.`);
      return;
    }
    setClientToDelete(client);
    setDeleteAction('inactivate');
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToDelete) return;
    
    if (deleteAction === 'delete') {
      if (confirm('¿Estás SEGURO de eliminar definitivamente a este cliente? Se borrará todo su historial.')) {
        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        setIsDeleteModalOpen(false);
      }
    } else {
      if (!deleteReason.trim()) {
        alert("Por favor, ingrese un motivo para la inactivación.");
        return;
      }
      setClients(prev => prev.map(c => c.id === clientToDelete.id ? { 
        ...c, 
        status: 'Inactivo',
        // Opcional: podrías guardar el deleteReason en un campo notes si lo tuvieras, por ahora lo inactivamos
      } : c));
      setIsDeleteModalOpen(false);
    }
  };

  const handleWhatsApp = (client: Client) => {
    // 1. Disparar diálogo de impresión
    handlePrint();
    
    // 2. Notificación en pantalla instructiva
    alert("📄 Se ha abierto el asistente de impresión para generar el PDF de la Cuenta Corriente.\n\nGuarde el archivo como PDF en su dispositivo y luego de presionar 'Aceptar', se abrirá WhatsApp para adjuntarlo y enviarlo.");
    
    // 3. Abrir WhatsApp
    const message = `Hola ${client.fantasy_name}, te adjunto el estado detallado de tu cuenta corriente en formato PDF. Saludos!`;
    const encodedMessage = encodeURIComponent(message);
    const phone = client.phone.replace(/\D/g, ''); 
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const handleCopyCatalogLink = (client: Client) => {
    const url = `${window.location.origin}/catalogo?c=${client.id}`;
    navigator.clipboard.writeText(url)
      .then(() => alert(`🔗 Enlace del catálogo personalizado copiado para ${client.fantasy_name || client.name}:\n\n${url}`))
      .catch(() => alert('No se pudo copiar el enlace automáticamente.'));
  };


  const handleOpenPayment = () => {
    if (activeClient && activeClient.balance < 0) {
      setPaymentAmount(Math.abs(activeClient.balance).toString());
    } else {
      setPaymentAmount('');
    }
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    
    // Add Transaction
    addTransaction({
      client_id: selectedClientId,
      type: 'PAGO',
      reference: paymentRef || `Pago ${paymentMethod}`,
      amount: amount,
      status: 'PAGADO',
      payment_method: paymentMethod,
      notes: paymentRef
    });

    // Update Client Balance
    updateBalance(selectedClientId, amount);

    // Reset Form
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentMethod('EFECTIVO');
    setIsPaymentModalOpen(false);
    alert('Pago registrado correctamente');
  };

  const filteredClients = useMemo(() => {
    return (clients || []).filter(client => {
      if (!client) return false;
      const name = String(client.name || '');
      const fantasyName = String(client.fantasy_name || '');
      const cuit = String(client.cuit || '');
      
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           fantasyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cuit.includes(searchTerm);
      const matchesZone = zoneFilter === 'all' || client.zone === zoneFilter;
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      const matchesDebt = balanceFilter === 'all' || 
                          (balanceFilter === 'debtors' && client.balance < 0) || 
                          (balanceFilter === 'creditors' && client.balance > 0);
      return matchesSearch && matchesZone && matchesStatus && matchesDebt;
    });
  }, [clients, searchTerm, zoneFilter, statusFilter, balanceFilter]);

  const debtorClients = clients.filter(c => c.balance < 0);
  const totalDebt = debtorClients.reduce((acc, c) => acc + Math.abs(c.balance), 0);

  const creditorClients = clients.filter(c => c.balance > 0);
  const totalCredit = creditorClients.reduce((acc, c) => acc + c.balance, 0);

  const netBalance = totalCredit - totalDebt;


  const accountHistory = useMemo(() => {
    if (!selectedClientId) return [];
    const clientTransactions = getTransactionsByClient(selectedClientId);
    
    // Ordenar transacciones por fecha descendente (más recientes primero)
    return [...clientTransactions].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (isNaN(timeA) || isNaN(timeB)) {
        return b.date.localeCompare(a.date);
      }
      return timeB - timeA;
    });
  }, [transactions, selectedClientId]);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-brand-smoke uppercase tracking-tight">Gestión de Clientes</h1>
          <p className="text-brand-steel text-sm font-medium">Gestión de carteras y cuentas corrientes</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-gold px-6 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2 self-start md:self-auto shadow-lg shadow-brand-gold/10 cursor-pointer"
        >
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        {/* Con Deuda (En Calle) */}
        <button 
          onClick={() => setBalanceFilter(prev => prev === 'debtors' ? 'all' : 'debtors')}
          className={cn(
            "glass-card p-3 sm:px-5 sm:py-3 border-rose-500/20 bg-rose-500/5 transition-all hover:scale-105 active:scale-95 text-left flex flex-col justify-between cursor-pointer",
            balanceFilter === 'debtors' && "ring-2 ring-rose-500 bg-rose-500/10"
          )}
          title={`Deuda total de clientes: $${totalDebt.toLocaleString()} (${debtorClients.length} cuentas)`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-rose-400 tracking-widest mb-1 truncate" title="Deuda Clientes">Deuda Clientes</div>
          <div className="text-xs sm:text-xl font-display font-bold text-rose-400 truncate" title={`${debtorClients.length} Cuentas`}>
            {debtorClients.length} <span className="text-[8px] sm:text-[10px] font-sans text-rose-400/60 uppercase">Cts</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-rose-400 mt-1 truncate" title={`$${totalDebt.toLocaleString()}`}>${totalDebt.toLocaleString()}</div>
        </button>

        {/* A Favor del Cliente */}
        <button 
          onClick={() => setBalanceFilter(prev => prev === 'creditors' ? 'all' : 'creditors')}
          className={cn(
            "glass-card p-3 sm:px-5 sm:py-3 border-emerald-500/20 bg-emerald-500/5 transition-all hover:scale-105 active:scale-95 text-left flex flex-col justify-between cursor-pointer",
            balanceFilter === 'creditors' && "ring-2 ring-emerald-500 bg-emerald-500/10"
          )}
          title={`Saldo total a favor de clientes: $${totalCredit.toLocaleString()} (${creditorClients.length} cuentas)`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-emerald-500 tracking-widest mb-1 truncate" title="A Favor Cliente">A Favor Cliente</div>
          <div className="text-xs sm:text-xl font-display font-bold text-emerald-400 truncate" title={`${creditorClients.length} Cuentas`}>
            {creditorClients.length} <span className="text-[8px] sm:text-[10px] font-sans text-emerald-500/60 uppercase">Cts</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 truncate" title={`$${totalCredit.toLocaleString()}`}>${totalCredit.toLocaleString()}</div>
        </button>

        {/* Balance Neto */}
        <div 
          className="glass-card p-3 sm:px-5 sm:py-3 border-brand-charcoal bg-brand-charcoal/20 flex flex-col justify-between"
          title={`Balance Neto: ${netBalance < 0 ? 'A Cobrar' : netBalance > 0 ? 'A Entregar' : 'Neutro'} $${Math.abs(netBalance).toLocaleString()}`}
        >
          <div className="text-[8px] sm:text-[10px] uppercase font-black text-brand-steel tracking-widest mb-1 truncate" title="Balance Neto">Balance Neto</div>
          <div className={cn(
            "text-xs sm:text-xl md:text-2xl font-display font-black truncate",
            netBalance < 0 ? "text-rose-400" : netBalance > 0 ? "text-emerald-400" : "text-brand-smoke"
          )} title={`$${Math.abs(netBalance).toLocaleString()}`}>${Math.abs(netBalance).toLocaleString()}</div>
          <div className="text-[7px] sm:text-[9px] uppercase font-bold tracking-widest text-brand-steel mt-1 truncate" title={netBalance < 0 ? 'A Cobrar' : netBalance > 0 ? 'A Entregar' : 'Neutro'}>
            {netBalance < 0 ? 'A Cobrar' : netBalance > 0 ? 'A Entregar' : 'Neutro'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-3 sm:p-4 mb-8 flex flex-col md:flex-row gap-3 border-brand-charcoal items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Razón Social, Nombre de Fantasía o CUIT..." 
            className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-11 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap md:flex-nowrap gap-2 items-center justify-between md:justify-end">
          <select 
            className="flex-1 md:flex-none bg-brand-black border border-brand-charcoal rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-brand-gold h-[38px] cursor-pointer"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="all">📍 Todas las Zonas</option>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          
          <select 
            className="flex-1 md:flex-none bg-brand-black border border-brand-charcoal rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-brand-gold h-[38px] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">⚡ Todos los Estados</option>
            <option value="Activo">Activos</option>
            <option value="Inactivo">Inactivos</option>
            <option value="Pendiente">Pendientes de Alta</option>
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

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map(client => (
            <div key={client.id} className={cn(
              "glass-card group hover:border-brand-gold/30 transition-all duration-500 overflow-hidden flex flex-col relative",
              client.status === 'Inactivo' && "opacity-60 bg-brand-charcoal/20 grayscale-[0.5]",
              client.status === 'Pendiente' && "border-brand-gold/40 shadow-lg shadow-brand-gold/5 bg-brand-gold/5"
            )}>
              {client.status === 'Inactivo' && (
                <div className="absolute top-0 left-0 right-0 bg-brand-charcoal py-1 text-center border-b border-brand-charcoal shadow-sm z-10">
                  <span className="text-[9px] font-black text-brand-steel uppercase tracking-[0.3em]">Cuenta Inactiva</span>
                </div>
              )}
              {client.status === 'Pendiente' && (
                <div className="absolute top-0 left-0 right-0 bg-brand-gold/20 py-1 text-center border-b border-brand-gold/30 shadow-sm z-10">
                  <span className="text-[9px] font-black text-brand-gold uppercase tracking-[0.3em]">Pendiente de Alta</span>
                </div>
              )}

              <div className={cn(
                "p-6 border-b border-brand-charcoal flex justify-between items-start", 
                (client.status === 'Inactivo' || client.status === 'Pendiente') && "pt-10"
              )}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "w-2 h-2 rounded-full shadow-sm",
                      client.status === 'Activo' 
                        ? "bg-emerald-500 shadow-emerald-500/50" 
                        : client.status === 'Pendiente' 
                          ? "bg-brand-gold shadow-brand-gold/50 animate-pulse" 
                          : "bg-brand-steel shadow-brand-steel/50"
                    )} />
                    <span className="text-[10px] font-black uppercase text-brand-steel tracking-widest">{client.price_list}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-brand-smoke group-hover:text-brand-gold transition-colors">{client.fantasy_name}</h3>
                  <p className="text-xs text-brand-steel font-medium">{client.name}</p>
                </div>
                <div className="relative group/menu">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveClientIdMenu(activeClientIdMenu === client.id ? null : client.id);
                    }}
                    className="p-2 hover:bg-brand-charcoal rounded-lg text-brand-steel transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>
                  <div className={cn(
                    "absolute right-0 top-full mt-2 w-48 bg-brand-graphite border border-brand-charcoal rounded-xl shadow-2xl transition-all z-50 overflow-hidden",
                    activeClientIdMenu === client.id 
                      ? "opacity-100 visible pointer-events-auto" 
                      : "opacity-0 invisible pointer-events-none group-hover/menu:opacity-100 group-hover/menu:visible group-hover/menu:pointer-events-auto"
                  )}>
                    <button onClick={() => openEditModal(client)} className="w-full px-4 py-3 text-left text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3">
                      <Plus size={14} className="rotate-45" /> Editar Datos
                    </button>
                    {client.status === 'Pendiente' ? (
                      <button onClick={() => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Activo' } : c))} className="w-full px-4 py-3 text-left text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-3">
                        <Check size={14} className="text-emerald-500" /> Aprobar Alta
                      </button>
                    ) : (
                      <button onClick={() => toggleStatus(client.id)} className="w-full px-4 py-3 text-left text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3">
                        {client.status === 'Activo' ? <X size={14} className="text-rose-500" /> : <Check size={14} className="text-emerald-500" />}
                        {client.status === 'Activo' ? 'Suspender Cliente' : 'Activar Cliente'}
                      </button>
                    )}
                    <button onClick={() => handleDeleteClick(client)} disabled={client.balance !== 0} className="w-full px-4 py-3 text-left text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 border-t border-brand-charcoal/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:text-brand-steel cursor-pointer">
                      <X size={14} /> Dar de Baja
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs text-brand-steel">
                    <MapPin size={14} className="text-brand-gold" />
                    <span>{client.address}, {client.city}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-brand-steel">
                    <Building2 size={14} className="text-brand-gold" />
                    <span className="font-mono">CUIT: {client.cuit}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-brand-steel">
                    <Phone size={14} className="text-brand-gold" />
                    <span>{client.phone}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-brand-charcoal flex justify-between items-center">
                  <div className="flex flex-wrap gap-1">
                    {client.visit_days.map(day => (
                      <span key={day} className="text-[9px] px-2 py-0.5 bg-brand-charcoal rounded font-bold text-brand-steel uppercase tracking-tighter">{day}</span>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-brand-steel mb-0.5 tracking-widest text-left">Estado Cuenta</p>
                    <div className={cn(
                      "text-sm font-display font-bold",
                      client.balance < 0 ? "text-rose-400" : client.balance > 0 ? "text-emerald-400" : "text-brand-smoke"
                    )}>
                      {client.balance < 0 ? `-$${Math.abs(client.balance).toLocaleString()}` : `$${client.balance.toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-brand-charcoal/30 flex gap-2">
                {client.status === 'Pendiente' ? (
                  <button 
                    onClick={() => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Activo' } : c))}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={14} className="text-emerald-400" /> Aprobar Alta
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setIsAccountOpen(true);
                    }}
                    className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Wallet size={14} className="text-brand-gold" /> Ver Cuenta
                  </button>
                )}
                <button 
                  onClick={() => openEditModal(client)}
                  className="px-4 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold py-2 rounded-lg text-xs font-black transition-all border border-brand-gold/20 uppercase tracking-widest cursor-pointer"
                >
                  Ficha
                </button>
                <button 
                  onClick={() => handleCopyCatalogLink(client)}
                  className="px-3 bg-brand-wine/15 hover:bg-brand-wine/30 text-rose-400 py-2 rounded-lg text-xs font-black transition-all border border-brand-wine/25 uppercase tracking-widest cursor-pointer flex items-center gap-1.5"
                  title="Copiar enlace de catálogo"
                >
                  <Copy size={14} />
                  <span>Catálogo</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card border-brand-charcoal overflow-hidden">
          {/* Mobile/Tablet view: list cards */}
          <div className="block lg:hidden bg-brand-black/20 p-3 sm:p-4">
            {filteredClients.length === 0 ? (
              <div className="p-6 text-center text-brand-steel">No se encontraron clientes.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredClients.map(client => (
                  <div 
                    key={client.id} 
                    className={cn(
                      "glass-card p-4 space-y-3 flex flex-col justify-between border-brand-charcoal/40 bg-brand-charcoal/10",
                      client.status === 'Inactivo' && "opacity-60 grayscale-[0.5]",
                      client.status === 'Pendiente' && "border-brand-gold/30 bg-brand-gold/5 shadow-md shadow-brand-gold/5"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-display font-bold text-sm text-brand-smoke truncate max-w-[180px]" title={client.fantasy_name}>{client.fantasy_name}</h4>
                          <p className="text-[10px] text-brand-steel font-mono font-medium">CUIT: {client.cuit}</p>
                        </div>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0",
                          client.status === 'Activo' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          client.status === 'Pendiente' && "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
                          client.status === 'Inactivo' && "bg-brand-charcoal text-brand-steel border-brand-charcoal"
                        )}>
                          {client.status === 'Pendiente' ? 'Pendiente' : client.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div className="text-brand-steel space-y-1">
                          <div className="flex items-center gap-1">
                            <Phone size={10} className="text-brand-gold" /> {client.phone}
                          </div>
                          <p className="text-[10px] truncate max-w-[150px]">{client.zone} • {client.price_list}</p>
                        </div>
                        <div className={cn(
                          "font-mono font-bold text-xs text-right",
                          client.balance < 0 ? "text-rose-400" : client.balance > 0 ? "text-emerald-400" : "text-brand-steel"
                        )}>
                          {client.balance < 0 ? `-$${Math.abs(client.balance).toLocaleString()}` : `$${client.balance.toLocaleString()}`}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-brand-charcoal/20 mt-auto">
                      <button 
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setIsAccountOpen(true);
                        }}
                        className="py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Wallet size={12} className="text-brand-gold" /> Cuenta
                      </button>
                      <button 
                        onClick={() => openEditModal(client)}
                        className="py-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Ficha
                      </button>
                      {client.status === 'Pendiente' ? (
                        <button 
                          type="button"
                          onClick={() => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Activo' } : c))}
                          className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Aprobar
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => toggleStatus(client.id)}
                          className={cn(
                            "py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border",
                            client.status === 'Activo' 
                              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20" 
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                          )}
                        >
                          {client.status === 'Activo' ? 'Suspender' : 'Activar'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteClick(client)}
                        disabled={client.balance !== 0}
                        className="py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-brand-charcoal/10 disabled:border-brand-charcoal/20 disabled:text-brand-steel"
                      >
                        Baja
                      </button>
                      <button 
                        onClick={() => handleCopyCatalogLink(client)}
                        className="col-span-2 py-2.5 bg-brand-wine/15 hover:bg-brand-wine/30 text-rose-400 border border-brand-wine/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy size={12} /> Copiar Link Catálogo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop/Tablet view: standard table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-brand-charcoal/50 border-b border-brand-charcoal text-[9px] uppercase font-black text-brand-steel tracking-wider">
                  <th className="px-6 py-4">Razón Social / Fantasía</th>
                  <th className="px-6 py-4">CUIT</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Zona / Reparto</th>
                  <th className="px-6 py-4">Perfil Comercial</th>
                  <th className="px-6 py-4 text-right">Saldo Cuenta</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-charcoal/30">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-brand-steel">No se encontraron clientes.</td>
                  </tr>
                ) : (
                  filteredClients.map(client => (
                    <tr key={client.id} className={cn(
                      "hover:bg-brand-charcoal/10 transition-colors",
                      client.status === 'Inactivo' && "opacity-60 grayscale-[0.5]",
                      client.status === 'Pendiente' && "bg-brand-gold/5 hover:bg-brand-gold/10"
                    )}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-display font-bold text-sm text-brand-smoke">{client.fantasy_name}</div>
                          {client.status === 'Pendiente' && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-brand-gold text-brand-black font-black uppercase tracking-wider">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-steel font-medium">{client.name}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-brand-smoke">
                        {client.cuit}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-brand-smoke">
                          <Phone size={12} className="text-brand-gold" /> {client.phone}
                        </div>
                        <div className="text-[10px] text-brand-steel">{client.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-brand-smoke">{client.zone}</div>
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {client.visit_days.map(d => (
                            <span key={d} className="text-[8px] px-1 bg-brand-charcoal rounded text-brand-steel uppercase font-bold">{d.substring(0, 2)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-brand-smoke">{client.price_list}</div>
                        <div className="text-[10px] text-brand-steel">{client.tax_condition}</div>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-mono font-bold text-sm",
                        client.balance < 0 ? "text-rose-400" : client.balance > 0 ? "text-emerald-400" : "text-brand-smoke"
                      )}>
                        {client.balance < 0 ? `-$${Math.abs(client.balance).toLocaleString()}` : `$${client.balance.toLocaleString()}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => handleCopyCatalogLink(client)}
                            className="px-2.5 py-1.5 bg-brand-wine/15 hover:bg-brand-wine/30 border border-brand-wine/25 text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                            title="Copiar enlace de catálogo"
                          >
                            <Copy size={12} />
                            <span>Catálogo</span>
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setIsAccountOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Wallet size={12} className="text-brand-gold" /> Cuenta
                          </button>
                          <button 
                            onClick={() => openEditModal(client)}
                            className="px-2.5 py-1.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-lg text-[10px] font-black border border-brand-gold/20 uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Ficha
                          </button>
                          {client.status === 'Pendiente' ? (
                            <button 
                              type="button"
                              onClick={() => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Activo' } : c))}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Aprobar
                            </button>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => toggleStatus(client.id)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-wider transition-all cursor-pointer",
                                client.status === 'Activo' 
                                  ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20" 
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                              )}
                            >
                              {client.status === 'Activo' ? 'Suspender' : 'Activar'}
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteClick(client)}
                            disabled={client.balance !== 0}
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

      {/* Current Account Centered Modal */}
      {isAccountOpen && activeClient && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsAccountOpen(false)} />
          <div className="glass-card max-w-4xl w-full border-brand-charcoal p-0 overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-in zoom-in duration-200 shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.2em] bg-brand-gold/10 px-2 py-1 rounded">
                  Ficha de Cuenta Corriente
                </span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-2">
                  {activeClient.fantasy_name}
                </h3>
                <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest mt-1">
                  CUIT: {activeClient.cuit} • {activeClient.tax_condition} • {activeClient.address}, {activeClient.city}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrint()}
                  className="px-4 py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-brand-charcoal cursor-pointer"
                >
                  <ExternalLink size={14} className="text-brand-gold" /> Imprimir Cta Cte
                </button>
                <button 
                  onClick={() => setIsAccountOpen(false)} 
                  className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={cn(
                  "p-5 rounded-2xl border flex flex-col justify-between h-28",
                  activeClient.balance < 0 ? "bg-rose-500/5 border-rose-500/20" : activeClient.balance > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-brand-charcoal/20 border-brand-charcoal"
                )}>
                  <span className="text-[9px] font-black text-brand-steel uppercase tracking-[0.2em]">Saldo Comercial</span>
                  <div className="mt-2">
                    <span className={cn(
                      "text-2xl font-display font-black",
                      activeClient.balance < 0 ? "text-rose-400" : activeClient.balance > 0 ? "text-emerald-400" : "text-brand-smoke"
                    )}>
                      {activeClient.balance < 0 ? `Debe $${Math.abs(activeClient.balance).toLocaleString()}` : activeClient.balance > 0 ? `A Favor $${activeClient.balance.toLocaleString()}` : 'Al Día'}
                    </span>
                  </div>
                  <span className="text-[8px] text-brand-steel font-bold uppercase mt-1">Saldo en Cuenta Maestro</span>
                </div>

                <div className="p-5 rounded-2xl border border-brand-charcoal bg-brand-charcoal/20 flex flex-col justify-between h-28">
                  <span className="text-[9px] font-black text-brand-steel uppercase tracking-[0.2em]">Último Movimiento</span>
                  <div className="mt-2">
                    {accountHistory.length > 0 ? (
                      <div>
                        <div className={cn(
                          "text-lg font-display font-bold",
                          accountHistory[0].type === 'PAGO' ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {accountHistory[0].type === 'PAGO' ? 'Cobranza' : 'Factura'}: ${Math.abs(accountHistory[0].amount).toLocaleString()}
                        </div>
                        <span className="text-[9px] text-brand-steel font-bold uppercase">{accountHistory[0].date.split(',')[0]}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-brand-steel">Sin movimientos</span>
                    )}
                  </div>
                  <span className="text-[8px] text-brand-steel font-bold uppercase mt-1">Última operación registrada</span>
                </div>

                <div className="p-5 rounded-2xl border border-brand-charcoal bg-brand-charcoal/20 flex flex-col justify-center gap-2 h-28">
                  <button
                    onClick={handleOpenPayment}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 cursor-pointer"
                  >
                    <Wallet size={14} /> Registrar Cobranza
                  </button>
                  <button
                    onClick={() => handleWhatsApp(activeClient)}
                    className="w-full bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-brand-charcoal cursor-pointer"
                  >
                    <Phone size={14} className="text-emerald-500" /> Compartir por WhatsApp
                  </button>
                </div>
              </div>

              {/* Ledger Table (Libro Mayor) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase text-brand-steel tracking-[0.3em] flex items-center gap-2">
                    <TrendingUp size={12} /> Libro Mayor (Cta Cte)
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
                          accountHistory.map(tx => {
                            const isDebito = tx.type === 'FACTURA' || tx.type === 'NOTA_DEBITO';
                            return (
                              <tr key={tx.id} className="hover:bg-brand-charcoal/10 transition-colors">
                                <td className="px-4 py-3 text-brand-steel font-mono">{tx.date}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                    (tx.type === 'PAGO' || tx.type === 'NOTA_CREDITO') ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-400"
                                  )}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-brand-smoke max-w-[200px] truncate" title={tx.notes || tx.reference}>
                                  <span>{tx.reference} {tx.notes && `(${tx.notes})`}</span>
                                  {tx.payment_method && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 block">[{tx.payment_method}]</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-rose-400 font-mono font-bold">
                                  {isDebito ? `$${tx.amount.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right text-emerald-400 font-mono font-bold">
                                  {!isDebito ? `$${tx.amount.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {tx.type === 'FACTURA' ? (
                                    <button
                                      onClick={() => handleViewInvoice(tx)}
                                      className="px-2.5 py-1 bg-brand-gold/10 hover:bg-brand-gold/25 border border-brand-gold/20 text-brand-gold rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      title="Ver Factura Oficial"
                                    >
                                      <FileText size={12} />
                                      <span>Ver Factura</span>
                                    </button>
                                  ) : tx.type === 'PAGO' ? (
                                    <button
                                      onClick={() => handleViewPaymentReceipt(tx)}
                                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      title="Ver Recibo de Cobranza"
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
              <h1 className="text-2xl font-bold uppercase tracking-tight">Estado de Cuenta Corriente</h1>
              <p className="text-gray-600 font-bold mt-1 uppercase text-[9px] tracking-widest">Resumen detallado de movimientos comerciales</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold">DISTRIBUIDORA</h2>
              <p className="text-[10px] text-gray-500">Fecha de Reporte: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {activeClient && (
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 border border-gray-200 rounded">
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Cliente / Cuenta</p>
                <p className="font-bold text-sm text-black">{activeClient.fantasy_name}</p>
                <p className="text-gray-600">{activeClient.name}</p>
                <p className="text-gray-600">{activeClient.address}, {activeClient.city}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Detalles Impositivos</p>
                <p className="font-bold text-gray-700">CUIT: {activeClient.cuit}</p>
                <p className="text-gray-600">Condición IVA: {activeClient.tax_condition}</p>
                <p className="font-bold text-black mt-1">
                  Saldo Actual: {activeClient.balance < 0 ? `DEBE $${Math.abs(activeClient.balance).toLocaleString()}` : activeClient.balance > 0 ? `A FAVOR $${activeClient.balance.toLocaleString()}` : 'AL DÍA'}
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
                <th className="border border-gray-300 px-3 py-2 text-right">Debe</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Haber</th>
              </tr>
            </thead>
            <tbody>
              {accountHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-3 py-6 text-center text-gray-500">No se registran movimientos.</td>
                </tr>
              ) : (
                accountHistory.map(tx => {
                  const isDebito = tx.type === 'FACTURA' || tx.type === 'NOTA_DEBITO';
                  return (
                    <tr key={tx.id} className="border-b border-gray-200">
                      <td className="border border-gray-300 px-3 py-2 font-mono text-[9px]">{tx.date}</td>
                      <td className="border border-gray-300 px-3 py-2 font-bold text-[9px]">{tx.type}</td>
                      <td className="border border-gray-300 px-3 py-2 text-gray-800">{tx.reference} {tx.notes && `(${tx.notes})`}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold text-red-600">
                        {isDebito ? `$${tx.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-mono font-bold text-green-600">
                        {!isDebito ? `$${tx.amount.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-8 border-t border-black pt-4 flex justify-between items-center text-[10px]">
            <p className="text-gray-500">Gracias por su confianza comercial.</p>
            <p className="font-bold">Distribuidora Oficial</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (modalMode === 'add') {
                const newClient: Client = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: newName,
                  fantasy_name: newFantasy,
                  cuit: newCuit,
                  email: newEmail,
                  phone: newPhone,
                  address: newAddress,
                  city: newCity,
                  zone: newZone,
                  price_list: newList,
                  visit_days: newDays,
                  status: 'Activo',
                  balance: 0,
                  tax_condition: newTax
                };
                setClients([newClient, ...clients]);
              } else {
                setClients(prev => prev.map(c => c.id === selectedClientId ? {
                  ...c,
                  name: newName,
                  fantasy_name: newFantasy,
                  cuit: newCuit,
                  email: newEmail,
                  phone: newPhone,
                  address: newAddress,
                  city: newCity,
                  zone: newZone,
                  price_list: newList,
                  visit_days: newDays,
                  tax_condition: newTax
                } : c));
              }
              setIsModalOpen(false);
            }} 
            className="glass-card max-w-lg w-full border-brand-charcoal relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-6 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-brand-charcoal pb-4 mb-6">
              <div>
                <h3 className="text-lg font-display font-black text-brand-gold uppercase tracking-wider">
                  {modalMode === 'add' ? 'Registrar Cliente' : 'Editar Cliente'}
                </h3>
                <p className="text-[9px] font-black text-brand-steel uppercase tracking-widest mt-1">
                  {modalMode === 'add' ? 'Ingreso de nuevo cliente al sistema' : `Modificando: ${newFantasy}`}
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
                  placeholder="Ej: Distribuidora S.A." 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Nombre de Fantasía</label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  placeholder="Ej: Los Hermanos" 
                  required 
                  value={newFantasy} 
                  onChange={e => setNewFantasy(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">CUIT</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke font-mono focus:border-brand-gold outline-none transition-all" 
                    placeholder="20-12345678-9" 
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
                    <option value="Consumidor Final">Consumidor Final</option>
                    <option value="Responsable Inscripto">Responsable Inscripto</option>
                    <option value="Monotributista">Monotributista</option>
                    <option value="Exento">Exento</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="Ej: 11 1234 5678" 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="cliente@correo.com" 
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
                    required 
                    value={newAddress} 
                    onChange={e => setNewAddress(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Ciudad / Localidad</label>
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                    placeholder="Ej: CABA" 
                    required 
                    value={newCity} 
                    onChange={e => setNewCity(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-brand-charcoal/50 pt-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Zona de Reparto</label>
                  <select 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer" 
                    value={newZone} 
                    onChange={e => setNewZone(e.target.value)}
                  >
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Lista de Precios</label>
                  <select 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer" 
                    value={newList} 
                    onChange={e => setNewList(e.target.value as any)}
                  >
                    {PRICE_LISTS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1 border-t border-brand-charcoal/50 pt-4">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-2">Días de Visita / Reparto</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(day => {
                    const isSelected = newDays.includes(day);
                    return (
                      <button 
                        key={day}
                        type="button"
                        onClick={() => isSelected ? setNewDays(newDays.filter(d => d !== day)) : setNewDays([...newDays, day])}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer",
                          isSelected 
                            ? "bg-brand-gold text-brand-black border-brand-gold shadow-md" 
                            : "bg-brand-charcoal/50 text-brand-steel border-brand-charcoal hover:border-brand-gold/30"
                        )}
                      >
                        {day.substring(0, 2).toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer / Action Buttons */}
            <div className="flex gap-3 mt-6 border-t border-brand-charcoal pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 btn-gold py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsPaymentModalOpen(false)} />
          <div className="glass-card w-full max-w-sm p-0 relative z-10 border-emerald-500/30 overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-emerald-500/10 px-6 py-4 border-b border-emerald-500/20 flex justify-between items-center">
              <h3 className="text-lg font-display font-bold flex items-center gap-2 uppercase text-emerald-500">
                <Wallet size={18} /> Registrar Cobranza
              </h3>
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)} 
                className="p-2 hover:bg-emerald-500/20 rounded-full text-brand-steel hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Monto del Pago</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gold font-bold">$</span>
                  <input 
                    type="number" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl pl-8 pr-4 py-2.5 text-white text-xl font-display font-bold outline-none focus:border-emerald-500 transition-all" 
                    placeholder="0.00" 
                    required 
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(e.target.value)} 
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Medio de Pago</label>
                <select 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-white text-xs font-bold outline-none focus:border-brand-gold cursor-pointer"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="EFECTIVO">💵 Efectivo</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                  <option value="CHEQUE">📝 Cheque</option>
                  <option value="MERCADO_PAGO">📱 Mercado Pago</option>
                  <option value="CREDITO">💳 Crédito</option>
                  <option value="OTRO"> OTRO</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Referencia / Comentario</label>
                <textarea 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-brand-gold h-20 resize-none transition-all" 
                  placeholder="Ej: Nro de transferencia, Banco, etc..." 
                  value={paymentRef} 
                  onChange={e => setPaymentRef(e.target.value)} 
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-brand-charcoal mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsPaymentModalOpen(false)} 
                  className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal (Venta) */}
      {isInvoiceModalOpen && selectedInvoiceTx && invoiceDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsInvoiceModalOpen(false)} />
          <div className="glass-card max-w-2xl w-full border-brand-charcoal relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-0 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.2em] bg-brand-gold/10 px-2 py-1 rounded">
                  Comprobante Impositivo
                </span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-2">
                  Factura Oficial {invoiceDetails.isFacturaA ? 'A' : 'B'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintInvoice()}
                  className="px-4 py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-brand-charcoal cursor-pointer"
                >
                  <FileText size={14} className="text-brand-gold" /> Imprimir Factura
                </button>
                <button 
                  onClick={() => setIsInvoiceModalOpen(false)} 
                  className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-brand-black">
              {/* Printable Invoice Container */}
              <div ref={invoicePrintRef} className="bg-white text-black p-8 rounded-xl space-y-6 text-xs font-sans">
                {/* Interno Header Style */}
                <div className="border-2 border-black p-4 relative">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black w-14 h-14 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black leading-none">{invoiceDetails.isFacturaA ? 'A' : 'B'}</span>
                      <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">Comp.Int.</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-8 pt-4">
                      <div>
                         <h1 className="text-base font-bold tracking-tight uppercase">{settings.distributorName}</h1>
                         <p className="text-[9px] text-gray-500">{settings.taxCondition}</p>
                         <p className="mt-2 text-[9px]">{settings.address}</p>
                         <p className="text-[9px]">Teléfono: {settings.phone}</p>
                         <p className="text-[9px]">Email: {settings.email}</p>
                      </div>
                      <div className="text-right pl-12">
                         <h2 className="text-sm font-bold uppercase">Factura Comercial</h2>
                         <p className="text-xs font-mono font-bold mt-0.5">Nro: {selectedInvoiceTx.reference}</p>
                         <p className="text-[9px] text-gray-500 mt-2">Fecha: {selectedInvoiceTx.date.split(',')[0]}</p>
                         <p className="text-[9px] text-gray-500">CUIT: {settings.cuit}</p>
                         <p className="text-[9px] text-gray-500">Ingresos Brutos: {settings.ingresosBrutos}</p>
                         <p className="text-[9px] text-gray-500">Inicio de Actividades: {settings.initActivity}</p>
                      </div>
                   </div>
                </div>

                {/* Client Section */}
                <div className="border border-black p-4 grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[8px] uppercase tracking-wider text-gray-500">Señor(es):</p>
                      <p className="text-xs font-bold">{invoiceDetails.client.name || invoiceDetails.client.fantasy_name}</p>
                      <p className="text-[9px] mt-1">Dirección: {invoiceDetails.client.address || 'S/D'} - {invoiceDetails.client.city || 'S/D'}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px]"><b>CUIT:</b> {invoiceDetails.client.cuit || 'S/D'}</p>
                      <p className="text-[9px]"><b>Condición IVA:</b> {invoiceDetails.client.tax_condition || 'S/D'}</p>
                      <p className="text-[9px]"><b>Forma de Pago:</b> Cuenta Corriente</p>
                   </div>
                </div>

                {/* Items Table */}
                {invoiceDetails.items.length > 0 ? (
                  <table className="w-full text-left border-collapse border border-black text-black">
                     <thead>
                        <tr className="bg-gray-100 border-b border-black text-[8px] uppercase font-bold text-gray-700">
                           <th className="px-2 py-1.5 border-r border-black">Código/SKU</th>
                           <th className="px-2 py-1.5 border-r border-black">Detalle</th>
                           <th className="px-2 py-1.5 border-r border-black text-right">Cant</th>
                           <th className="px-2 py-1.5 border-r border-black text-right">{invoiceDetails.isFacturaA ? 'Neto Unit' : 'Precio Unit'}</th>
                           <th className="px-2 py-1.5 border-r border-black text-center">Alic IVA</th>
                           <th className="px-2 py-1.5 text-right">Subtotal</th>
                        </tr>
                     </thead>
                     <tbody>
                        {invoiceDetails.items.map((item: any) => {
                           const prod = products.find(p => p.id === item.id || p.name === item.name);
                           const ivaRate = prod?.iva_rate !== undefined ? prod.iva_rate : 21;
                           const grossPrice = item.price;
                           const netPrice = ivaRate === 0 ? grossPrice : grossPrice / (1 + ivaRate/100);
                           const rowSubtotal = grossPrice * item.quantity;
                           return (
                              <tr key={item.id} className="border-b border-gray-300 text-[9px] text-black">
                                 <td className="px-2 py-1.5 border-r border-gray-300 font-mono">{prod?.sku || 'S/D'}</td>
                                 <td className="px-2 py-1.5 border-r border-gray-300">{item.name}</td>
                                 <td className="px-2 py-1.5 border-r border-gray-300 text-right">{item.quantity}</td>
                                 <td className="px-2 py-1.5 border-r border-gray-300 text-right font-mono">
                                    ${invoiceDetails.isFacturaA ? netPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : grossPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
                    Detalle de productos no disponible para esta venta (Factura Manual o Migrada).
                  </div>
                )}

                {/* Bottom summary Block */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      {/* Interno Barcode / QR Simulation */}
                      <div className="border border-gray-300 p-1.5 rounded w-36 flex flex-col items-center bg-gray-50">
                         <BarcodeComponent 
                           value={selectedInvoiceTx.reference || 'FAC-0000'} 
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
                         <p className="text-[8px] italic text-gray-500">IVA Discriminado (21%): ${(selectedInvoiceTx.amount - (selectedInvoiceTx.amount / 1.21)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                      )}
                      <div className="pt-1.5 border-t border-black flex justify-between items-end">
                         <span className="text-[9px] font-bold uppercase">Importe Total</span>
                         <span className="text-sm font-bold font-mono">${selectedInvoiceTx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
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
                  Comprobante Interno de Cobro
                </span>
                <h3 className="text-xl font-display font-bold text-brand-smoke uppercase tracking-tight mt-2">
                  Recibo de Cobranza
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
                         <h1 className="text-base font-bold tracking-tight uppercase">{settings.distributorName}</h1>
                         <p className="text-[9px] text-gray-500">{settings.taxCondition}</p>
                         <p className="mt-2 text-[9px]">{settings.address}</p>
                         <p className="text-[9px]">Teléfono: {settings.phone}</p>
                         <p className="text-[9px]">Email: {settings.email}</p>
                      </div>
                      <div className="text-right pl-12">
                         <h2 className="text-sm font-bold uppercase">Recibo de Cobranza</h2>
                         <p className="text-xs font-mono font-bold mt-0.5">Ref: {selectedPaymentTx.reference}</p>
                         <p className="text-[9px] text-gray-500 mt-2">Fecha: {selectedPaymentTx.date.split(',')[0]}</p>
                         <p className="text-[9px] text-gray-500">CUIT: {settings.cuit}</p>
                         <p className="text-[9px] text-gray-500">Ingresos Brutos: {settings.ingresosBrutos}</p>
                         <p className="text-[9px] text-gray-500">Inicio de Actividades: {settings.initActivity}</p>
                      </div>
                   </div>
                </div>

                <div className="text-center text-[10px] font-black tracking-widest text-red-600 border border-red-600 py-1 uppercase">
                   DOCUMENTO NO VÁLIDO COMO FACTURA
                </div>

                {/* Client Section */}
                <div className="border border-black p-4 grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[8px] uppercase tracking-wider text-gray-500">Recibido de:</p>
                      <p className="text-xs font-bold">{activeClient?.name || activeClient?.fantasy_name || 'Consumidor Final'}</p>
                      <p className="text-[9px] mt-1">Dirección: {activeClient?.address || 'S/D'} - {activeClient?.city || 'S/D'}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px]"><b>CUIT:</b> {activeClient?.cuit || 'S/D'}</p>
                      <p className="text-[9px]"><b>Condición IVA:</b> {activeClient?.tax_condition || 'S/D'}</p>
                   </div>
                </div>

                {/* Receipt Details Table */}
                <table className="w-full text-left border-collapse border border-black text-black">
                   <thead>
                      <tr className="bg-gray-100 border-b border-black text-[8px] uppercase font-bold text-gray-700">
                         <th className="px-2 py-1.5 border-r border-black">Concepto</th>
                         <th className="px-2 py-1.5 border-r border-black">Medio de Pago</th>
                         <th className="px-2 py-1.5 border-r border-black">Referencia</th>
                         <th className="px-2 py-1.5 text-right">Monto Recibido</th>
                      </tr>
                   </thead>
                   <tbody>
                      <tr className="border-b border-gray-300 text-[9px] text-black">
                         <td className="px-2 py-1.5 border-r border-gray-300">Cobro de Cuenta Corriente</td>
                         <td className="px-2 py-1.5 border-r border-gray-300 font-bold">{selectedPaymentTx.payment_method || 'EFECTIVO'}</td>
                         <td className="px-2 py-1.5 border-r border-gray-300">{selectedPaymentTx.notes || 'S/D'}</td>
                         <td className="px-2 py-1.5 text-right font-mono font-bold">${selectedPaymentTx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
                         <span className="text-[9px] font-bold uppercase">Total Recibido</span>
                         <span className="text-sm font-bold font-mono text-emerald-600">${selectedPaymentTx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
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

      {/* Delete Action Modal */}
      {isDeleteModalOpen && clientToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="glass-card w-full max-w-lg p-0 relative z-10 border-rose-500/30 overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-rose-500/10 px-6 py-4 border-b border-rose-500/20 flex justify-between items-center">
              <h3 className="text-lg font-display font-bold flex items-center gap-2 uppercase text-rose-400">
                <X size={20} /> Opciones de Baja
              </h3>
              <button 
                type="button"
                onClick={() => setIsDeleteModalOpen(false)} 
                className="p-2 hover:bg-rose-500/20 rounded-full text-brand-steel hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={confirmDeleteAction} className="p-6 space-y-6">
              <div>
                <p className="text-brand-smoke font-medium mb-1 text-sm">¿Qué deseas hacer con la cuenta de <strong className="text-brand-gold">{clientToDelete.fantasy_name}</strong>?</p>
                <p className="text-xs text-brand-steel">El cliente no registra saldos pendientes (ni deudas ni a favor), por lo que puedes proceder a su baja.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <label className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all",
                  deleteAction === 'inactivate' ? "border-brand-gold bg-brand-gold/10" : "border-brand-charcoal bg-brand-black hover:border-brand-gold/50"
                )}>
                  <div className="flex gap-3">
                    <input type="radio" className="mt-1 cursor-pointer" checked={deleteAction === 'inactivate'} onChange={() => setDeleteAction('inactivate')} />
                    <div>
                      <p className="font-bold text-white mb-1 text-xs uppercase tracking-wider">Inactivar y Conservar Historial</p>
                      <p className="text-[11px] text-brand-steel leading-relaxed">El cliente no aparecerá en búsquedas ni ventas, pero su historial de compras quedará guardado para auditorías.</p>
                    </div>
                  </div>
                </label>

                <label className={cn(
                  "p-4 border rounded-xl cursor-pointer transition-all",
                  deleteAction === 'delete' ? "border-rose-500 bg-rose-500/10" : "border-brand-charcoal bg-brand-black hover:border-rose-500/50"
                )}>
                  <div className="flex gap-3">
                    <input type="radio" className="mt-1 cursor-pointer" checked={deleteAction === 'delete'} onChange={() => setDeleteAction('delete')} />
                    <div>
                      <p className="font-bold text-rose-400 mb-1 text-xs uppercase tracking-wider">Eliminar Definitivamente</p>
                      <p className="text-[11px] text-brand-steel leading-relaxed">Baja total del sistema. Se borrará el registro del cliente y todo su historial de transacciones.</p>
                    </div>
                  </div>
                </label>
              </div>

              {deleteAction === 'inactivate' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Motivo / Justificación</label>
                  <textarea 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-brand-gold h-20 resize-none transition-all" 
                    placeholder="Ej: Cliente cerró local, falta de pago reiterada, cambio de distribuidor..." 
                    value={deleteReason} 
                    onChange={e => setDeleteReason(e.target.value)} 
                    required
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 border-t border-brand-charcoal pt-4 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-brand-charcoal cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest cursor-pointer",
                    deleteAction === 'delete' ? "bg-rose-600 hover:bg-rose-500 text-white" : "btn-gold"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsManagement;
