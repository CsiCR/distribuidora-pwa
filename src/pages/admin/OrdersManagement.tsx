import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  MoreVertical,
  Truck,
  X,
  Phone
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOrdersStore } from '../../store/useOrdersStore';
import { useClientsStore } from '../../store/useClientsStore';
import { useStockStore } from '../../store/useStockStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTransactionsStore } from '../../store/useTransactionsStore';
import BarcodeComponent from 'react-barcode';
import { useReactToPrint } from 'react-to-print';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  client_id?: string;
  date: string;
  client_name: string;
  total: number;
  status: 'Pendiente' | 'Confirmado' | 'Entregado' | 'Cancelado' | 'Devuelto';
  items: OrderItem[];
  observations?: string;
}

const OrdersManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'remito' | 'factura'>('remito');

  const { orders, updateOrderStatus } = useOrdersStore();
  const { clients, updateBalance } = useClientsStore();
  const { products, updateStock, addAuditLog } = useStockStore();
  const { addTransaction, getNextInvoiceNumber } = useTransactionsStore();
  const settings = useSettingsStore();
  const [activeOrderIdMenu, setActiveOrderIdMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveOrderIdMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);
  
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: activeTab === 'remito' ? `Remito_${selectedOrder?.id || 'interno'}` : `Factura_${selectedOrder?.id?.replace('REM-', 'FAC-') || 'oficial'}`,
    bodyClass: activeTab === 'remito' ? 'print-mode-ticket' : 'print-mode-invoice',
  });

  const { taxBreakdown, activeClient, isFacturaA } = useMemo(() => {
    if (!selectedOrder) {
      return {
        taxBreakdown: { net21: 0, iva21: 0, net105: 0, iva105: 0, exempt: 0, totalNet: 0, totalIva: 0 },
        activeClient: null,
        isFacturaA: false
      };
    }
    
    const client = clients.find(c => c.fantasy_name === selectedOrder.client_name || c.id === selectedOrder.client_id);
    const isFacturaA = client?.tax_condition === 'Responsable Inscripto';

    let net21 = 0;
    let net105 = 0;
    let exempt = 0;
    let iva21 = 0;
    let iva105 = 0;

    selectedOrder.items.forEach((item: any) => {
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
      taxBreakdown: { net21, iva21, net105, iva105, exempt, totalNet, totalIva },
      activeClient: client || { name: selectedOrder.client_name, fantasy_name: selectedOrder.client_name, cuit: 'S/D', tax_condition: 'Consumidor Final', address: 'S/D', city: 'S/D', phone: 'S/D', email: 'S/D' },
      isFacturaA
    };
  }, [selectedOrder, clients, products]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(o => {
      if (!o) return false;
      const orderId = String(o.id || '');
      const clientName = String(o.client_name || '');
      const matchesSearch = orderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const handleCancelOrder = (order: any) => {
    const isPending = order.status === 'Pendiente';
    const msg = isPending
      ? `¿Seguro que desea RECHAZAR/ANULAR el pedido pendiente ${order.id}?`
      : `¿Seguro que desea ANULAR el pedido ${order.id}? Se reintegrará el stock y se anulará la deuda de $${order.total.toLocaleString()}.`;

    if (confirm(msg)) {
      updateOrderStatus(order.id, 'Cancelado');
      if (!isPending) {
        const client = clients.find(c => c.fantasy_name === order.client_name || c.id === order.client_id);
        if (client) {
          updateBalance(client.id, order.total); // Devolvemos el saldo
          // Registrar contracargo en la Cta Cte del cliente
          addTransaction({
            client_id: client.id,
            type: 'NOTA_CREDITO',
            reference: `NC-${String(order?.id || '').replace('REM-', '')}`,
            amount: order.total,
            status: 'PAGADO',
            notes: `Anulación de remito/pedido ${order.id}`
          });
        }
        order.items.forEach((item: any) => {
          updateStock(item.id, item.quantity);
          // Registrar en auditoría de stock
          addAuditLog({
            id: Math.random().toString(36).substr(2, 9),
            item_id: item.id,
            item_name: item.name,
            type: 'ingreso',
            quantity: item.quantity,
            reason: `Reintegro por anulación de pedido ${order.id}`,
            timestamp: new Date().toLocaleString(),
            user: 'Administrador'
          });
        });
      }
      alert(`Pedido ${order.id} anulado.`);
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: 'Cancelado' });
      }
    }
  };

  const handleReturnOrder = (order: any) => {
    if (confirm(`¿Registrar DEVOLUCIÓN de mercadería del pedido ${order.id}? Se reintegrará el stock y se anulará la deuda de $${order.total.toLocaleString()}.`)) {
      updateOrderStatus(order.id, 'Devuelto');
      const client = clients.find(c => c.fantasy_name === order.client_name || c.id === order.client_id);
      if (client) {
        updateBalance(client.id, order.total); // Devolvemos el saldo
        // Registrar contracargo en la Cta Cte del cliente
        addTransaction({
          client_id: client.id,
          type: 'NOTA_CREDITO',
          reference: `NC-${String(order?.id || '').replace('REM-', '')}`,
          amount: order.total,
          status: 'PAGADO',
          notes: `Devolución de mercadería vinculada al pedido ${order.id}`
        });
      }
      order.items.forEach((item: any) => {
        updateStock(item.id, item.quantity);
        // Registrar en auditoría de stock
        addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          item_id: item.id,
          item_name: item.name,
          type: 'ingreso',
          quantity: item.quantity,
          reason: `Reintegro por devolución de pedido ${order.id}`,
          timestamp: new Date().toLocaleString(),
          user: 'Administrador'
        });
      });
      alert(`Devolución registrada para el pedido ${order.id}.`);
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: 'Devuelto' });
      }
    }
  };

  const handleApproveOrder = (order: any) => {
    const client = clients.find(c => c.id === order.client_id || c.fantasy_name === order.client_name);
    if (!client) {
      alert("No se encontró el cliente asociado al pedido.");
      return;
    }

    if (confirm(`¿Seguro que desea APROBAR el pedido pendiente ${order.id}? Se descontará el stock físico, se generará la factura y se cargará la deuda de $${order.total.toLocaleString()} al saldo del cliente.`)) {
      const invoiceId = getNextInvoiceNumber();

      let net21 = 0;
      let net105 = 0;
      let exempt = 0;
      let iva21 = 0;
      let iva105 = 0;

      order.items.forEach((item: any) => {
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
      const isFacturaA = client.tax_condition === 'Responsable Inscripto';

      // Update status to Confirmado and populate calculations
      updateOrderStatus(order.id, 'Confirmado', {
        tax_condition: client.tax_condition,
        invoice_type: isFacturaA ? 'A' : 'B',
        net_amount: totalNet,
        iva_amount: totalIva
      });

      // Discount stock
      order.items.forEach((item: any) => {
        updateStock(item.id, -item.quantity);
      });

      // Add to Transactions ledger
      addTransaction({
        client_id: client.id,
        type: 'FACTURA',
        reference: invoiceId,
        amount: order.total,
        status: 'PENDIENTE',
        notes: `Venta vinculada a pedido web ${order.id}`,
        tax_condition: client.tax_condition,
        invoice_type: isFacturaA ? 'A' : 'B',
        net_amount: totalNet,
        iva_amount: totalIva
      });

      // Charge account balance
      updateBalance(client.id, -order.total);

      alert(`Pedido ${order.id} aprobado con éxito.`);
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: 'Confirmado' });
      }
    }
  };

  const handleWhatsAppOrder = (order: Order) => {
    const { clients } = useClientsStore.getState();
    const client = clients.find(c => c.fantasy_name === order.client_name || c.id === order.client_id);
    
    if (!client) {
      alert("No se encontró el teléfono del cliente");
      return;
    }

    const itemsList = order.items.map(i => `- ${i.quantity}x ${i.name}`).join('%0A');
    const message = `Hola ${client.fantasy_name}, te envío el detalle de tu remito ${order.id}.%0ATotal: $${order.total.toLocaleString()}%0A%0ADetalle:%0A${itemsList}`;
    
    const phone = client.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      {/* Filters */}
      <div className="glass-card p-4 mb-8 flex flex-col lg:flex-row gap-4 border-brand-charcoal items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por Nro de Remito o Cliente..." 
            className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-12 pr-4 py-3 text-brand-smoke focus:border-brand-gold outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <select 
            className="bg-brand-black border-2 border-brand-charcoal rounded-xl px-4 py-2.5 text-xs text-white font-bold outline-none focus:border-brand-gold"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">📊 Todos los Estados</option>
            <option value="Pendiente">⏳ Pendientes</option>
            <option value="Confirmado">Confirmados</option>
            <option value="Entregado">Entregados</option>
            <option value="Cancelado">Cancelados</option>
            <option value="Devuelto">Devueltos</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="glass-card border-brand-charcoal overflow-visible">
        {/* Mobile/Tablet view: list cards */}
        <div className="block lg:hidden bg-brand-black/20 p-3 sm:p-4">
          {filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-brand-steel">No se encontraron pedidos.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className="glass-card p-4 space-y-3 flex flex-col justify-between border-brand-charcoal/40 bg-brand-charcoal/10"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-display font-bold text-sm text-brand-smoke">{order.id}</h4>
                        <p className="text-[10px] text-brand-steel font-bold flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> {order.date}
                        </p>
                      </div>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 flex items-center gap-1",
                        order.status === 'Pendiente' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                        order.status === 'Confirmado' && "bg-brand-gold/10 text-brand-gold border border-brand-gold/20",
                        order.status === 'Entregado' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                        order.status === 'Cancelado' && "bg-rose-500/10 text-rose-400 border border-rose-500/20",
                        order.status === 'Devuelto' && "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                      )}>
                        {order.status === 'Pendiente' && <Clock size={10} />}
                        {order.status === 'Confirmado' && <CheckCircle2 size={10} />}
                        {order.status === 'Entregado' && <Truck size={10} />}
                        {order.status === 'Cancelado' && <XCircle size={10} />}
                        {order.status === 'Devuelto' && <RotateCcw size={10} />}
                        {order.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <div className="text-brand-steel flex items-center gap-1">
                        <User size={12} className="text-brand-gold" />
                        <span className="font-bold text-brand-smoke truncate max-w-[150px]">{order.client_name}</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-right text-brand-smoke">
                        ${order.total.toLocaleString()}
                      </div>
                    </div>
                    {order.observations && (
                      <div className="text-[10px] text-brand-gold bg-brand-black/30 border border-brand-charcoal/30 rounded p-1.5 italic truncate" title={order.observations}>
                        💬 {order.observations}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-brand-charcoal/20 mt-auto">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 min-w-[70px] py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} className="text-brand-gold" /> Detalle
                    </button>
                    <button 
                      onClick={() => handleWhatsAppOrder(order)}
                      className="flex-1 min-w-[70px] py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Phone size={12} /> WhatsApp
                    </button>
                    {order.status === 'Pendiente' && (
                      <button 
                        onClick={() => handleApproveOrder(order)}
                        className="flex-1 min-w-[70px] py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer animate-pulse"
                      >
                        <CheckCircle2 size={12} /> Aprobar
                      </button>
                    )}
                    {order.status === 'Confirmado' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'Entregado')}
                        className="flex-1 min-w-[70px] py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Truck size={12} /> Entregar
                      </button>
                    )}
                    {(order.status === 'Confirmado' || order.status === 'Entregado') && (
                      <button 
                        onClick={() => handleReturnOrder(order)}
                        className="flex-1 min-w-[70px] py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={12} /> Devolución
                      </button>
                    )}
                    {(order.status === 'Pendiente' || order.status === 'Confirmado' || order.status === 'Entregado') && (
                      <button 
                        onClick={() => handleCancelOrder(order)}
                        className="flex-1 min-w-[70px] py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle size={12} /> Anular
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop view: standard table */}
        <div className="hidden lg:block overflow-visible">
          <table className="w-full text-left">
            <thead className="bg-brand-charcoal/50 text-brand-steel text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl">Nro Remito / Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Monto Total</th>
                <th className="px-6 py-4 text-right rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-charcoal">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-brand-charcoal/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-charcoal rounded-lg flex items-center justify-center text-brand-gold border border-brand-charcoal group-hover:border-brand-gold/30 transition-all">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-brand-smoke">{order.id}</div>
                        <div className="text-[10px] text-brand-steel font-bold flex items-center gap-1">
                          <Clock size={10} /> {order.date}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-brand-gold" />
                      <span className="text-sm font-bold text-brand-smoke">{order.client_name}</span>
                    </div>
                    {order.observations && (
                      <div className="text-[10px] text-brand-gold italic mt-1 max-w-[220px] truncate" title={order.observations}>
                        💬 {order.observations}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit",
                      order.status === 'Pendiente' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                      order.status === 'Confirmado' && "bg-brand-gold/10 text-brand-gold border border-brand-gold/20",
                      order.status === 'Entregado' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                      order.status === 'Cancelado' && "bg-rose-500/10 text-rose-400 border border-rose-500/20",
                      order.status === 'Devuelto' && "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                    )}>
                      {order.status === 'Pendiente' && <Clock size={12} />}
                      {order.status === 'Confirmado' && <CheckCircle2 size={12} />}
                      {order.status === 'Entregado' && <Truck size={12} />}
                      {order.status === 'Cancelado' && <XCircle size={12} />}
                      {order.status === 'Devuelto' && <RotateCcw size={12} />}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-brand-smoke">
                      ${order.total.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative group/actions inline-block">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveOrderIdMenu(activeOrderIdMenu === order.id ? null : order.id);
                        }}
                        className="p-2 hover:bg-brand-charcoal rounded-lg text-brand-steel transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>
                      <div className={cn(
                        "absolute right-0 bottom-full mb-1 w-48 bg-brand-graphite border border-brand-charcoal rounded-xl shadow-2xl transition-all z-[100] overflow-hidden text-left",
                        activeOrderIdMenu === order.id 
                          ? "opacity-100 visible pointer-events-auto" 
                          : "opacity-0 invisible pointer-events-none md:group-hover/actions:opacity-100 md:group-hover/actions:visible md:group-hover/actions:pointer-events-auto"
                      )}>
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="w-full px-4 py-3 text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3"
                        >
                          <FileText size={14} /> Ver Detalle
                        </button>
                        <button 
                          onClick={() => handleWhatsAppOrder(order)}
                          className="w-full px-4 py-3 text-xs font-bold text-brand-smoke hover:bg-brand-charcoal flex items-center gap-3 border-t border-brand-charcoal/50"
                        >
                          <Phone size={14} className="text-emerald-500" /> WhatsApp
                        </button>
                        {order.status === 'Pendiente' && (
                          <button onClick={() => handleApproveOrder(order)} className="w-full px-4 py-3 text-xs font-bold text-amber-500 hover:bg-amber-500/10 flex items-center gap-3">
                            <CheckCircle2 size={14} /> Aprobar Pedido
                          </button>
                        )}
                        {order.status === 'Confirmado' && (
                          <button onClick={() => updateOrderStatus(order.id, 'Entregado')} className="w-full px-4 py-3 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-3">
                            <Truck size={14} /> Marcar Entregado
                          </button>
                        )}
                        {(order.status === 'Confirmado' || order.status === 'Entregado') && (
                          <button onClick={() => handleReturnOrder(order)} className="w-full px-4 py-3 text-xs font-bold text-orange-500 hover:bg-orange-500/10 flex items-center gap-3">
                            <RotateCcw size={14} /> Registrar Devolución
                          </button>
                        )}
                        {(order.status === 'Pendiente' || order.status === 'Confirmado' || order.status === 'Entregado') && (
                          <button onClick={() => handleCancelOrder(order)} className="w-full px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 border-t border-brand-charcoal flex items-center gap-3">
                            <XCircle size={14} /> Anular Pedido
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Side Drawer */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full md:w-[450px] bg-brand-black border-l border-brand-charcoal z-[200] shadow-2xl transition-transform duration-500 ease-out flex flex-col overflow-hidden",
        selectedOrder ? "translate-x-0" : "translate-x-full"
      )}>
        {selectedOrder && (
          <>
            <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center relative z-10">
              <div>
                <h3 className="text-xl font-display font-bold flex items-center gap-2 uppercase tracking-widest text-brand-gold">
                  <FileText size={20} /> Detalle del Remito
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel"><X size={24} /></button>
            </div>

            <div className="px-6 py-3 border-b border-brand-charcoal bg-brand-black flex gap-2 z-10 relative">
              <button 
                onClick={() => setActiveTab('remito')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                  activeTab === 'remito'
                    ? "bg-brand-charcoal text-brand-smoke border-brand-gold"
                    : "bg-transparent text-brand-steel border-transparent hover:text-brand-smoke"
                )}
              >
                📋 Remito Interno
              </button>
              <button 
                onClick={() => setActiveTab('factura')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                  activeTab === 'factura'
                    ? "bg-brand-charcoal text-brand-smoke border-brand-gold"
                    : "bg-transparent text-brand-steel border-transparent hover:text-brand-smoke"
                )}
              >
                🧾 Factura Oficial {isFacturaA ? 'A' : 'B'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-brand-black relative">
              {/* Contenedor del Ticket Imprimible */}
              <div ref={printRef}>
                {activeTab === 'remito' ? (
                  <div className="bg-brand-graphite rounded-xl shadow-2xl shadow-brand-black border border-brand-charcoal/50 overflow-hidden mx-auto max-w-2xl w-full">
                    {/* Ticket Header */}
                    <div className="bg-brand-charcoal/80 p-6 border-b border-brand-charcoal text-center">
                      <div className="w-12 h-12 bg-brand-charcoal rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <FileText size={24} className="text-brand-smoke" />
                      </div>
                      <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Comprobante Interno</h2>
                      <div className="flex justify-center gap-4 mt-1">
                        <p className="text-brand-gold text-[9px] font-black uppercase tracking-[0.2em]">{selectedOrder.status}</p>
                      </div>
                    </div>

                    {/* Ticket Content */}
                    <div className="p-6 space-y-6">
                      <div className="flex justify-between items-start border-b border-brand-charcoal/50 pb-4">
                        <div>
                          <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mb-1">Cliente</p>
                          <p className="text-sm font-bold text-brand-smoke">{selectedOrder.client_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mb-1">Fecha</p>
                          <p className="text-sm font-bold text-brand-smoke">{selectedOrder.date}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest">Resumen de Artículos</p>
                        <div id="printable-items" className="space-y-2">
                          {selectedOrder?.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-xs font-medium border-b border-brand-charcoal/30 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                              <div className="flex flex-col">
                                <span className="text-brand-smoke font-bold">{item.quantity}x {item.name || 'Producto'}</span>
                              </div>
                              <span className="text-brand-smoke font-bold">${((item.quantity || 0) * (item.price || 0)).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-brand-charcoal/50 flex justify-between items-end">
                           <span className="text-[10px] text-brand-gold font-black uppercase tracking-widest">Monto Total</span>
                           <span className="text-2xl font-display font-black text-brand-smoke">${selectedOrder.total.toLocaleString()}</span>
                        </div>
                      </div>

                      {selectedOrder.observations && (
                        <div className="pt-4 border-t border-brand-charcoal/30">
                          <p className="text-[9px] text-brand-gold font-black uppercase tracking-widest mb-1">Observaciones del Cliente</p>
                          <p className="text-xs text-brand-smoke bg-brand-black/40 border border-brand-charcoal/30 rounded-lg p-3 italic">
                            "{selectedOrder.observations}"
                          </p>
                        </div>
                      )}

                      {/* Barcode */}
                      <div className="pt-4 flex flex-col items-center">
                        <div className="w-full bg-white rounded overflow-hidden flex justify-center py-2 mb-2 shadow-inner">
                           <BarcodeComponent 
                             value={selectedOrder.id || 'REM-0000'} 
                             format="CODE128" 
                             width={2} 
                             height={50} 
                             displayValue={false} 
                             background="transparent"
                             lineColor="#000000"
                           />
                        </div>
                        <p className="text-[10px] font-mono font-bold text-brand-steel tracking-[0.3em]">{selectedOrder.id || 'REM-0000'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white text-black p-8 border border-gray-300 rounded-xl space-y-6 text-xs font-sans">
                    {/* Interno Header Style */}
                    <div className="border-2 border-black p-4 relative">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-black w-14 h-14 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black leading-none">{isFacturaA ? 'A' : 'B'}</span>
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
                             <p className="text-xs font-mono font-bold mt-0.5">Nro: {selectedOrder.id.replace('REM-', 'FAC-')}</p>
                             <p className="text-[9px] text-gray-500 mt-2">Fecha: {selectedOrder.date.split(',')[0]}</p>
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
                          <p className="text-xs font-bold">{activeClient?.name || activeClient?.fantasy_name}</p>
                          <p className="text-[9px] mt-1">Dirección: {activeClient?.address || 'S/D'} - {activeClient?.city || 'S/D'}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px]"><b>CUIT:</b> {activeClient?.cuit || 'S/D'}</p>
                          <p className="text-[9px]"><b>Condición IVA:</b> {activeClient?.tax_condition || 'S/D'}</p>
                          <p className="text-[9px]"><b>Forma de Pago:</b> Cuenta Corriente</p>
                       </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-left border-collapse border border-black text-black">
                       <thead>
                          <tr className="bg-gray-100 border-b border-black text-[8px] uppercase font-bold text-gray-700">
                             <th className="px-2 py-1.5 border-r border-black">Código/SKU</th>
                             <th className="px-2 py-1.5 border-r border-black">Detalle</th>
                             <th className="px-2 py-1.5 border-r border-black text-right">Cant</th>
                             <th className="px-2 py-1.5 border-r border-black text-right">{isFacturaA ? 'Neto Unit' : 'Precio Unit'}</th>
                             <th className="px-2 py-1.5 border-r border-black text-center">Alic IVA</th>
                             <th className="px-2 py-1.5 text-right">Subtotal</th>
                          </tr>
                       </thead>
                       <tbody>
                          {selectedOrder.items.map((item: any) => {
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
                                      ${isFacturaA ? netPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : grossPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                   </td>
                                   <td className="px-2 py-1.5 border-r border-gray-300 text-center font-mono">{ivaRate}%</td>
                                   <td className="px-2 py-1.5 text-right font-mono">${rowSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                </tr>
                             );
                          })}
                       </tbody>
                    </table>

                    {/* Bottom summary Block */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black">
                       <div className="flex flex-col gap-3">
                          {/* Interno Barcode / QR Simulation */}
                          <div className="border border-gray-300 p-1.5 rounded w-36 flex flex-col items-center bg-gray-50">
                             <BarcodeComponent 
                               value={selectedOrder.id.replace('REM-', 'FAC-') || 'FAC-0000'} 
                               format="CODE128" 
                               width={1.0} 
                               height={24} 
                               displayValue={false} 
                               background="transparent"
                               lineColor="#000000"
                             />
                             <span className="text-[6px] font-mono text-gray-500 uppercase mt-0.5">Comprobante Autorizado Interno</span>
                          </div>
                          {selectedOrder.observations && (
                             <div className="text-[9px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 italic leading-tight">
                                <b>Observaciones:</b> "{selectedOrder.observations}"
                             </div>
                          )}
                       </div>

                       <div className="text-right space-y-1 text-[9px] pl-12">
                          {isFacturaA ? (
                             <div className="space-y-0.5">
                                {taxBreakdown.net21 > 0 && <p>Neto Gravado 21%: <span className="font-mono font-bold">${taxBreakdown.net21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                                {taxBreakdown.iva21 > 0 && <p>IVA 21%: <span className="font-mono font-bold">${taxBreakdown.iva21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                                {taxBreakdown.net105 > 0 && <p>Neto Gravado 10.5%: <span className="font-mono font-bold">${taxBreakdown.net105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                                {taxBreakdown.iva105 > 0 && <p>IVA 10.5%: <span className="font-mono font-bold">${taxBreakdown.iva105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                                {taxBreakdown.exempt > 0 && <p>Neto Exento: <span className="font-mono font-bold">${taxBreakdown.exempt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                             </div>
                          ) : (
                             <p className="text-[8px] italic text-gray-500">IVA Discriminado: ${taxBreakdown.totalIva.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                          )}
                          <div className="pt-1.5 border-t border-black flex justify-between items-end">
                             <span className="text-[9px] font-bold uppercase">Importe Total</span>
                             <span className="text-sm font-bold font-mono">${selectedOrder.total.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-brand-charcoal bg-brand-charcoal/20 grid grid-cols-2 gap-3 relative z-10">
              <button 
                onClick={() => handlePrint()}
                className="bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                 <FileText size={18} /> {activeTab === 'remito' ? 'Imprimir Remito' : 'Imprimir Factura'}
              </button>
              <button 
                onClick={() => {
                  const itemsList = (selectedOrder?.items || []).map((i: any) => `- ${i?.quantity || 0}x ${i?.name || 'Producto'}`).join('%0A');
                  const isFAC = activeTab === 'factura';
                  const title = isFAC ? `FACTURA DIGITAL ${isFacturaA ? 'A' : 'B'}: ${String(selectedOrder?.id || '').replace('REM-', 'FAC-')}` : `REMITO DIGITAL: ${String(selectedOrder?.id || '')}`;
                  const totals = isFAC 
                    ? `%0A💰 *TOTAL NETO:* $${taxBreakdown.totalNet.toLocaleString()}%0A💸 *TOTAL IVA:* $${taxBreakdown.totalIva.toLocaleString()}%0A💎 *TOTAL COMPROBANTE:* $${(selectedOrder?.total || 0).toLocaleString()}`
                    : `%0A💰 *MONTO TOTAL:* $${(selectedOrder?.total || 0).toLocaleString()}`;
                  
                  const message = `📦 *${title}*%0A👤 *Cliente:* ${selectedOrder?.client_name || 'Consumidor Final'}%0A📅 *Fecha:* ${selectedOrder?.date || ''}%0A%0A--------------------------%0A${itemsList}%0A--------------------------${totals}%0A%0A_Adjunto comprobante PDF oficial generado. Gracias por su confianza comercial._`;
                  const phone = String(activeClient?.phone || '').replace(/\D/g, '') || '';
                  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                 <Phone size={18} /> WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
      {selectedOrder && <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[190]" onClick={() => setSelectedOrder(null)} />}
    </div>
  );
};

export default OrdersManagement;
