import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Copy, 
  Download, 
  RefreshCw, 
  ShoppingBag, 
  Phone, 
  Mail, 
  AlertCircle, 
  Check, 
  ArrowRightLeft, 
  Search
} from 'lucide-react';
import { useConsignmentsStore, type Seller } from '../../store/useConsignmentsStore';
import { useStockStore } from '../../store/useStockStore';
import { cn } from '../../lib/utils';

export const ConsignmentsManagement: React.FC = () => {
  const { 
    sellers, 
    consignedProducts, 
    addSeller, 
    deleteSeller, 
    addConsignment, 
    updateConsignment, 
    deleteConsignment,
    syncFeedFile
  } = useConsignmentsStore();

  const { products } = useStockStore();

  // Navigation / Tabs state
  const [activeTab, setActiveTab] = useState<'sellers' | 'consignments'>('sellers');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  // Modals state
  const [showAddSellerModal, setShowAddSellerModal] = useState(false);
  const [showAddConsignmentModal, setShowAddConsignmentModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

  // Add Seller Form State
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');

  // Add Consignment Form State
  const [selectedConsignmentItems, setSelectedConsignmentItems] = useState<Array<{
    product: any;
    price: number;
    quantity: number;
  }>>([]);
  const [productSearch, setProductSearch] = useState('');

  const closeConsignmentModal = () => {
    setShowAddConsignmentModal(false);
    setSelectedConsignmentItems([]);
    setProductSearch('');
  };

  // Selected Seller details
  const selectedSeller = useMemo(() => {
    return sellers.find(s => s.id === selectedSellerId) || null;
  }, [sellers, selectedSellerId]);

  // Products currently consigned to the selected seller
  const sellerConsignments = useMemo(() => {
    if (!selectedSellerId) return [];
    return consignedProducts.filter(cp => cp.seller_id === selectedSellerId);
  }, [consignedProducts, selectedSellerId]);

  // Available products that can be consigned (filtered search)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.sku.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [products, productSearch]);

  const handleAddSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerName.trim() || !sellerPhone.trim()) return;

    addSeller({
      name: sellerName,
      phone: sellerPhone,
      email: sellerEmail,
      status: 'activo'
    });

    setSellerName('');
    setSellerPhone('');
    setSellerEmail('');
    setShowAddSellerModal(false);
  };

  const handleAddConsignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellerId || selectedConsignmentItems.length === 0) return;

    // Validate prices and quantities
    for (const item of selectedConsignmentItems) {
      if (item.price <= 0) {
        alert(`Por favor ingresa un precio mayor a 0 para el producto ${item.product.name}.`);
        return;
      }
      if (item.quantity <= 0) {
        alert(`Por favor ingresa una cantidad mayor a 0 para el producto ${item.product.name}.`);
        return;
      }
      const available = item.product.stock_actual - item.product.stock_reservado;
      if (item.quantity > available) {
        alert(`No puedes consignar más de la cantidad disponible (${available} u.) del producto ${item.product.name}.`);
        return;
      }
    }

    selectedConsignmentItems.forEach(item => {
      addConsignment({
        seller_id: selectedSellerId,
        product_id: item.product.id,
        price: item.price,
        quantity: item.quantity
      });
    });

    closeConsignmentModal();
  };

  // Generate Google Merchant / Meta Catalog CSV format
  const generateCSVContent = (sellerId: string) => {
    const items = consignedProducts.filter(cp => cp.seller_id === sellerId);
    
    // Meta commerce feed columns
    const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
    
    const rows = items.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return null;
      
      const availableStock = item.quantity - (item.stock_sold || 0) - (item.stock_returned || 0);
      const availability = availableStock > 0 ? 'in stock' : 'out of stock';
      
      // Meta requires price + currency code (e.g. 1500 ARS)
      const priceFormatted = `${item.price} ARS`;
      const imageLink = prod.image_url || 'https://raw.githubusercontent.com/CsiCR/distribuidora-pwa/main/public/placeholder.png';
      
      // Fallback web link for the product
      const productLink = `${window.location.origin}/#/product/${prod.sku}`;
      
      // Clean string fields to avoid breaking CSV format
      const clean = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      
      return [
        clean(prod.sku),
        clean(prod.name),
        clean(prod.short_description || `Producto ${prod.name} en consignación de ${selectedSeller?.name}`),
        clean(availability),
        clean('new'),
        clean(priceFormatted),
        clean(productLink),
        clean(imageLink),
        clean(prod.brand || 'Generico')
      ];
    }).filter(Boolean);

    return [headers.join(','), ...rows.map(r => r!.join(','))].join('\n');
  };

  const handleSyncFeed = async (sellerId: string) => {
    setSyncingId(sellerId);
    setSyncFeedback({ text: '', type: null });

    const csvContent = generateCSVContent(sellerId);
    
    // Simulate slight lag for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const publicUrl = await syncFeedFile(sellerId, csvContent);

    setSyncingId(null);
    if (publicUrl) {
      setSyncFeedback({
        text: '¡Feed sincronizado correctamente en Supabase Storage!',
        type: 'success'
      });
    } else {
      setSyncFeedback({
        text: 'No se pudo subir a Supabase. Puedes descargar el CSV localmente haciendo clic abajo.',
        type: 'error'
      });
    }
    
    setTimeout(() => {
      setSyncFeedback({ text: '', type: null });
    }, 4500);
  };

  const handleDownloadCSV = (seller: Seller) => {
    const csvContent = generateCSVContent(seller.id);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogo_whatsapp_${seller.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.2em] bg-brand-gold/10 px-2 py-1 rounded">
            Fidelización & Canales
          </span>
          <h1 className="text-3xl font-display font-black text-brand-smoke uppercase tracking-tight mt-2">
            VENDEDORES EN CONSIGNACIÓN
          </h1>
          <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest mt-1">
            Concede stock a vendedores externos y genera feeds automáticos para su catálogo de WhatsApp Business
          </p>
        </div>
        
        {/* Tab Buttons */}
        <div className="flex bg-brand-charcoal p-1 rounded-xl shrink-0 h-fit border border-brand-charcoal/50">
          <button 
            onClick={() => setActiveTab('sellers')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'sellers' ? "bg-brand-wine text-white shadow-lg" : "text-brand-steel hover:text-white"
            )}
          >
            <Users size={14} /> Vendedores
          </button>
          <button 
            onClick={() => {
              setActiveTab('consignments');
              if (!selectedSellerId && sellers.length > 0) {
                setSelectedSellerId(sellers[0].id);
              }
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'consignments' ? "bg-brand-wine text-white shadow-lg" : "text-brand-steel hover:text-white"
            )}
          >
            <ShoppingBag size={14} /> Control de Consignación
          </button>
        </div>
      </div>

      {activeTab === 'sellers' ? (
        /* Sellers Tab */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-brand-graphite p-4 rounded-2xl border border-brand-charcoal shadow-xl">
            <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest">
              Total Vendedores Activos: <span className="text-brand-gold">{sellers.length}</span>
            </p>
            <button 
              onClick={() => setShowAddSellerModal(true)} 
              className="btn-gold py-2.5 px-6 flex items-center gap-2 text-xs"
            >
              <Plus size={16} /> Registrar Vendedor
            </button>
          </div>

          {sellers.length === 0 ? (
            <div className="glass-card border-brand-charcoal/30 p-16 text-center">
              <Users size={48} className="text-brand-steel mx-auto mb-4 opacity-40 animate-pulse" />
              <h3 className="text-lg font-bold text-brand-smoke mb-1">No hay vendedores registrados</h3>
              <p className="text-brand-steel text-xs max-w-md mx-auto">
                Registra a tus vendedores externos o promotores independientes para empezar a concederles stock en consignación.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sellers.map(seller => {
                const totalItemsConsigned = consignedProducts
                  .filter(cp => cp.seller_id === seller.id)
                  .reduce((acc, cp) => acc + cp.quantity, 0);

                return (
                  <div key={seller.id} className="glass-card border-brand-charcoal p-5 space-y-4 hover:border-brand-gold/40 transition-colors relative flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-display font-black text-sm text-white uppercase tracking-tight truncate max-w-[180px]">
                            {seller.name}
                          </h3>
                          <span className="text-[8px] text-brand-steel font-mono">ID: {seller.id}</span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          seller.status === 'activo' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-brand-charcoal text-brand-steel"
                        )}>
                          {seller.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-brand-steel font-medium">
                        <p className="flex items-center gap-2"><Phone size={12} className="text-brand-gold" /> {seller.phone}</p>
                        {seller.email && <p className="flex items-center gap-2"><Mail size={12} className="text-brand-gold" /> {seller.email}</p>}
                        <p className="flex items-center gap-2">
                          <ShoppingBag size={12} className="text-brand-gold" /> 
                          Productos Consignados: <span className="text-white font-bold">{totalItemsConsigned}</span>
                        </p>
                      </div>

                      {/* WhatsApp Feed Link Area */}
                      <div className="border border-brand-charcoal bg-brand-black/45 rounded-xl p-3 space-y-2">
                        <label className="text-[8px] font-black uppercase text-brand-gold tracking-widest block">URL del Feed para WhatsApp</label>
                        {seller.feed_url ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              className="bg-brand-charcoal text-[9px] font-mono text-brand-smoke px-2 py-1 rounded w-full border border-transparent outline-none focus:border-brand-gold truncate" 
                              readOnly 
                              value={seller.feed_url} 
                            />
                            <button 
                              onClick={() => handleCopyUrl(seller.feed_url!, seller.id)}
                              className="p-1.5 bg-brand-charcoal border border-brand-charcoal rounded-lg hover:border-brand-gold/50 text-brand-steel hover:text-white transition-colors cursor-pointer"
                              title="Copiar URL"
                            >
                              {copiedId === seller.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <p className="text-[9px] text-brand-steel italic leading-tight">
                            Aún no se ha generado el feed. Presiona el botón de abajo para crearlo.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-brand-charcoal flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedSellerId(seller.id);
                          setActiveTab('consignments');
                        }}
                        className="btn-secondary py-2 text-[10px] uppercase font-black tracking-widest flex-1 justify-center flex items-center gap-1.5"
                      >
                        Gestionar Stock
                      </button>
                      <button 
                        onClick={() => handleSyncFeed(seller.id)}
                        disabled={syncingId === seller.id}
                        className="btn-gold py-2 text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5"
                        title="Sincronizar Feed de WhatsApp"
                      >
                        {syncingId === seller.id ? <Loader size={12} /> : <RefreshCw size={12} />}
                        Sync Feed
                      </button>
                      <button 
                        onClick={() => handleDownloadCSV(seller)}
                        className="p-2 bg-brand-charcoal border border-brand-charcoal rounded-xl text-brand-steel hover:text-white hover:border-brand-gold transition-colors cursor-pointer"
                        title="Descargar CSV Manual"
                      >
                        <Download size={14} />
                      </button>
                      <button 
                        onClick={() => { if(confirm('¿Eliminar vendedor y todas sus consignaciones?')) deleteSeller(seller.id); }}
                        className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Consignments Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sellers Selector List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card border-brand-charcoal p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase text-brand-gold tracking-[0.2em] mb-2">Seleccionar Vendedor</h3>
              <div className="flex flex-col gap-2">
                {sellers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSellerId(s.id)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                      selectedSellerId === s.id
                        ? "bg-brand-wine/10 border-brand-wine text-white font-bold"
                        : "bg-brand-black/30 border-brand-charcoal text-brand-steel hover:text-brand-smoke hover:border-brand-steel/30"
                    )}
                  >
                    <div>
                      <span className="text-xs uppercase font-bold tracking-tight block">{s.name}</span>
                      <span className="text-[9px] text-brand-steel font-mono">{s.phone}</span>
                    </div>
                    {selectedSellerId === s.id && <Check size={14} className="text-brand-gold shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
            
            {selectedSeller && (
              <div className="glass-card border-brand-charcoal p-5 space-y-3 bg-brand-charcoal/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-brand-gold/5 rounded-full blur-xl" />
                <h4 className="text-[10px] font-black uppercase text-brand-steel tracking-widest">Sincronización de Catálogo</h4>
                <p className="text-[10px] text-brand-steel leading-relaxed">
                  Para actualizar las existencias de **{selectedSeller.name}** en WhatsApp Business, presiona "Sincronizar Feed".
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={() => handleSyncFeed(selectedSeller.id)}
                    disabled={syncingId === selectedSeller.id}
                    className="w-full btn-gold py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {syncingId === selectedSeller.id ? <Loader size={14} /> : <RefreshCw size={14} />}
                    Sincronizar Feed
                  </button>
                  <button 
                    onClick={() => handleDownloadCSV(selectedSeller)}
                    className="w-full btn-secondary py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={14} /> Descargar CSV
                  </button>
                </div>
                
                {selectedSeller.feed_url && (
                  <div className="pt-2 border-t border-brand-charcoal/50 space-y-1.5">
                    <span className="text-[8px] font-black uppercase text-brand-gold tracking-widest block">URL del Feed público</span>
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        readOnly 
                        value={selectedSeller.feed_url} 
                        className="bg-brand-black text-[9px] font-mono text-brand-steel px-2 py-1.5 rounded-xl border border-brand-charcoal w-full truncate select-all" 
                      />
                      <button 
                        onClick={() => handleCopyUrl(selectedSeller.feed_url!, selectedSeller.id)}
                        className="p-1.5 bg-brand-black border border-brand-charcoal rounded-lg text-brand-steel hover:text-white cursor-pointer"
                      >
                        {copiedId === selectedSeller.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-brand-black/35 p-3 rounded-xl border border-brand-charcoal/40 text-[9px] text-brand-steel flex gap-2">
                  <AlertCircle size={14} className="text-brand-gold shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    <strong className="text-brand-gold">Nota de Supabase:</strong> Si la sincronización automática falla, asegúrate de crear un Bucket Público llamado <code className="text-white font-mono bg-brand-charcoal px-1 py-0.2 rounded font-black">feeds</code> en la consola de Storage de Supabase.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Consignment Products Detail Table */}
          <div className="lg:col-span-2 space-y-4">
            {selectedSeller ? (
              <div className="glass-card border-brand-charcoal p-5 space-y-5">
                <div className="flex justify-between items-center border-b border-brand-charcoal/50 pb-4">
                  <div>
                    <h3 className="font-display font-black text-sm text-white uppercase tracking-tight">
                      PRODUCTOS CONSIGNADOS: {selectedSeller.name}
                    </h3>
                    <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mt-0.5">
                      Monitorea las cantidades dadas en consignación, reportes de ventas y devoluciones
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAddConsignmentModal(true)} 
                    className="btn-gold py-2 px-5 flex items-center gap-2 text-xs"
                  >
                    <Plus size={14} /> Asignar Producto
                  </button>
                </div>

                {sellerConsignments.length === 0 ? (
                  <div className="p-16 text-center border-2 border-dashed border-brand-charcoal/30 rounded-2xl">
                    <ShoppingBag size={36} className="text-brand-steel mx-auto mb-3 opacity-30" />
                    <h4 className="font-bold text-brand-smoke mb-1">Ningún producto consignado</h4>
                    <p className="text-brand-steel text-xs max-w-sm mx-auto">
                      Concede existencias físicas a este vendedor presionando el botón "Asignar Producto".
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-brand-charcoal/40 text-brand-steel text-[9px] uppercase tracking-wider font-bold">
                        <tr>
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3 text-right">Precio Consignación</th>
                          <th className="px-4 py-3 text-center">Consignado</th>
                          <th className="px-4 py-3 text-center">Vendido</th>
                          <th className="px-4 py-3 text-center">Devuelto</th>
                          <th className="px-4 py-3 text-center">Disponible</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-charcoal/40">
                        {sellerConsignments.map(item => {
                          const prod = products.find(p => p.id === item.product_id);
                          if (!prod) return null;

                          const available = item.quantity - item.stock_sold - item.stock_returned;

                          return (
                            <tr key={item.id} className="table-row-hover text-xs">
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-brand-smoke">{prod.name}</div>
                                <div className="text-[9px] text-brand-steel font-mono">SKU: {prod.sku} • {prod.brand}</div>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-brand-gold">
                                ${item.price.toLocaleString('es-AR')}
                              </td>
                              
                              {/* Consigned Qty input/view */}
                              <td className="px-4 py-3.5 text-center font-bold">
                                {item.quantity}
                              </td>

                              {/* Sold Qty input/view */}
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="font-bold text-white">{item.stock_sold}</span>
                                  <button 
                                    onClick={() => {
                                      const extra = prompt('Cantidad vendida adicional:', '0');
                                      if (extra) {
                                        const num = Number(extra);
                                        if (!isNaN(num) && num > 0) {
                                          if (item.stock_sold + num > item.quantity) {
                                            alert('No puede reportar ventas mayores a la cantidad consignada.');
                                            return;
                                          }
                                          updateConsignment(item.id, { stock_sold: item.stock_sold + num });
                                        }
                                      }
                                    }}
                                    className="p-0.5 hover:bg-brand-charcoal rounded text-brand-gold cursor-pointer"
                                    title="Registrar Venta"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              </td>

                              {/* Returned Qty input/view */}
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="font-bold text-brand-steel">{item.stock_returned}</span>
                                  <button 
                                    onClick={() => {
                                      const extra = prompt('Cantidad devuelta por el vendedor:', '0');
                                      if (extra) {
                                        const num = Number(extra);
                                        if (!isNaN(num) && num > 0) {
                                          if (item.stock_returned + num > item.quantity) {
                                            alert('No puede reportar devoluciones mayores a la cantidad consignada.');
                                            return;
                                          }
                                          updateConsignment(item.id, { stock_returned: item.stock_returned + num });
                                        }
                                      }
                                    }}
                                    className="p-0.5 hover:bg-brand-charcoal rounded text-brand-steel hover:text-white cursor-pointer"
                                    title="Registrar Devolución"
                                  >
                                    <ArrowRightLeft size={10} />
                                  </button>
                                </div>
                              </td>

                              {/* Available Qty */}
                              <td className="px-4 py-3.5 text-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded font-black font-mono text-[10px]",
                                  available > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                )}>
                                  {available}
                                </span>
                              </td>

                              {/* Remove consignment */}
                              <td className="px-4 py-3.5 text-right">
                                <button 
                                  onClick={() => { if(confirm('¿Retirar producto de la consignación?')) deleteConsignment(item.id); }}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Quitar Producto"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card border-brand-charcoal p-16 text-center">
                <Users size={36} className="text-brand-steel mx-auto mb-3 opacity-30" />
                <h4 className="font-bold text-brand-smoke mb-1">Selecciona un Vendedor</h4>
                <p className="text-brand-steel text-xs max-w-sm mx-auto">
                  Por favor selecciona un vendedor de la lista lateral para ver o gestionar sus productos consignados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync feedback indicator toast/banner */}
      {syncFeedback.text && (
        <div className={cn(
          "fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl z-[250] flex items-center gap-3 border text-xs font-bold animate-fade-in",
          syncFeedback.type === 'success' 
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          <AlertCircle size={16} />
          <span>{syncFeedback.text}</span>
        </div>
      )}

      {/* Add Seller Modal */}
      {showAddSellerModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm" onClick={() => setShowAddSellerModal(false)} />
          <div className="glass-card w-full max-w-md p-0 relative z-10 border-brand-gold/30 overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-brand-gold/10 px-6 py-4 border-b border-brand-gold/20 flex justify-between items-center">
              <h3 className="text-lg font-display font-bold flex items-center gap-2 text-white">
                <Users size={18} className="text-brand-gold" /> Registrar Vendedor
              </h3>
              <button 
                onClick={() => setShowAddSellerModal(false)} 
                className="p-1 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddSeller} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none transition-all" 
                  value={sellerName}
                  onChange={e => setSellerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Teléfono (WhatsApp)</label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none transition-all" 
                  value={sellerPhone}
                  onChange={e => setSellerPhone(e.target.value)}
                  placeholder="Ej: +54 9 11 2222-3333"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Email (Opcional)</label>
                <input 
                  type="email" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none transition-all" 
                  value={sellerEmail}
                  onChange={e => setSellerEmail(e.target.value)}
                  placeholder="Ej: juan.perez@email.com"
                />
              </div>

              <button 
                type="submit" 
                className="w-full btn-gold py-3 rounded-xl font-black uppercase tracking-widest text-xs mt-2"
              >
                Guardar Registro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Consignment Modal */}
      {showAddConsignmentModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm" onClick={closeConsignmentModal} />
          <div className="glass-card w-full max-w-xl p-0 relative z-10 border-brand-gold/30 overflow-hidden shadow-2xl animate-scale-up" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="bg-brand-gold/10 px-6 py-4 border-b border-brand-gold/20 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-display font-bold flex items-center gap-2 text-white">
                <Plus size={18} className="text-brand-gold" /> Asignar Productos a Consignación
              </h3>
              <button 
                onClick={closeConsignmentModal} 
                className="p-1 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddConsignmentSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {/* Product selector search */}
              <div className="space-y-1 relative">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest block mb-1">Buscar Producto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={14} />
                  <input 
                    type="text" 
                    className="w-full bg-brand-black border border-brand-charcoal rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-brand-gold outline-none transition-all" 
                    placeholder="Filtrar por SKU, nombre, marca..." 
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                
                {filteredProducts.length > 0 && (
                  <div className="mt-2 border border-brand-charcoal bg-brand-black rounded-xl max-h-40 overflow-y-auto divide-y divide-brand-charcoal pr-1 custom-scrollbar">
                    {filteredProducts.map(p => {
                      const isAdded = selectedConsignmentItems.some(item => item.product.id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              alert('Este producto ya está en la lista de asignación.');
                              return;
                            }
                            setSelectedConsignmentItems(prev => [
                              ...prev,
                              {
                                product: p,
                                price: p.prices.Minorista,
                                quantity: 1
                              }
                            ]);
                            setProductSearch('');
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2.5 hover:bg-brand-charcoal/20 text-xs transition-colors flex justify-between items-center",
                            isAdded && "opacity-55 cursor-not-allowed bg-brand-wine/5"
                          )}
                        >
                          <div>
                            <span className="font-bold text-brand-smoke">{p.name}</span>
                            <span className="text-[9px] text-brand-steel font-mono block">SKU: {p.sku} • {p.warehouse}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-brand-gold font-bold block">${p.prices.Minorista} u</span>
                            <span className="text-[8px] text-brand-steel block">Stock: {p.stock_actual - p.stock_reservado}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Draft List of Selected Products */}
              {selectedConsignmentItems.length > 0 ? (
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-brand-steel block">Productos Seleccionados ({selectedConsignmentItems.length})</label>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedConsignmentItems.map(item => {
                      const available = item.product.stock_actual - item.product.stock_reservado;
                      return (
                        <div key={item.product.id} className="p-3 bg-brand-charcoal/20 border border-brand-charcoal/50 rounded-xl space-y-2.5">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="text-xs font-bold text-white truncate">{item.product.name}</h4>
                              <p className="text-[9px] text-brand-steel font-mono">SKU: {item.product.sku} • Stock Disponible: <span className="text-brand-gold font-bold">{available} u.</span></p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedConsignmentItems(prev => prev.filter(p => p.product.id !== item.product.id));
                              }}
                              className="p-1 text-brand-steel hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Quitar"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase font-black text-brand-steel tracking-widest block">Precio Venta ($)</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-steel text-xs font-bold">$</span>
                                <input
                                  type="number"
                                  className="w-full bg-brand-black border border-brand-charcoal rounded-lg pl-6 pr-2 py-1 text-xs text-white focus:border-brand-gold outline-none transition-all font-bold"
                                  value={item.price || ''}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setSelectedConsignmentItems(prev => prev.map(p =>
                                      p.product.id === item.product.id ? { ...p, price: val } : p
                                    ));
                                  }}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase font-black text-brand-steel tracking-widest block">Cantidad</label>
                              <input
                                type="number"
                                className="w-full bg-brand-black border border-brand-charcoal rounded-lg px-2.5 py-1 text-xs text-white focus:border-brand-gold outline-none transition-all font-bold"
                                value={item.quantity || ''}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setSelectedConsignmentItems(prev => prev.map(p =>
                                    p.product.id === item.product.id ? { ...p, quantity: val } : p
                                  ));
                                }}
                                min={1}
                                max={available}
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-brand-charcoal/30 rounded-2xl">
                  <ShoppingBag size={24} className="text-brand-steel mx-auto mb-2 opacity-30 animate-pulse" />
                  <p className="text-brand-steel text-xs">
                    Busca y selecciona productos arriba para agregarlos al lote de consignación.
                  </p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={selectedConsignmentItems.length === 0}
                className="w-full btn-gold py-3 rounded-xl font-black uppercase tracking-widest text-xs mt-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Conceder Consignación ({selectedConsignmentItems.length})
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Mini Loader component
const Loader: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <div 
    className="animate-spin rounded-full border-t-2 border-b-2 border-current shrink-0" 
    style={{ width: size, height: size }} 
  />
);
