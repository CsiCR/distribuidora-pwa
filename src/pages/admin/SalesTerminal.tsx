import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Package,
  X,
  ArrowRight,
  Phone,
  Pause,
  Play,
  List,
  LayoutGrid,
  Printer
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProductImage } from '../../components/ProductImage';
import { useOrdersStore } from '../../store/useOrdersStore';
import { useClientsStore } from '../../store/useClientsStore';
import { useStockStore, WAREHOUSES } from '../../store/useStockStore';
import type { Product } from '../../store/useStockStore';
import { useParkedOrdersStore } from '../../store/useParkedOrdersStore';
import { useTransactionsStore } from '../../store/useTransactionsStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useReactToPrint } from 'react-to-print';
import BarcodeComponent from 'react-barcode';
import { useSettingsStore } from '../../store/useSettingsStore';

// Types (reusing from Stock and Clients)

const SalesTerminal: React.FC = () => {
  const settings = useSettingsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { cart, setCart, selectedClientId, setSelectedClientId, clearTerminal } = useTerminalStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  
  const { addOrder, getNextOrderNumber } = useOrdersStore();
  const { clients, updateBalance } = useClientsStore();
  const { products, reserveStock, releaseStock, updateStock } = useStockStore();
  const { parkedOrders, parkOrder, resumeOrder, removeParkedOrder } = useParkedOrdersStore();
  const { addTransaction, getNextInvoiceNumber } = useTransactionsStore();

  const [isParkedDrawerOpen, setIsParkedDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const invoicePrintRef = useRef<HTMLDivElement>(null);
  
  const handlePrintInvoice = useReactToPrint({
    contentRef: invoicePrintRef,
    documentTitle: `Comprobante_${currentInvoiceNumber || 'Venta'}`,
  });

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.status === 'activo' && 
      (warehouseFilter === 'all' || p.warehouse === warehouseFilter) &&
      (
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
  }, [searchTerm, products, warehouseFilter]);

  const getActivePrice = (product: Product, isPack: boolean = false, qty: number = 1) => {
    const client = clients.find(c => c.id === selectedClientId);
    const clientList = client?.price_list || 'Minorista';
    
    // Si units_per_box es <= 1, el pack no tiene sentido, retornamos el precio normal
    if (product.units_per_box <= 1) {
      return product.prices[clientList] || product.prices.Minorista;
    }
    
    // Obtener la lista para packs (Opción B: salto automático al nivel superior)
    let packPriceList = clientList;
    if (clientList === 'Minorista') {
      packPriceList = 'Mayorista';
    } else if (clientList === 'Mayorista') {
      packPriceList = 'Distribuidor';
    } else {
      packPriceList = 'Distribuidor';
    }
    
    // Obtener precios base
    const resolvedPackPrice = product.prices[packPriceList] || product.prices[clientList] || product.prices.Minorista;
    const normalPackPrice = product.prices[clientList] || product.prices.Minorista;
    const upb = product.units_per_box;
    const surchargePercent = product.loose_surcharge ?? settings.looseUnitSurcharge ?? 15;
    
    const qtyVal = qty <= 0 ? 1 : qty;
    
    // Calculamos cuántas unidades entran en packs completos y cuántas sueltas.
    const fullPacks = Math.floor(qtyVal / upb);
    const looseUnits = qtyVal % upb;
    
    const packPriceVal = Math.round((resolvedPackPrice / upb) * 100) / 100;
    const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
    
    // Si el usuario seleccionó modo Pack o si la cantidad en modo Unidad alcanza para formar al menos un pack,
    // se optimiza la tarifa aplicando el precio de pack cerrado a las cajas completas.
    if (isPack || qtyVal >= upb) {
      const totalPrice = (fullPacks * upb * packPriceVal) + (looseUnits * loosePriceVal);
      return totalPrice / qtyVal;
    } else {
      // De lo contrario, se cobra la tarifa normal de unidad suelta con el recargo.
      return loosePriceVal;
    }
  };

  const getPackPrice = (product: Product) => {
    const client = clients.find(c => c.id === selectedClientId);
    const clientList = client?.price_list || 'Minorista';
    
    let packPriceList = clientList;
    if (clientList === 'Minorista') {
      packPriceList = 'Mayorista';
    } else if (clientList === 'Mayorista') {
      packPriceList = 'Distribuidor';
    } else {
      packPriceList = 'Distribuidor';
    }
    
    return product.prices[packPriceList] || product.prices[clientList] || product.prices.Minorista;
  };

  // Sync cart prices when client or products change
  useEffect(() => {
    if (cart.length === 0) return;
    setCart(prev => prev.map(item => {
      // Find the latest product data from store
      const latestProduct = products.find(p => p.id === item.product.id) || item.product;
      return {
        ...item,
        product: latestProduct,
        price: getActivePrice(latestProduct, item.isPack, item.quantity)
      };
    }));
  }, [selectedClientId, products]);

  const addToCart = (product: Product, isPack: boolean = false) => {
    const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
    const available = product.stock_actual - product.stock_reservado;
    const forcePack = isPack || (!!product.only_pack_sale && product.units_per_box > 1);
    const increment = forcePack && product.units_per_box > 1 ? product.units_per_box : 1;
    
    if (!product.allow_overstock && (inCart + increment) > available) {
      alert("No hay más stock disponible para este producto");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newIsPack = forcePack || existing.isPack || false;
        const newQty = existing.quantity + increment;
        const newPrice = getActivePrice(product, newIsPack, newQty);
        return prev.map(item => item.product.id === product.id 
          ? { ...item, quantity: newQty, price: newPrice, isPack: newIsPack } 
          : item
        );
      }
      const initialPrice = getActivePrice(product, forcePack, increment);
      return [...prev, { product, quantity: increment, price: initialPrice, isPack: forcePack }];
    });
  };

  const updateQuantity = (productId: string, delta: number | string, isPackInput: boolean = false) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const available = product.stock_actual - product.stock_reservado;
        let newQty: number;
        
        if (typeof delta === 'string') {
          const parsed = parseInt(delta) || 0;
          if ((isPackInput || product.only_pack_sale) && product.units_per_box > 1) {
            newQty = parsed * product.units_per_box;
          } else {
            newQty = parsed;
          }
        } else {
          newQty = item.quantity + delta;
        }

        if (product.only_pack_sale && product.units_per_box > 1) {
          const upb = product.units_per_box;
          if (newQty % upb !== 0) {
            newQty = Math.ceil(newQty / upb) * upb;
          }
        }
        
        if (!product.allow_overstock) {
          if (item.isPack && product.units_per_box > 1) {
            const maxPacks = Math.floor(available / product.units_per_box);
            newQty = Math.max(0, Math.min(newQty, maxPacks * product.units_per_box));
          } else {
            newQty = Math.max(0, Math.min(newQty, available));
          }
        } else {
          newQty = Math.max(0, newQty);
        }
        
        const newPrice = getActivePrice(product, !!item.isPack, newQty);
        return { ...item, quantity: newQty, price: newPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleTogglePack = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const nextIsPack = !item.isPack;
        
        let newQty = item.quantity;
        if (nextIsPack && product.units_per_box > 1) {
          // Al cambiar a pack, redondeamos las unidades físicas al múltiplo más cercano de la caja
          const packs = Math.ceil(item.quantity / product.units_per_box) || 1;
          newQty = packs * product.units_per_box;
          
          // Verificar stock
          const available = product.stock_actual - product.stock_reservado;
          if (!product.allow_overstock && newQty > available) {
            newQty = Math.floor(available / product.units_per_box) * product.units_per_box;
            if (newQty <= 0) {
              alert("No hay suficiente stock para vender 1 Pack de este producto");
              return item;
            }
          }
        }
        
        const newPrice = getActivePrice(product, nextIsPack, newQty);
        return {
          ...item,
          isPack: nextIsPack,
          quantity: newQty,
          price: newPrice
        };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const taxBreakdown = useMemo(() => {
    let net21 = 0;
    let net105 = 0;
    let exempt = 0;
    let iva21 = 0;
    let iva105 = 0;

    cart.forEach(item => {
      const grossSubtotal = item.price * item.quantity;
      const ivaRate = (item.product as any).iva_rate || 0;

      if (ivaRate === 0) {
        exempt += grossSubtotal;
      } else if (ivaRate === 10.5) {
        const net = grossSubtotal / 1.105;
        net105 += net;
        iva105 += (grossSubtotal - net);
      } else {
        const net = grossSubtotal / 1.21;
        net21 += net;
        iva21 += (grossSubtotal - net);
      }
    });

    const totalNet = net21 + net105 + exempt;
    const totalIva = iva21 + iva105;

    return { net21, net105, exempt, iva21, iva105, totalNet, totalIva };
  }, [cart]);

  const activeClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);
  const isFacturaA = activeClient?.tax_condition === 'Responsable Inscripto';

  const handleCheckout = () => {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) {
      alert("Por favor seleccione un cliente");
      return;
    }

    const orderId = getNextOrderNumber('REM');
    const invoiceId = getNextInvoiceNumber();
    setCurrentInvoiceNumber(invoiceId);

    // Add to Store
    addOrder({
      id: orderId,
      date: new Date().toLocaleString(),
      client_name: client.fantasy_name,
      total: total,
      status: 'Confirmado',
      items: cart.map(item => {
        const upb = item.product.units_per_box;
        const isPackMode = !!item.isPack && upb > 1;
        let suffix = '';
        if (upb > 1) {
          const packs = Math.floor(item.quantity / upb);
          const loose = item.quantity % upb;
          if (isPackMode) {
            suffix = ` (${packs} Pack${packs > 1 ? 's' : ''})`;
          } else if (packs > 0) {
            suffix = ` (${packs} Pack${packs > 1 ? 's' : ''} + ${loose} Un.)`;
          } else {
            suffix = ` (${loose} Un.)`;
          }
        }
        return {
          id: item.product.id,
          name: `${item.product.short_description || item.product.name}${suffix}`,
          quantity: item.quantity,
          price: item.price
        };
      }),
      tax_condition: client.tax_condition,
      invoice_type: isFacturaA ? 'A' : 'B',
      net_amount: taxBreakdown.totalNet,
      iva_amount: taxBreakdown.totalIva
    });

    // Discount physical stock
    cart.forEach(item => updateStock(item.product.id, -item.quantity));

    // Add Current Account Transaction (Invoice)
    addTransaction({
      client_id: client.id,
      type: 'FACTURA',
      reference: invoiceId,
      amount: total,
      status: 'PENDIENTE',
      notes: `Venta vinculada a ${orderId}`,
      tax_condition: client.tax_condition,
      invoice_type: isFacturaA ? 'A' : 'B',
      net_amount: taxBreakdown.totalNet,
      iva_amount: taxBreakdown.totalIva
    });

    setIsSuccess(true);
    updateBalance(client.id, -total); // Cargamos la deuda (valor negativo)
  };

  const handleParkOrder = () => {
    if (cart.length === 0) return;
    const client = clients.find(c => c.id === selectedClientId);
    parkOrder({
      client_id: selectedClientId,
      client_name: client?.fantasy_name || 'Consumidor Final',
      cart: cart
    });
    // Reserve stock for each item
    cart.forEach(item => reserveStock(item.product.id, item.quantity));
    clearTerminal();
  };

  const handleResumeParked = (id: string) => {
    const parked = resumeOrder(id);
    if (parked) {
      // Release reservation as it's now back in active cart
      parked.cart.forEach(item => releaseStock(item.product.id, item.quantity));
      setCart(parked.cart);
      setSelectedClientId(parked.client_id);
      setIsParkedDrawerOpen(false);
    }
  };

  const handleRemoveParked = (id: string) => {
    const parked = parkedOrders.find(o => o.id === id);
    if (parked) {
      // Release reservation when deleting
      parked.cart.forEach(item => releaseStock(item.product.id, item.quantity));
      removeParkedOrder(id);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = searchTerm.trim();
      if (!code) return;

      const matchedProduct = products.find(p => 
        p.status === 'activo' && 
        (warehouseFilter === 'all' || p.warehouse === warehouseFilter) &&
        (
          (p.barcode && p.barcode.trim() === code) || 
          p.sku.trim().toLowerCase() === code.toLowerCase()
        )
      );

      if (matchedProduct) {
        addToCart(matchedProduct);
        setSearchTerm('');
      } else {
        if (filteredProducts.length === 1) {
          addToCart(filteredProducts[0]);
          setSearchTerm('');
        } else {
          alert(`No se encontró ningún producto con el código/nombre: "${code}"`);
        }
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-fade-in relative">
      
      {/* Success & Remito Overlay */}
      {isSuccess && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-brand-black/90 backdrop-blur-md rounded-3xl p-6 overflow-y-auto">
          <div className="glass-card max-w-lg w-full border-emerald-500/30 p-0 overflow-hidden animate-in zoom-in duration-300">
            {/* Ticket Header */}
            <div className="bg-emerald-500/10 p-6 border-b border-emerald-500/20 text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">¡Venta Registrada!</h2>
              <div className="flex justify-center gap-4 mt-1">
                <span className="text-[9px] bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/30 rounded font-black text-emerald-400 uppercase tracking-widest">
                  FACTURA {isFacturaA ? 'A' : 'B'}
                </span>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] self-center">Nro: {currentInvoiceNumber}</p>
              </div>
            </div>

            {/* Ticket Content */}
            <div className="p-6 space-y-6 bg-white/5 text-xs">
              <div className="flex justify-between items-start border-b border-brand-charcoal pb-4">
                <div>
                  <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mb-1">Cliente / CUIT</p>
                  <p className="text-sm font-bold text-brand-smoke">{activeClient?.name || activeClient?.fantasy_name}</p>
                  <p className="text-[10px] text-brand-steel font-mono">{activeClient?.cuit || 'S/D'} • {activeClient?.tax_condition}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mb-1">Fecha</p>
                  <p className="text-sm font-bold text-brand-smoke">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString().substring(0, 5)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest">Detalle del Comprobante</p>
                <div className="space-y-2 border-b border-brand-charcoal pb-4">
                  {cart.map(item => {
                    const grossPrice = item.price;
                    const ivaRate = (item.product as any).iva_rate || 0;
                    const netPrice = ivaRate === 0 ? grossPrice : grossPrice / (1 + ivaRate/100);
                    
                    // Suffix calculation for ticket success overlay
                    const upb = item.product.units_per_box;
                    const isPackMode = !!item.isPack && upb > 1;
                    let suffix = '';
                    if (upb > 1) {
                      const packs = Math.floor(item.quantity / upb);
                      const loose = item.quantity % upb;
                      if (isPackMode) {
                        suffix = ` (${packs} Pack${packs > 1 ? 's' : ''})`;
                      } else if (packs > 0) {
                        suffix = ` (${packs} Pack${packs > 1 ? 's' : ''} + ${loose} Un.)`;
                      } else {
                        suffix = ` (${loose} Un.)`;
                      }
                    }

                    return (
                      <div key={item.product.id} className="flex justify-between text-[11px] border-b border-brand-charcoal/20 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex flex-col">
                          <span className="text-brand-smoke font-bold">
                            {item.quantity}x {item.product.short_description || item.product.name}
                            {suffix && <span className="text-brand-gold text-[10px] ml-1.5 font-medium">{suffix}</span>}
                          </span>
                          <span className="text-[8px] text-brand-steel uppercase font-black">
                            {item.product.warehouse} • {isFacturaA ? `Neto: $${netPrice.toFixed(2)} (IVA: ${ivaRate}%)` : `P. Unit: $${grossPrice}`}
                          </span>
                        </div>
                        <span className="text-brand-smoke font-bold font-mono">${(item.quantity * item.price).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotals & Taxes breakdown */}
                <div className="space-y-1.5 pt-1 text-right text-[11px] text-brand-steel">
                  {isFacturaA ? (
                    <>
                      {taxBreakdown.net21 > 0 && <p>Gravado 21%: <span className="font-mono font-bold text-brand-smoke">${taxBreakdown.net21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                      {taxBreakdown.iva21 > 0 && <p>IVA 21%: <span className="font-mono font-bold text-brand-smoke">${taxBreakdown.iva21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                      {taxBreakdown.net105 > 0 && <p>Gravado 10.5%: <span className="font-mono font-bold text-brand-smoke">${taxBreakdown.net105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                      {taxBreakdown.iva105 > 0 && <p>IVA 10.5%: <span className="font-mono font-bold text-brand-smoke">${taxBreakdown.iva105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                      {taxBreakdown.exempt > 0 && <p>Exento: <span className="font-mono font-bold text-brand-smoke">${taxBreakdown.exempt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                    </>
                  ) : (
                    <p className="text-[9px] italic">IVA Discriminado: ${taxBreakdown.totalIva.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                  )}
                  <div className="pt-2 border-t border-brand-charcoal flex justify-between items-end">
                     <span className="text-[10px] text-brand-gold font-black uppercase tracking-widest">Total Factura</span>
                     <span className="text-xl font-display font-black text-brand-smoke font-mono">${total.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              </div>

              {/* Barcode / QR Simulation */}
              <div className="pt-2 flex flex-col items-center">
                <div className="w-full bg-white rounded overflow-hidden flex justify-center py-2 mb-1 shadow-inner">
                   <BarcodeComponent 
                     value={currentInvoiceNumber || 'FAC-0000'} 
                     format="CODE128" 
                     width={1.8} 
                     height={40} 
                     displayValue={false} 
                     background="transparent"
                     lineColor="#000000"
                   />
                </div>
                <p className="text-[8px] font-mono font-bold text-brand-steel tracking-[0.3em]">{currentInvoiceNumber || 'FAC-0000'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-brand-charcoal/30 border-t border-brand-charcoal/50 flex flex-wrap gap-2.5">
               <button 
                 onClick={() => {
                   setIsSuccess(false);
                   clearTerminal();
                 }}
                 className="flex-1 min-w-[100px] bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
               >
                 Cerrar
               </button>
               <button 
                 onClick={handlePrintInvoice}
                 className="flex-1 min-w-[100px] bg-brand-wine hover:bg-brand-wine/80 text-white py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-lg shadow-brand-wine/25"
               >
                 <Printer size={14} /> Imprimir / PDF
               </button>
               <button 
                 onClick={() => {
                    const itemsList = cart.map(i => `- ${i.quantity}x ${i.product.name} [${i.product.warehouse}]`).join('%0A');
                    const message = `📦 *FACTURA DIGITAL ${isFacturaA ? 'A' : 'B'}: ${currentInvoiceNumber}*%0A👤 *Cliente:* ${activeClient?.fantasy_name}%0A📅 *Fecha:* ${new Date().toLocaleDateString()}%0A%0A--------------------------%0A${itemsList}%0A--------------------------%0A💰 *TOTAL NETO:* $${taxBreakdown.totalNet.toLocaleString()}%0A💸 *TOTAL IVA:* $${taxBreakdown.totalIva.toLocaleString()}%0A💎 *TOTAL COMPROBANTE:* $${total.toLocaleString()}%0A%0A_Adjunto comprobante PDF oficial generado. Gracias por su compra._`;
                    const phone = activeClient?.phone.replace(/\D/g, '') || '';
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                 }}
                 className="flex-1 min-w-[120px] bg-emerald-600 text-white hover:bg-emerald-500 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
               >
                 <Phone size={14} /> WhatsApp
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printable invoice container */}
      <div className="hidden">
         <div ref={invoicePrintRef} className="p-12 text-black bg-white space-y-6 print:block text-xs font-sans">
            {/* Interno Header Style */}
            <div className="border border-black p-4 relative">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white border-2 border-black w-14 h-14 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black leading-none">{isFacturaA ? 'A' : 'B'}</span>
                  <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">Comp.Int.</span>
               </div>
               
               <div className="grid grid-cols-2 gap-8 pt-4">
                  <div>
                     <h1 className="text-xl font-bold tracking-tight uppercase">{settings.distributorName}</h1>
                     <p className="text-[10px] text-gray-500">{settings.taxCondition}</p>
                     <p className="mt-2 text-[10px]">{settings.address}</p>
                     <p className="text-[10px]">Teléfono: {settings.phone}</p>
                     <p className="text-[10px]">Email: {settings.email}</p>
                  </div>
                  <div className="text-right pl-12">
                     <h2 className="text-base font-bold uppercase">Factura Comercial</h2>
                     <p className="text-xs font-mono font-bold mt-1">Nro: {currentInvoiceNumber}</p>
                     <p className="text-[10px] text-gray-500 mt-2">Fecha: {new Date().toLocaleDateString()}</p>
                     <p className="text-[10px] text-gray-500">CUIT: {settings.cuit}</p>
                     <p className="text-[10px] text-gray-500">Ingresos Brutos: {settings.ingresosBrutos}</p>
                     <p className="text-[10px] text-gray-500">Inicio de Actividades: {settings.initActivity}</p>
                  </div>
               </div>
            </div>

            {/* Client Section */}
            <div className="border border-black p-4 grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Señor(es):</p>
                  <p className="text-sm font-bold">{activeClient?.name || activeClient?.fantasy_name}</p>
                  <p className="text-[10px] mt-1">Dirección: {activeClient?.address || 'S/D'} - {activeClient?.city || 'S/D'}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px]"><b>CUIT:</b> {activeClient?.cuit || 'S/D'}</p>
                  <p className="text-[10px]"><b>Condición IVA:</b> {activeClient?.tax_condition}</p>
                  <p className="text-[10px]"><b>Forma de Pago:</b> Cuenta Corriente</p>
               </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-left border-collapse border border-black">
               <thead>
                  <tr className="bg-gray-100 border-b border-black text-[9px] uppercase font-bold">
                     <th className="px-3 py-2 border-r border-black">Código/SKU</th>
                     <th className="px-3 py-2 border-r border-black">Detalle</th>
                     <th className="px-3 py-2 border-r border-black text-right">Cant</th>
                     <th className="px-3 py-2 border-r border-black text-right">{isFacturaA ? 'Neto Unit' : 'Precio Unit'}</th>
                     <th className="px-3 py-2 border-r border-black text-center">Alic IVA</th>
                     <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
               </thead>
               <tbody>
                  {cart.map(item => {
                     const ivaRate = (item.product as any).iva_rate || 0;
                     const grossPrice = item.price;
                     const netPrice = ivaRate === 0 ? grossPrice : grossPrice / (1 + ivaRate/100);
                     const rowSubtotal = grossPrice * item.quantity;
                     
                     // Suffix calculation for printable invoice
                     const upb = item.product.units_per_box;
                     const isPackMode = !!item.isPack && upb > 1;
                     let suffix = '';
                     if (upb > 1) {
                       const packs = Math.floor(item.quantity / upb);
                       const loose = item.quantity % upb;
                       if (isPackMode) {
                         suffix = ` (${packs} Pack${packs > 1 ? 's' : ''})`;
                       } else if (packs > 0) {
                         suffix = ` (${packs} Pack${packs > 1 ? 's' : ''} + ${loose} Un.)`;
                       } else {
                         suffix = ` (${loose} Un.)`;
                       }
                     }

                     return (
                        <tr key={item.product.id} className="border-b border-gray-300 text-[10px]">
                           <td className="px-3 py-1.5 border-r border-gray-300 font-mono">{item.product.sku}</td>
                           <td className="px-3 py-1.5 border-r border-gray-300">
                              {item.product.name}
                              {suffix && <span className="text-gray-500 text-[9px] ml-1.5 font-bold">{suffix}</span>}
                           </td>
                           <td className="px-3 py-1.5 border-r border-gray-300 text-right">{item.quantity}</td>
                           <td className="px-3 py-1.5 border-r border-gray-300 text-right font-mono">
                              ${isFacturaA ? netPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : grossPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
                           </td>
                           <td className="px-3 py-1.5 border-r border-gray-300 text-center font-mono">{ivaRate}%</td>
                           <td className="px-3 py-1.5 text-right font-mono">${rowSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>

            {/* Bottom summary Block */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                  {/* Interno Barcode / QR Simulation */}
                  <div className="border border-gray-300 p-2 rounded w-44 flex flex-col items-center bg-gray-50">
                     <BarcodeComponent 
                       value={currentInvoiceNumber || 'FAC-0000'} 
                       format="CODE128" 
                       width={1.2} 
                       height={30} 
                       displayValue={false} 
                       background="transparent"
                       lineColor="#000000"
                     />
                     <span className="text-[7px] font-mono text-gray-500 uppercase mt-1">Comprobante Autorizado Interno</span>
                  </div>
               </div>

               <div className="text-right space-y-1 text-[10px] pl-16">
                  {isFacturaA ? (
                     <div className="space-y-1">
                        {taxBreakdown.net21 > 0 && <p>Neto Gravado 21%: <span className="font-mono font-bold">${taxBreakdown.net21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                        {taxBreakdown.iva21 > 0 && <p>IVA 21%: <span className="font-mono font-bold">${taxBreakdown.iva21.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                        {taxBreakdown.net105 > 0 && <p>Neto Gravado 10.5%: <span className="font-mono font-bold">${taxBreakdown.net105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                        {taxBreakdown.iva105 > 0 && <p>IVA 10.5%: <span className="font-mono font-bold">${taxBreakdown.iva105.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                        {taxBreakdown.exempt > 0 && <p>Neto Exento: <span className="font-mono font-bold">${taxBreakdown.exempt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>}
                     </div>
                  ) : (
                     <div className="space-y-1">
                        <p>Subtotal: <span className="font-mono">${taxBreakdown.totalNet.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>
                        <p>IVA Discriminado: <span className="font-mono">${taxBreakdown.totalIva.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></p>
                     </div>
                  )}
                  <div className="border-t border-black pt-2 flex justify-between font-bold text-sm">
                     <span>Importe Total:</span>
                     <span className="font-mono">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Left Column: Product Selection */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="glass-card p-4 border-brand-charcoal flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={20} />
            <input 
              type="text" 
              placeholder="Escanear código o buscar producto..." 
              className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-12 pr-4 py-3 text-brand-smoke focus:border-brand-gold outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="flex bg-brand-charcoal p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-rose-900/80 text-white shadow-inner" : "text-brand-steel hover:text-white")}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-rose-900/80 text-white shadow-inner" : "text-brand-steel hover:text-white")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <div className="flex bg-brand-charcoal p-1 rounded-xl">
             <select 
               className="bg-transparent text-xs font-bold text-brand-gold outline-none px-2"
               value={warehouseFilter}
               onChange={(e) => setWarehouseFilter(e.target.value)}
             >
               <option value="all">📍 Todos los Depósitos</option>
               {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
             </select>
          </div>
        </div>

        <div className="flex-1 glass-card border-brand-charcoal overflow-y-auto custom-scrollbar p-0">
          {viewMode === 'list' ? (
            <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-brand-graphite z-10">
              <tr className="text-[10px] uppercase font-black text-brand-steel border-b border-brand-charcoal tracking-[0.2em]">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-charcoal">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-brand-charcoal/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <ProductImage imageUrl={p.image_url} category={p.category} className="w-10 h-10 rounded-lg flex-shrink-0" />
                      <div>
                        <div className="font-bold text-brand-smoke group-hover:text-brand-gold transition-colors">{p.short_description || p.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-brand-steel font-bold uppercase tracking-widest">{p.brand}</span>
                          <span className="text-[8px] px-1.5 py-0.5 bg-brand-gold/10 rounded font-bold text-brand-gold border border-brand-gold/20 uppercase">{p.warehouse}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-brand-smoke">${getActivePrice(p).toLocaleString()} <span className="text-[10px] text-brand-steel font-normal">/u</span></div>
                    {p.units_per_box > 1 && (
                      <div className="text-[9px] text-brand-gold font-bold mt-0.5">
                        Pack: ${getPackPrice(p).toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const inCart = cart.find(i => i.product.id === p.id)?.quantity || 0;
                      const available = p.stock_actual - p.stock_reservado - inCart;
                      return (
                        <>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                             available <= 0 
                               ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                               : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {available} disponibles
                          </span>
                          {p.stock_reservado > 0 && (
                            <div className="text-[10px] text-amber-400 font-black mt-1 uppercase tracking-tight flex items-center gap-1">
                              <span className="bg-amber-400/20 px-1 rounded">{p.stock_reservado}</span> unidades reservadas
                            </div>
                          )}
                          {inCart > 0 && (
                            <div className="text-[10px] text-rose-400 font-black mt-1 uppercase tracking-tight flex items-center gap-1">
                              <span className="bg-rose-400/20 px-1 rounded">{inCart}</span> en este carrito
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {p.units_per_box > 1 && (
                        <button 
                          onClick={() => addToCart(p, true)}
                          disabled={!p.allow_overstock && (p.stock_actual - p.stock_reservado - (cart.find(i => i.product.id === p.id)?.quantity || 0)) < p.units_per_box}
                          className="bg-brand-gold/20 text-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:opacity-20 disabled:grayscale px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-brand-gold/30"
                        >
                          +1 Pack (x{p.units_per_box})
                        </button>
                      )}
                      <button 
                        onClick={() => addToCart(p, false)}
                        disabled={(p.only_pack_sale && p.units_per_box > 1) || (!p.allow_overstock && (p.stock_actual - p.stock_reservado - (cart.find(i => i.product.id === p.id)?.quantity || 0)) <= 0)}
                        className="bg-rose-500/10 text-rose-400 hover:bg-brand-wine hover:text-white disabled:opacity-20 disabled:grayscale px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-rose-500/20"
                        title={p.only_pack_sale && p.units_per_box > 1 ? "Venta exclusiva por pack cerrado" : "Añadir 1 Unidad"}
                      >
                        {p.only_pack_sale && p.units_per_box > 1 ? 'Sólo Pack' : (!p.allow_overstock && (p.stock_actual - p.stock_reservado - (cart.find(i => i.product.id === p.id)?.quantity || 0)) <= 0 ? 'Sin Stock' : '+1 Unidad')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredProducts.map(p => {
                const inCart = cart.find(i => i.product.id === p.id)?.quantity || 0;
                const available = p.stock_actual - p.stock_reservado - inCart;
                return (
                  <div key={p.id} className="bg-brand-charcoal/30 border border-brand-charcoal rounded-xl overflow-hidden flex flex-col justify-between hover:border-brand-gold/50 transition-colors group">
                    <div className="w-full h-28 relative bg-brand-black/20 border-b border-brand-charcoal/30">
                      <ProductImage imageUrl={p.image_url} category={p.category} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] px-2 py-0.5 bg-brand-black rounded text-brand-gold font-bold uppercase tracking-widest border border-brand-gold/20">{p.warehouse}</span>
                          <span className="text-[10px] text-brand-steel font-bold uppercase tracking-widest">{p.brand}</span>
                        </div>
                        <h4 className="font-bold text-brand-smoke group-hover:text-brand-gold transition-colors leading-tight mb-2">{p.short_description || p.name}</h4>
                      </div>
                    
                    <div className="mt-4 flex items-end justify-between">
                       <div>
                        <div className="font-mono font-bold text-xl text-brand-smoke">
                          ${getActivePrice(p).toLocaleString()} <span className="text-xs text-brand-steel font-normal">/u</span>
                        </div>
                        {p.units_per_box > 1 && (
                          <div className="text-[11px] text-brand-gold font-bold mt-1">
                            Pack: ${getPackPrice(p).toLocaleString()}
                          </div>
                        )}
                        <div className="text-[10px] font-bold text-brand-steel uppercase tracking-widest mt-1.5 flex items-center gap-1">
                          <Package size={10} /> {available > 0 ? `${available} DISP` : 'SIN STOCK'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {p.units_per_box > 1 && (
                          <button 
                            onClick={() => addToCart(p, true)}
                            disabled={!p.allow_overstock && available < p.units_per_box}
                            className={cn(
                              "px-3 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all border",
                              (p.allow_overstock || available >= p.units_per_box)
                                ? "bg-brand-gold/10 text-brand-gold hover:bg-brand-gold hover:text-brand-black border-brand-gold/30 active:scale-95 shadow-inner" 
                                : "bg-brand-charcoal text-brand-steel border-transparent cursor-not-allowed"
                            )}
                            title={`Añadir 1 Pack (x${p.units_per_box} unidades)`}
                          >
                            +1 Pack
                          </button>
                        )}
                        <button 
                          onClick={() => addToCart(p, false)}
                          disabled={(p.only_pack_sale && p.units_per_box > 1) || (!p.allow_overstock && available <= 0)}
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            (p.only_pack_sale && p.units_per_box > 1)
                              ? "bg-brand-charcoal text-brand-steel cursor-not-allowed"
                              : ((p.allow_overstock || available > 0)
                                  ? "bg-brand-wine text-white hover:bg-rose-900 hover:scale-105 active:scale-95 shadow-lg shadow-brand-wine/20" 
                                  : "bg-brand-charcoal text-brand-steel cursor-not-allowed")
                          )}
                          title={p.only_pack_sale && p.units_per_box > 1 ? "Sólo venta por pack cerrado" : "Añadir 1 Unidad"}
                        >
                          {p.only_pack_sale && p.units_per_box > 1 ? <Package size={16} className="text-brand-steel" /> : <Plus size={20} />}
                        </button>
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Cart & Checkout */}
      <div className="w-[400px] flex flex-col gap-6">
        
        {/* Client Selection */}
        <div className="glass-card p-4 border-brand-charcoal bg-brand-wine/5 border-brand-wine/10">
          <label className="text-[9px] uppercase font-black text-brand-gold tracking-[0.3em] mb-2 block">Asignar Cliente</label>
          <select 
            className="w-full bg-brand-charcoal border border-brand-charcoal rounded-lg px-3 py-2.5 text-white text-sm font-bold outline-none focus:border-brand-gold transition-all"
            value={selectedClientId || ''}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">Seleccionar Cliente...</option>
            {clients.filter(c => c.status === 'Activo').map(c => (
              <option key={c.id} value={c.id}>{c.fantasy_name} ({c.name})</option>
            ))}
          </select>
          {selectedClientId && (
            <div className="mt-3 flex items-center justify-between p-2.5 bg-brand-black/40 rounded-lg border border-brand-charcoal">
              <div>
                 <p className="text-[8px] text-brand-steel uppercase font-bold tracking-widest">Saldo Actual</p>
                 <p className={cn(
                   "text-sm font-bold",
                   (clients.find(c => c.id === selectedClientId)?.balance || 0) < 0 ? "text-rose-400" : "text-emerald-400"
                 )}>
                   ${Math.abs(clients.find(c => c.id === selectedClientId)?.balance || 0).toLocaleString()}
                 </p>
              </div>
              <div className="text-right">
                 <p className="text-[8px] text-brand-steel uppercase font-bold tracking-widest">Lista</p>
                 <p className="text-xs font-bold text-brand-smoke">{clients.find(c => c.id === selectedClientId)?.price_list}</p>
              </div>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 glass-card border-brand-charcoal flex flex-col overflow-hidden">
          {/* Cart Header */}
          <div className="p-4 border-b border-brand-charcoal bg-brand-charcoal/30 flex justify-between items-center">
            <h3 className="text-lg font-display font-black text-brand-gold flex items-center gap-2">
              <ShoppingCart size={20} /> CARRITO
              {totalItems > 0 && <span className="bg-brand-wine text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">{totalItems}</span>}
            </h3>
            <div className="flex gap-2">
              {parkedOrders.length > 0 && (
                <button 
                  onClick={() => setIsParkedDrawerOpen(true)}
                  className="p-2 bg-brand-charcoal hover:bg-brand-gold/20 text-brand-gold rounded-xl transition-all relative"
                  title="Pedidos Pausados"
                >
                  <Pause size={20} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-gold text-brand-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-brand-black">
                    {parkedOrders.length}
                  </span>
                </button>
              )}
              {cart.length > 0 && (
                <button 
                  onClick={handleParkOrder}
                  className="p-2 bg-brand-charcoal hover:bg-brand-gold/20 text-brand-gold rounded-xl transition-all"
                  title="Pausar Pedido Actual"
                >
                  <Pause size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-brand-steel opacity-30 text-center p-6">
                <ShoppingCart size={48} strokeWidth={1} className="mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">El carrito está vacío</p>
              </div>
            ) : (
              cart.map(item => {
                const p = products.find(prod => prod.id === item.product.id) || item.product;
                const upb = p.units_per_box;
                const isPackMode = !!item.isPack && upb > 1;
                const displayQty = isPackMode ? item.quantity / upb : item.quantity;
                const availableStock = p.stock_actual - p.stock_reservado;
                
                // Calculate display price correctly based on Option B and editable looseUnitSurcharge
                const client = clients.find(c => c.id === selectedClientId);
                const clientList = client?.price_list || 'Minorista';
                
                let packPriceList = clientList;
                if (clientList === 'Minorista') {
                  packPriceList = 'Mayorista';
                } else if (clientList === 'Mayorista') {
                  packPriceList = 'Distribuidor';
                } else {
                  packPriceList = 'Distribuidor';
                }
                const resolvedPackPrice = p.prices[packPriceList] || p.prices[clientList] || p.prices.Minorista;
                const normalPackPrice = p.prices[clientList] || p.prices.Minorista;
                const surchargePercent = p.loose_surcharge ?? settings.looseUnitSurcharge ?? 15;
                
                const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
                const displayPrice = isPackMode ? resolvedPackPrice : loosePriceVal;

                const packsCount = Math.floor(item.quantity / upb);
                const looseCount = item.quantity % upb;
                const isOptimized = !isPackMode && upb > 1 && item.quantity >= upb;

                return (
                  <div key={item.product.id} className="p-3 bg-brand-charcoal/40 rounded-xl border border-brand-charcoal group hover:border-brand-gold/20 transition-all flex flex-col gap-3 animate-in fade-in duration-200">
                    {/* Top: Name & Prices */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5 flex-1 pr-2">
                        <ProductImage imageUrl={item.product.image_url} category={item.product.category} className="w-8 h-8 rounded-lg flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-brand-smoke leading-tight mb-1">{item.product.short_description || item.product.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 bg-brand-black/40 rounded text-brand-steel border border-brand-charcoal uppercase font-bold">{item.product.warehouse}</span>
                            <p className="text-[10px] text-brand-gold font-mono">
                              ${displayPrice.toLocaleString()} {isPackMode ? `Pack (x${upb})` : 'c/u'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-bold text-brand-smoke">${(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    </div>

                    {isOptimized && (
                      <div className="px-2.5 py-2 bg-brand-gold/10 rounded-lg border border-brand-gold/20 text-[10px] text-brand-gold font-bold flex flex-col gap-0.5 w-full">
                        <div className="flex justify-between items-center font-display">
                          <span className="flex items-center gap-1">⚡ ¡Tarifa optimizada!</span>
                          <span className="font-extrabold text-[8px] uppercase tracking-wider bg-brand-gold text-brand-black px-1.5 py-0.5 rounded-md shadow-inner">Descuento Pack</span>
                        </div>
                        <div className="text-brand-steel font-normal">
                          Llevás {packsCount} {packsCount === 1 ? 'Pack completo' : 'Packs completos'} {looseCount > 0 ? `y ${looseCount} ${looseCount === 1 ? 'unidad suelta' : 'unidades sueltas'}` : ''}
                        </div>
                        <div className="font-mono text-[9px] text-brand-gold/80 mt-0.5 leading-none">
                          Desglose: ({packsCount} x ${resolvedPackPrice.toLocaleString()}{looseCount > 0 ? ` + ${looseCount} x $${loosePriceVal.toLocaleString()}` : ''})
                        </div>
                      </div>
                    )}
                    
                    {/* Mode Toggle (if upb > 1) */}
                    {upb > 1 && (
                      <div className="flex items-center justify-between border-t border-b border-brand-charcoal/20 py-2">
                        <span className="text-[9px] text-brand-steel font-bold uppercase tracking-wider">Modo de Venta:</span>
                        {p.only_pack_sale ? (
                          <span className="text-[9px] bg-brand-gold/10 text-brand-gold border border-brand-gold/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                            Sólo Pack Cerrado
                          </span>
                        ) : (
                          <div className="flex bg-brand-black p-0.5 rounded-lg border border-brand-charcoal text-[9px] font-black uppercase">
                            <button
                              type="button"
                              onClick={() => !isPackMode ? null : handleTogglePack(item.product.id)}
                              className={cn(
                                "px-2.5 py-0.5 rounded-[4px] transition-all duration-200",
                                !isPackMode ? "bg-brand-wine text-white shadow" : "text-brand-steel hover:text-white"
                              )}
                            >
                              Unidad
                            </button>
                            <button
                              type="button"
                              onClick={() => isPackMode ? null : handleTogglePack(item.product.id)}
                              className={cn(
                                "px-2.5 py-0.5 rounded-[4px] transition-all duration-200",
                                isPackMode ? "bg-brand-gold text-brand-black shadow" : "text-brand-steel hover:text-white"
                              )}
                            >
                              Pack (x{upb})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Bottom: Controls */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center bg-brand-black rounded-lg p-0.5 border border-brand-charcoal shadow-inner">
                        <button 
                          onClick={() => updateQuantity(item.product.id, isPackMode ? -upb : -1)} 
                          className="p-1.5 text-brand-steel hover:text-white transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <input 
                          type="number" 
                          className="w-10 bg-transparent text-center text-xs font-black text-brand-gold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={displayQty}
                          onChange={(e) => updateQuantity(item.product.id, e.target.value, isPackMode)}
                        />
                        <button 
                          onClick={() => updateQuantity(item.product.id, isPackMode ? upb : 1)} 
                          disabled={item.quantity >= availableStock}
                          className="p-1.5 text-brand-steel hover:text-white transition-colors disabled:opacity-20"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="flex gap-1 flex-1">
                         {isPackMode ? (
                           [1, 2, 5].map(packs => (
                             <button 
                               key={packs}
                               onClick={() => updateQuantity(item.product.id, packs * upb)}
                               className="flex-1 bg-brand-charcoal hover:bg-brand-gold/20 text-brand-steel hover:text-brand-gold py-1 rounded-[6px] text-[9px] font-black transition-all border border-brand-charcoal hover:border-brand-gold/30"
                             >
                               +{packs}P
                             </button>
                           ))
                         ) : (
                           [6, 12, 24].map(num => (
                             <button 
                               key={num}
                               onClick={() => updateQuantity(item.product.id, num)}
                               className="flex-1 bg-brand-charcoal hover:bg-brand-gold/20 text-brand-steel hover:text-brand-gold py-1 rounded-[6px] text-[9px] font-black transition-all border border-brand-charcoal hover:border-brand-gold/30"
                             >
                               +{num}
                             </button>
                           ))
                         )}
                         <button 
                           onClick={() => {
                             if (isPackMode) {
                               const maxPacks = Math.floor(availableStock / upb);
                               updateQuantity(item.product.id, (maxPacks * upb).toString());
                             } else {
                               updateQuantity(item.product.id, availableStock.toString());
                             }
                           }}
                           className="flex-1 bg-rose-500/10 hover:bg-rose-600/30 text-rose-400 py-1 rounded-[6px] text-[9px] font-black transition-all border border-rose-500/20"
                         >
                           MAX
                         </button>
                      </div>

                      <button onClick={() => updateQuantity(item.product.id, -item.quantity)} className="p-1.5 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all ml-1" title="Eliminar del carrito">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout Footer */}
          <div className="p-4 bg-brand-charcoal/50 border-t border-brand-charcoal space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-brand-steel">
                <span>Total Items:</span>
                <span className="font-bold text-brand-smoke">{totalItems}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] uppercase font-black text-brand-gold tracking-widest">Total Final</span>
                <span className="text-xl font-display font-black text-brand-smoke">${total.toLocaleString()}</span>
              </div>
            </div>
            
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedClientId}
              className="w-full btn-gold py-3 font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-brand-gold/10 flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale transition-all"
            >
              Confirmar Pedido <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* Parked Orders Side Drawer */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full md:w-[400px] bg-brand-black border-l border-brand-charcoal z-[300] shadow-2xl transition-transform duration-500 ease-out flex flex-col",
        isParkedDrawerOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-display font-bold flex items-center gap-2 uppercase tracking-widest text-brand-gold">
              <Pause size={20} /> Pedidos Pausados
            </h3>
          </div>
          <button onClick={() => setIsParkedDrawerOpen(false)} className="p-2 hover:bg-brand-charcoal rounded-full transition-colors text-brand-steel"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {parkedOrders.length === 0 && (
            <div className="text-center py-20 text-brand-steel">
              <Pause size={40} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold">No hay pedidos en espera</p>
            </div>
          )}
          {parkedOrders.map(parked => (
            <div key={parked.id} className="p-4 bg-brand-charcoal/20 rounded-2xl border border-brand-charcoal hover:border-brand-gold/30 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-bold text-brand-smoke">{parked.client_name}</p>
                  <p className="text-[10px] text-brand-steel font-bold uppercase">{parked.timestamp}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleRemoveParked(parked.id)}
                    className="p-2 text-brand-steel hover:text-rose-400 transition-colors"
                    title="Descartar Pedido"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleResumeParked(parked.id)}
                    className="bg-brand-gold text-brand-black p-2 rounded-xl hover:scale-110 transition-transform shadow-lg shadow-brand-gold/10"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                 {parked.cart.slice(0, 2).map(item => (
                   <p key={item.product.id} className="text-[10px] text-brand-steel truncate">{item.quantity}x {item.product.name}</p>
                 ))}
                 {parked.cart.length > 2 && <p className="text-[9px] text-brand-gold font-bold italic">+ {parked.cart.length - 2} productos más...</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {isParkedDrawerOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[290]" onClick={() => setIsParkedDrawerOpen(false)} />}
    </div>
  );
};

export default SalesTerminal;
