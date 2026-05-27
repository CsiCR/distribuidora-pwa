import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowLeft, Send, MessageSquare, User } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useClientsStore } from '../store/useClientsStore';
import type { Client } from '../store/useClientsStore';
import { useOrdersStore } from '../store/useOrdersStore';
import { openWhatsApp } from '../lib/whatsapp';
import { useSettingsStore } from '../store/useSettingsStore';
import { cn } from '../lib/utils';
import { ProductImage } from '../components/ProductImage';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const { clients } = useClientsStore();
  const { addOrder, getNextOrderNumber } = useOrdersStore();

  // State for success modal
  const [isSuccess, setIsSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');

  // Resolve client from URL or session
  const clientId = searchParams.get('c') || sessionStorage.getItem('clientId');
  const client = useMemo(() => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId || c.fantasy_name === clientId);
  }, [clientId, clients]);

  const [clientData, setClientData] = useState({
    name: '',
    cuit: '',
    zone: '',
    observations: ''
  });

  // Populate form fields if client is identified
  useEffect(() => {
    if (client) {
      setClientData({
        name: client.fantasy_name || client.name,
        cuit: client.cuit || '',
        zone: client.zone || '',
        observations: ''
      });
    }
  }, [client]);

  const handleConfirmOrder = () => {
    if (!clientData.name || items.length === 0) return;

    const orderId = getNextOrderNumber('CLI');
    setPlacedOrderId(orderId);
    
    const clientList = client?.price_list || 'Minorista';
    const looseUnitSurcharge = useSettingsStore.getState().looseUnitSurcharge ?? 15;
    const finalTotal = getTotal(clientList, looseUnitSurcharge);

    const calculatedItems = items.map(item => {
      const upb = item.units_per_box;
      const isPackMode = item.only_pack_sale || item.isPack || item.quantity >= upb;
      const surchargePercent = item.loose_surcharge ?? looseUnitSurcharge;
      
      let packPriceList = clientList;
      if (clientList === 'Minorista') {
        packPriceList = 'Mayorista';
      } else if (clientList === 'Mayorista') {
        packPriceList = 'Distribuidor';
      } else {
        packPriceList = 'Distribuidor';
      }
      
      const resolvedPackPrice = item.prices?.[packPriceList as keyof typeof item.prices] || item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
      const normalPackPrice = item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
      
      const packPriceVal = Math.round((resolvedPackPrice / upb) * 100) / 100;
      const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
      
      const fullPacks = Math.floor(item.quantity / upb);
      const looseUnits = item.quantity % upb;
      
      let itemSubtotal = 0;
      if (upb <= 1) {
        const price = item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
        itemSubtotal = price * item.quantity;
      } else if (isPackMode) {
        itemSubtotal = (fullPacks * upb * packPriceVal) + (looseUnits * loosePriceVal);
      } else {
        itemSubtotal = item.quantity * loosePriceVal;
      }
      
      const unitRealPrice = itemSubtotal / item.quantity;
      
      let suffix = '';
      if (upb > 1) {
        if (item.only_pack_sale) {
          suffix = ` (${fullPacks} Pack${fullPacks > 1 ? 's' : ''})`;
        } else if (isPackMode) {
          if (fullPacks > 0) {
            suffix = ` (${fullPacks} Pack${fullPacks > 1 ? 's' : ''}${looseUnits > 0 ? ` + ${looseUnits} Un.` : ''})`;
          }
        }
      }
      
      return {
        id: item.id,
        name: `${item.short_description || item.name}${suffix}`,
        quantity: item.quantity,
        presentation: item.presentation || 'Unidad',
        price: Math.round(unitRealPrice * 100) / 100,
        subtotal: Math.round(itemSubtotal * 100) / 100
      };
    });

    // 1. Save order to store in 'Pendiente' status
    let orderClientId = client?.id;

    if (!client) {
      // Buscar si ya existe un cliente con exactamente la misma razón social o nombre de fantasía
      const existingClient = clients.find(c => 
        c.name.toLowerCase() === clientData.name.trim().toLowerCase() ||
        c.fantasy_name.toLowerCase() === clientData.name.trim().toLowerCase()
      );

      if (existingClient) {
        orderClientId = existingClient.id;
      } else {
        const newClientId = 'temp_' + Date.now();
        const newClient: Client = {
          id: newClientId,
          name: clientData.name.trim(),
          fantasy_name: clientData.name.trim(),
          cuit: clientData.cuit || '',
          email: '',
          phone: '',
          address: '',
          city: '',
          zone: clientData.zone || 'Centro',
          price_list: 'Minorista',
          visit_days: [],
          status: 'Pendiente',
          balance: 0,
          tax_condition: 'Consumidor Final'
        };

        // Agregar al store
        useClientsStore.getState().setClients(prev => [...prev, newClient]);
        orderClientId = newClientId;
      }
    }

    addOrder({
      id: orderId,
      client_id: orderClientId,
      date: new Date().toLocaleString(),
      client_name: clientData.name,
      total: finalTotal,
      status: 'Pendiente',
      observations: clientData.observations.trim(),
      items: calculatedItems.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        price: i.price
      }))
    });

    // 2. Open WhatsApp in background
    openWhatsApp({
      clientName: clientData.name,
      cuit: clientData.cuit || 'No especificado',
      zone: clientData.zone || 'No especificada',
      items: calculatedItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        presentation: i.presentation,
        price: i.subtotal
      })),
      total: finalTotal,
      observations: `[Pedido Web #${orderId}] ${clientData.observations}`.trim()
    });

    // 3. Clear cart and show success view
    clearCart();
    setIsSuccess(true);
  };

  const backToCatalogUrl = client ? `/catalogo?c=${clientId}` : '/catalogo';

  if (items.length === 0 && !isSuccess) {
    return (
      <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 bg-brand-charcoal rounded-full flex items-center justify-center mb-6 text-brand-steel">
          <ShoppingCart size={40} />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">Tu carrito está vacío</h2>
        <p className="text-brand-steel mb-8">Agrega productos del catálogo para comenzar tu pedido.</p>
        <button 
          onClick={() => navigate(backToCatalogUrl)}
          className="btn-primary"
        >
          Volver al catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black pb-10">
      {/* Header */}
      <header className="bg-brand-black/90 backdrop-blur-md border-b border-brand-charcoal px-4 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 text-brand-steel hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-display font-bold">Revisar Pedido</h1>
        </div>
      </header>

      {/* Client Welcome Banner */}
      {client && (
        <div className="bg-gradient-to-b from-brand-graphite to-brand-black border-b border-brand-charcoal px-4 py-4">
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            {/* Cabecera del Banner */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-sm text-brand-smoke font-bold">
                    ¡Hola, <span className="text-brand-gold">{client.fantasy_name || client.name}</span>!
                  </p>
                  <p className="text-[11px] text-brand-steel">
                    Lista de precios: <span className="font-bold text-brand-gold">{client.price_list}</span> • CUIT: <span className="font-mono">{client.cuit || 'S/D'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Fila de Estado y Saldo de Cuenta Corriente */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Badge de Estado */}
              {client.status === 'Inactivo' && (
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  ⚠️ Cuenta Suspendida
                </span>
              )}
              {client.status === 'Pendiente' && (
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  ⏳ Pendiente de Alta
                </span>
              )}
              {client.status === 'Activo' && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  ✓ Cuenta Activa
                </span>
              )}

              {/* Badge de Saldo */}
              {client.balance < 0 ? (
                <span className="bg-rose-500/15 text-rose-400 border border-rose-500/25 px-3 py-1 rounded-xl text-[10px] font-bold font-mono">
                  Saldo Deudor: -${Math.abs(client.balance).toLocaleString('es-AR')}
                </span>
              ) : client.balance > 0 ? (
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-3 py-1 rounded-xl text-[10px] font-bold font-mono">
                  Saldo a Favor: ${client.balance.toLocaleString('es-AR')}
                </span>
              ) : (
                <span className="bg-brand-charcoal text-brand-steel border border-brand-charcoal px-3 py-1 rounded-xl text-[10px] font-bold font-mono">
                  Cuenta al Día
                </span>
              )}

              {/* Mensajes Informativos dinámicos */}
              {client.status === 'Inactivo' && (
                <span className="text-[10px] text-rose-400/90 font-bold ml-1">
                  La carga de pedidos está inhabilitada. Contacte con Administración.
                </span>
              )}
              {client.status === 'Pendiente' && (
                <span className="text-[10px] text-brand-steel/80 italic ml-1">
                  Tu pedido se guardará y será validado cuando la distribuidora apruebe tu cuenta.
                </span>
              )}
              {client.balance < 0 && (
                <span className="text-[10px] text-brand-steel/80 italic ml-1">
                  Recordá regularizar tu saldo de cuenta corriente en tu próxima entrega.
                </span>
              )}
              {client.balance > 0 && (
                <span className="text-[10px] text-emerald-400/90 font-bold ml-1">
                  ¡Tenés saldo a favor para tus compras!
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Items List */}
        <div className="md:col-span-2 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-brand-charcoal bg-brand-charcoal/30">
              <h3 className="font-bold flex items-center gap-2 text-brand-smoke">
                <ShoppingCart size={18} className="text-brand-gold" />
                Productos Seleccionados ({items.length})
              </h3>
            </div>
            <div className="divide-y divide-brand-charcoal">
              {items.map((item) => {
                const upb = item.units_per_box;
                const isPackMode = item.only_pack_sale || item.isPack || item.quantity >= upb;
                const clientList = client?.price_list || 'Minorista';
                const looseUnitSurcharge = useSettingsStore.getState().looseUnitSurcharge ?? 15;
                const surchargePercent = item.loose_surcharge ?? looseUnitSurcharge;
                
                let packPriceList = clientList;
                if (clientList === 'Minorista') {
                  packPriceList = 'Mayorista';
                } else if (clientList === 'Mayorista') {
                  packPriceList = 'Distribuidor';
                } else {
                  packPriceList = 'Distribuidor';
                }
                
                const resolvedPackPrice = item.prices?.[packPriceList as keyof typeof item.prices] || item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
                const normalPackPrice = item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
                
                const packPriceVal = Math.round((resolvedPackPrice / upb) * 100) / 100;
                const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
                
                const fullPacks = Math.floor(item.quantity / upb);
                const looseUnits = item.quantity % upb;
                
                let itemSubtotal = 0;
                if (upb <= 1) {
                  const price = item.prices?.[clientList as keyof typeof item.prices] || item.prices?.Minorista || 0;
                  itemSubtotal = price * item.quantity;
                } else if (isPackMode) {
                  itemSubtotal = (fullPacks * upb * packPriceVal) + (looseUnits * loosePriceVal);
                } else {
                  itemSubtotal = item.quantity * loosePriceVal;
                }

                const delta = (item.only_pack_sale && upb > 1) ? upb : 1;
                const showOptimizationAlert = upb > 1 && isPackMode;

                return (
                  <div key={item.id} className="p-4 flex flex-col gap-2.5">
                    <div className="flex gap-4">
                      <ProductImage 
                        imageUrl={item.image_url} 
                        category={item.category} 
                        className="w-16 h-16 rounded-lg flex-shrink-0" 
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-sm sm:text-base text-brand-smoke leading-tight">{item.name}</h4>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-brand-steel hover:text-brand-wine p-1 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-brand-steel mb-2">{item.presentation}</p>
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            {/* Control de Unidades/Packs Principal */}
                            <div className="flex items-center bg-brand-black border border-brand-charcoal rounded-lg">
                              <button 
                                onClick={() => updateQuantity(item.id, Math.max(delta, item.quantity - delta))}
                                className="px-3 py-1 text-brand-gold font-bold hover:bg-brand-charcoal transition-colors rounded-l-lg"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 text-sm font-bold min-w-[40px] text-center border-x border-brand-charcoal text-brand-smoke">
                                {item.only_pack_sale && upb > 1 ? `${item.quantity / upb} Pack/s` : `${item.quantity} u.`}
                              </span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + delta)}
                                className="px-3 py-1 text-brand-gold font-bold hover:bg-brand-charcoal transition-colors rounded-r-lg"
                              >
                                +
                              </button>
                            </div>

                            {/* Control Secundario para Sumar/Restar Packs Completos */}
                            {upb > 1 && !item.only_pack_sale && (
                              <div className="flex items-center bg-brand-black/40 border border-brand-charcoal/50 rounded-lg">
                                <button 
                                  onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - upb))}
                                  disabled={item.quantity < upb}
                                  className="px-2.5 py-1 text-[10px] text-brand-steel hover:text-brand-wine font-bold hover:bg-brand-charcoal/30 transition-colors rounded-l-lg disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  - Pack
                                </button>
                                <span className="px-2 py-1 text-[10px] font-medium min-w-[50px] text-center border-x border-brand-charcoal/30 text-brand-steel">
                                  {Math.floor(item.quantity / upb)} Pack{Math.floor(item.quantity / upb) !== 1 ? 's' : ''}
                                </span>
                                <button 
                                  onClick={() => updateQuantity(item.id, item.quantity + upb)}
                                  className="px-2.5 py-1 text-[10px] text-brand-gold font-bold hover:bg-brand-charcoal/30 transition-colors rounded-r-lg"
                                >
                                  + Pack
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-brand-gold font-display font-bold">
                            ${itemSubtotal.toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                    </div>
                    {showOptimizationAlert && (
                      <div className="px-3 py-2 bg-brand-gold/10 rounded-lg border border-brand-gold/20 text-xs text-brand-gold font-bold flex flex-col gap-0.5 ml-20">
                        <div className="flex justify-between items-center">
                          <span>⚡ ¡Tarifa optimizada!</span>
                          {item.only_pack_sale && (
                            <span className="text-[8px] bg-brand-gold text-brand-black px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                              Sólo Pack Cerrado
                            </span>
                          )}
                        </div>
                        <div className="text-brand-steel font-normal text-[10px]">
                          Llevás {fullPacks} {fullPacks === 1 ? 'Pack completo' : 'Packs completos'} {looseUnits > 0 ? `y ${looseUnits} ${looseUnits === 1 ? 'unidad suelta' : 'unidades sueltas'}` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-brand-charcoal/20 flex justify-between items-center">
               <button 
                 onClick={() => { if(confirm('¿Vaciar carrito?')) clearCart() }}
                 className="text-xs text-brand-steel hover:text-brand-wine transition-colors"
               >
                 Vaciar Carrito
               </button>
               <div className="text-right">
                 <span className="text-xs text-brand-steel uppercase tracking-widest font-bold">Total Parcial</span>
                 <div className="text-2xl font-display font-black text-brand-gold">
                   ${getTotal(client?.price_list || 'Minorista', useSettingsStore.getState().looseUnitSurcharge ?? 15).toLocaleString('es-AR')}
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Order Details Form */}
        <div className="space-y-6">
          <div className="glass-card p-6 border-brand-gold/20">
            <h3 className="font-display font-bold mb-4 text-brand-gold flex items-center gap-2">
              <Send size={18} /> Datos del Envío
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-steel uppercase mb-1">Nombre / Razón Social</label>
                <input 
                  type="text" 
                  value={clientData.name}
                  onChange={(e) => setClientData({...clientData, name: e.target.value})}
                  readOnly={!!client}
                  placeholder="Ej: Kiosco El Sol" 
                  className={cn(
                    "w-full input-field text-sm",
                    client && "bg-brand-charcoal/20 border-brand-charcoal text-brand-steel cursor-not-allowed"
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-steel uppercase mb-1">CUIT (Opcional)</label>
                <input 
                  type="text" 
                  value={clientData.cuit}
                  onChange={(e) => setClientData({...clientData, cuit: e.target.value})}
                  readOnly={!!client}
                  placeholder="20-12345678-9" 
                  className={cn(
                    "w-full input-field text-sm",
                    client && "bg-brand-charcoal/20 border-brand-charcoal text-brand-steel cursor-not-allowed"
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-steel uppercase mb-1">Zona de Reparto</label>
                {client ? (
                  <input 
                    type="text" 
                    value={clientData.zone} 
                    readOnly 
                    className="w-full input-field text-sm bg-brand-charcoal/20 border-brand-charcoal text-brand-steel cursor-not-allowed"
                  />
                ) : (
                  <select 
                    value={clientData.zone}
                    onChange={(e) => setClientData({...clientData, zone: e.target.value})}
                    className="w-full input-field text-sm appearance-none"
                  >
                    <option value="">Seleccionar zona...</option>
                    <option value="Centro">Centro</option>
                    <option value="Zona Norte">Zona Norte</option>
                    <option value="Zona Sur">Zona Sur</option>
                    <option value="Periferia">Periferia</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-steel uppercase mb-1">Observaciones</label>
                <textarea 
                  value={clientData.observations}
                  onChange={(e) => setClientData({...clientData, observations: e.target.value})}
                  placeholder="Ej: Tocar timbre portón negro..." 
                  className="w-full input-field text-sm h-20 resize-none"
                />
              </div>

              <button 
                onClick={handleConfirmOrder}
                disabled={!clientData.name || client?.status === 'Inactivo'}
                className="w-full btn-gold py-4 flex items-center justify-center gap-3 text-lg mt-4 disabled:opacity-30 cursor-pointer"
              >
                <MessageSquare size={24} />
                Confirmar y Enviar Pedido
              </button>
              
              {client?.status === 'Inactivo' ? (
                <p className="text-xs text-rose-400 font-bold text-center leading-tight mt-2">
                  ⚠️ Tu cuenta se encuentra suspendida o inactiva. El envío de pedidos está temporalmente deshabilitado.
                </p>
              ) : (
                <p className="text-[10px] text-center text-brand-steel leading-tight">
                  Al confirmar, se guardará el pedido pendiente de aprobación y se abrirá WhatsApp con el detalle para notificar al vendedor.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {isSuccess && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 text-center border-brand-gold/30 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 bg-brand-wine/30 border border-brand-gold/50 rounded-full flex items-center justify-center text-brand-gold mb-4 animate-bounce">
              <ShoppingCart size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">¡Pedido Enviado!</h2>
            <p className="text-brand-gold font-mono font-bold text-sm mb-4">Nro de Orden: {placedOrderId}</p>
            <p className="text-sm text-brand-smoke mb-6 leading-relaxed">
              Tu pedido ha sido recibido y registrado en estado <span className="text-brand-gold font-bold">Pendiente</span>.
              Se ha abierto WhatsApp para notificar a nuestro equipo de ventas.
            </p>
            <button
              onClick={() => {
                navigate(backToCatalogUrl);
              }}
              className="w-full btn-gold py-3 text-sm font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
            >
              Volver al Catálogo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
