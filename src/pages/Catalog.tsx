import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Grid, List as ListIcon, User } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStockStore, type Product } from '../store/useStockStore';
import { useClientsStore } from '../store/useClientsStore';
import { cn } from '../lib/utils';
import { ProductImage } from '../components/ProductImage';

const Catalog: React.FC = () => {
  const distributorName = useSettingsStore(state => state.distributorName);
  const looseUnitSurcharge = useSettingsStore(state => state.looseUnitSurcharge ?? 15);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'quick' | 'visual'>('quick');
  const addItem = useCartStore((state) => state.addItem);
  const cartItemsCount = useCartStore((state) => state.items.length);
  
  // Real products and clients stores
  const { products } = useStockStore();
  const { clients } = useClientsStore();

  // Search and category filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Client resolution: from URL parameter or sessionStorage
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const urlClient = searchParams.get('c');
    if (urlClient) {
      sessionStorage.setItem('clientId', urlClient);
      setClientId(urlClient);
    } else {
      const savedClient = sessionStorage.getItem('clientId');
      if (savedClient) {
        setClientId(savedClient);
      }
    }
  }, [searchParams]);

  // Find identified client
  const client = useMemo(() => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId || c.fantasy_name === clientId);
  }, [clientId, clients]);

  // Determine price list (defaults to 'Minorista')
  const priceList = client ? client.price_list : 'Minorista';

  // Filter active products
  const activeProducts = useMemo(() => {
    return products.filter(p => p.status === 'activo');
  }, [products]);

  // Extract dynamic categories from active products
  const categories = useMemo(() => {
    const cats = activeProducts.map(p => p.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [activeProducts]);

  // Filter products based on search term and category selection
  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [activeProducts, searchTerm, selectedCategory]);

  // Stock status semaphore rules (protects exact numbers)
  const getStockStatus = (stockActual: number, unitsPerBox: number) => {
    const threshold = unitsPerBox > 1 ? unitsPerBox * 2 : 10;
    if (stockActual <= 0) return 'Sin Stock';
    if (stockActual <= threshold) return 'Pocas Unidades';
    return 'En Stock';
  };


  const getProductPriceDetails = (p: any) => {
    const clientList = priceList;
    const normalPackPrice = p.prices[clientList] || p.prices.Minorista || 0;
    const upb = p.units_per_box;
    
    if (upb <= 1) {
      return {
        hasPack: false,
        unitPrice: normalPackPrice,
        packPrice: normalPackPrice,
        unitPriceInPack: normalPackPrice,
        surchargePercent: 0
      };
    }
    
    let packPriceList = clientList;
    if (clientList === 'Minorista') {
      packPriceList = 'Mayorista';
    } else if (clientList === 'Mayorista') {
      packPriceList = 'Distribuidor';
    } else {
      packPriceList = 'Distribuidor';
    }
    
    const resolvedPackPrice = p.prices[packPriceList] || p.prices[clientList] || p.prices.Minorista || 0;
    const surchargePercent = p.loose_surcharge ?? looseUnitSurcharge;
    
    const packPriceVal = resolvedPackPrice;
    const unitPriceInPack = Math.round((resolvedPackPrice / upb) * 100) / 100;
    const loosePriceVal = Math.round(((normalPackPrice / upb) * (1 + surchargePercent / 100)) * 100) / 100;
    
    return {
      hasPack: true,
      unitPrice: loosePriceVal,
      packPrice: packPriceVal,
      unitPriceInPack,
      surchargePercent
    };
  };

  const handleAddToCart = (product: Product, isPack: boolean = false) => {
    const isPackMode = isPack && product.units_per_box > 1;
    const qty = isPackMode ? product.units_per_box : 1;
    addItem(product, qty, isPackMode);
  };

  const cartUrl = clientId ? `/carrito?c=${clientId}` : '/carrito';

  return (
    <div className="min-h-screen bg-brand-black pb-20">
      {/* Client Welcome Banner */}
      {client && (
        <div className="bg-gradient-to-b from-brand-graphite to-brand-black border-b border-brand-charcoal px-4 py-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-3">
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
              <button 
                onClick={() => {
                  sessionStorage.removeItem('clientId');
                  setClientId(null);
                  navigate('/catalogo', { replace: true });
                }}
                className="text-[10px] text-brand-steel hover:text-brand-wine font-black border border-brand-charcoal rounded-lg px-2.5 py-1.5 uppercase tracking-wider transition-colors cursor-pointer"
              >
                Salir de mi cuenta
              </button>
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

      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-black/90 backdrop-blur-md border-b border-brand-charcoal px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-wine rounded-full flex items-center justify-center border border-brand-gold/30">
              <span className="text-brand-gold font-bold text-xl">{distributorName.charAt(0).toUpperCase()}</span>
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight hidden sm:block">
              {distributorName.toUpperCase()} <span className="text-brand-gold">DISTRIBUIDORA</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link to={cartUrl} className="relative p-2 text-brand-smoke hover:text-brand-gold transition-colors">
              <ShoppingCart size={24} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-wine text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-black animate-pulse">
                  {cartItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={20} />
            <input 
              type="text" 
              placeholder="Buscar productos, marcas o categorías..." 
              className="w-full input-field pl-12 py-3 text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between overflow-x-auto gap-2 py-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-bold border transition-all whitespace-nowrap",
                  !selectedCategory 
                    ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30" 
                    : "border-brand-charcoal text-brand-steel hover:border-brand-gold hover:text-brand-gold"
                )}
              >
                Todos
              </button>
              <div className="h-6 w-[1px] bg-brand-charcoal mx-1" />
              {categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-bold border transition-all whitespace-nowrap",
                    selectedCategory === cat
                      ? "bg-brand-gold/15 text-brand-gold border-brand-gold/30"
                      : "border-brand-charcoal text-brand-steel hover:border-brand-gold hover:text-brand-gold"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex bg-brand-charcoal p-1 rounded-lg shrink-0">
              <button 
                onClick={() => setViewMode('quick')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'quick' ? 'bg-brand-wine text-white' : 'text-brand-steel'
                )}
              >
                <ListIcon size={18} />
              </button>
              <button 
                onClick={() => setViewMode('visual')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'visual' ? 'bg-brand-wine text-white' : 'text-brand-steel'
                )}
              >
                <Grid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Product List - Quick Mode */}
        {viewMode === 'quick' ? (
          <div className="glass-card overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-brand-steel">No se encontraron productos.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-charcoal/50 text-brand-steel text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4 hidden md:table-cell">SKU</th>
                      <th className="px-6 py-4">Disponibilidad</th>
                      <th className="px-6 py-4">Precio / Desglose</th>
                      <th className="px-6 py-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-charcoal">
                    {filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product.stock_actual, product.units_per_box);
                      const isOutOfStock = stockStatus === 'Sin Stock';
                      const isPurchaseDisabled = isOutOfStock || (client?.status === 'Inactivo');
                      
                      return (
                        <tr key={product.id} className="table-row-hover group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <ProductImage 
                                imageUrl={product.image_url} 
                                category={product.category} 
                                className="w-10 h-10 rounded-lg flex-shrink-0" 
                              />
                              <div>
                                <div className="font-medium text-brand-white">{product.name}</div>
                                <div className="text-xs text-brand-steel">{product.presentation}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell text-sm text-brand-steel font-mono">
                            {product.sku}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                              stockStatus === 'En Stock' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                              stockStatus === 'Pocas Unidades' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                              stockStatus === 'Sin Stock' && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            )}>
                              {stockStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const { hasPack, unitPrice, packPrice, unitPriceInPack } = getProductPriceDetails(product);
                              return hasPack ? (
                                <div className="space-y-1">
                                  <div className="text-sm font-bold text-brand-gold">
                                    Pack (x{product.units_per_box}): ${packPrice.toLocaleString('es-AR')}
                                    <span className="text-[10px] text-brand-steel font-normal ml-1">(${unitPriceInPack.toLocaleString('es-AR')}/u)</span>
                                  </div>
                                  {!product.only_pack_sale && (
                                    <div className="text-xs text-brand-smoke">
                                      Unidad suelta: ${unitPrice.toLocaleString('es-AR')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm font-bold text-brand-smoke">
                                  Unidad: ${unitPrice.toLocaleString('es-AR')}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(() => {
                              const { hasPack } = getProductPriceDetails(product);
                              return (
                                <div className="flex gap-2 justify-end">
                                  {hasPack && (
                                    <button 
                                      onClick={() => handleAddToCart(product, true)}
                                      disabled={isPurchaseDisabled}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border",
                                        isPurchaseDisabled
                                          ? "bg-brand-charcoal text-brand-steel border-transparent cursor-not-allowed opacity-40"
                                          : "bg-brand-gold/15 text-brand-gold border-brand-gold/30 hover:bg-brand-gold hover:text-brand-black hover:border-transparent cursor-pointer"
                                      )}
                                    >
                                      + Pack
                                    </button>
                                  )}
                                  {(!hasPack || !product.only_pack_sale) && (
                                    <button 
                                      onClick={() => handleAddToCart(product, false)}
                                      disabled={isPurchaseDisabled}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border",
                                        isPurchaseDisabled
                                          ? "bg-brand-charcoal text-brand-steel border-transparent cursor-not-allowed opacity-40"
                                          : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-brand-wine hover:text-white hover:border-transparent cursor-pointer"
                                      )}
                                    >
                                      {hasPack ? '+ Unidad' : '+ Agregar'}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product.stock_actual, product.units_per_box);
              const isOutOfStock = stockStatus === 'Sin Stock';
              const isPurchaseDisabled = isOutOfStock || (client?.status === 'Inactivo');
              
              return (
                <div key={product.id} className="glass-card group hover:border-brand-gold/50 transition-all overflow-hidden flex flex-col">
                  <div className="aspect-square bg-brand-charcoal/50 relative overflow-hidden">
                    <ProductImage 
                      imageUrl={product.image_url} 
                      category={product.category} 
                      className="absolute inset-0 w-full h-full border-none rounded-none" 
                    />
                    <div className="absolute top-3 right-3 z-20">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border backdrop-blur-md",
                        stockStatus === 'En Stock' && "bg-emerald-500/80 text-white border-emerald-500/30",
                        stockStatus === 'Pocas Unidades' && "bg-amber-500/80 text-white border-amber-500/30",
                        stockStatus === 'Sin Stock' && "bg-rose-500/80 text-white border-rose-500/30"
                      )}>
                        {stockStatus}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-black/95 via-brand-black/30 to-transparent flex flex-col justify-end p-4 z-10">
                      <span className="text-[10px] uppercase tracking-widest text-brand-gold font-bold bg-brand-black/60 backdrop-blur-sm px-2 py-1 rounded w-fit mb-2">
                        {product.brand}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-display font-bold text-sm mb-1 leading-tight text-brand-smoke min-h-[40px]">{product.name}</h3>
                    <p className="text-xs text-brand-steel mb-4">{product.presentation}</p>
                    
                    <div className="mt-auto pt-4 border-t border-brand-charcoal/50">
                      {(() => {
                        const { hasPack, unitPrice, packPrice, unitPriceInPack } = getProductPriceDetails(product);
                        return (
                          <>
                            <div className="space-y-1.5 mb-4">
                              {hasPack ? (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-brand-steel font-bold uppercase">Pack (x{product.units_per_box})</span>
                                    <span className="text-base font-display font-extrabold text-brand-gold">${packPrice.toLocaleString('es-AR')}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] text-brand-steel">
                                    <span>Unit. en Pack</span>
                                    <span>${unitPriceInPack.toLocaleString('es-AR')}/u</span>
                                  </div>
                                  {!product.only_pack_sale && (
                                    <div className="flex justify-between items-center text-xs text-brand-smoke pt-1 border-t border-brand-charcoal/30">
                                      <span className="font-bold">Unidad Suelta</span>
                                      <span className="font-mono font-bold">${unitPrice.toLocaleString('es-AR')}</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-brand-steel font-bold uppercase">Unidad</span>
                                  <span className="text-base font-display font-extrabold text-brand-smoke">${unitPrice.toLocaleString('es-AR')}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2">
                              {hasPack && (
                                <button 
                                  onClick={() => handleAddToCart(product, true)}
                                  disabled={isPurchaseDisabled}
                                  className={cn(
                                    "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1",
                                    isPurchaseDisabled
                                      ? "bg-brand-charcoal text-brand-steel border-transparent cursor-not-allowed opacity-40"
                                      : "bg-brand-gold/10 text-brand-gold border-brand-gold/20 hover:bg-brand-gold hover:text-brand-black active:scale-95 cursor-pointer shadow-inner"
                                  )}
                                >
                                  + Pack
                                </button>
                              )}
                              {(!hasPack || !product.only_pack_sale) && (
                                <button 
                                  onClick={() => handleAddToCart(product, false)}
                                  disabled={isPurchaseDisabled}
                                  className={cn(
                                    "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1",
                                    isPurchaseDisabled
                                      ? "bg-brand-charcoal text-brand-steel border-transparent cursor-not-allowed opacity-40"
                                      : "bg-brand-wine text-white border-brand-wine hover:bg-rose-900 active:scale-95 cursor-pointer shadow-lg shadow-brand-wine/20"
                                  )}
                                >
                                  {hasPack ? '+ Unidad' : '+ Agregar'}
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Cart (Mobile) */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 sm:hidden">
          <button 
            onClick={() => navigate(cartUrl)}
            className="bg-brand-wine text-white shadow-2xl shadow-brand-wine/40 px-8 py-3 rounded-full font-bold flex items-center gap-3 active:scale-95 transition-transform"
          >
            <ShoppingCart size={20} />
            Ver Carrito (${useCartStore.getState().getTotal(priceList, looseUnitSurcharge).toLocaleString('es-AR')})
          </button>
        </div>
      )}
    </div>
  );
};

export default Catalog;
