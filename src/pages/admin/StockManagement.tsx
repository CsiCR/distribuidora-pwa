import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpRight, 
  History,
  Search,
  Warehouse,
  Plus,
  ArrowRightLeft,
  X,
  Check,
  DollarSign,
  Layers,
  Barcode,
  Info,
  RefreshCw,
  FileText,
  List,
  LayoutGrid,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { ProductImage } from '../../components/ProductImage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useStockStore } from '../../store/useStockStore';
import type { Product as StockItem, AuditLog } from '../../store/useStockStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useSettingsStore } from '../../store/useSettingsStore';

// Dynamic categories and brands are now used

const WAREHOUSES = [
  'Deposito Central',
  'Zona Norte',
  'Zona Sur',
  'Centro',
  'Periferia',
  'Interior'
];

const calculatePrice = (cost: number, iva: number, margin: number) => {
  return Math.round((cost * (1 + iva/100) * (1 + margin/100)) / 10) * 10;
};

const StockManagement: React.FC = () => {
  const { products: stockItems, auditLogs, addAuditLog, setProducts: setStockItems, updateProduct } = useStockStore();
  const { cart: terminalCart } = useTerminalStore();
  const globalLooseSurcharge = useSettingsStore(state => state.looseUnitSurcharge);

  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'global' | 'warehouse'>('warehouse');
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'income' | 'outcome'>('income');
  const [adjustmentWarehouse, setAdjustmentWarehouse] = useState<string>('');
  const [adjustmentCost, setAdjustmentCost] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [adjustmentInPacks, setAdjustmentInPacks] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      setAdjustmentInPacks(selectedItem.units_per_box > 1);
    } else {
      setAdjustmentInPacks(false);
    }
  }, [selectedItem]);

  // UI States
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  // Table Filters & Sorting
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof StockItem>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Audit Filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  const filteredAuditLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      if (!log) return false;
      const itemName = String(log.item_name || '');
      const matchesSearch = itemName.toLowerCase().includes(auditSearch.toLowerCase());
      const matchesType = auditTypeFilter === 'all' || 
                          log.type === auditTypeFilter || 
                          (auditTypeFilter === 'precio_update' && log.type === 'info_update');
      
      // Date filtering
      if (auditStartDate || auditEndDate) {
        const timestampStr = String(log.timestamp || '');
        const logDate = new Date(timestampStr.split(',')[0].split('/').reverse().join('-')); // Format: YYYY-MM-DD
        if (auditStartDate && logDate < new Date(auditStartDate)) return false;
        if (auditEndDate && logDate > new Date(auditEndDate)) return false;
      }

      return matchesSearch && matchesType;
    });
  }, [auditLogs, auditSearch, auditTypeFilter, auditStartDate, auditEndDate]);

  // Live edit states for Master Data
  const [editName, setEditName] = useState('');
  const [editLooseSurcharge, setEditLooseSurcharge] = useState<number | undefined>(undefined);
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCost, setEditCost] = useState(0);
  const [editIva, setEditIva] = useState(21);
  const [editMargins, setEditMargins] = useState({ Minorista: 30, Mayorista: 20, Distribuidor: 15 });
  const [editStockMin, setEditStockMin] = useState(0);
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editPresentation, setEditPresentation] = useState('');
  const [editUnitsPerBox, setEditUnitsPerBox] = useState(1);
  const [editStatus, setEditStatus] = useState<'activo' | 'inactivo'>('activo');
  const [editAllowOverstock, setEditAllowOverstock] = useState(false);
  const [editOnlyPackSale, setEditOnlyPackSale] = useState(false);
  const [editLongDesc, setEditLongDesc] = useState('');
  const [editNetContent, setEditNetContent] = useState<number | undefined>(undefined);
  const [editUnitMeasure, setEditUnitMeasure] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  


  const categories = useMemo(() => {
    const cats = new Set(stockItems.map(p => p.category));
    return Array.from(cats).sort();
  }, [stockItems]);

  const brands = useMemo(() => {
    const b = new Set(stockItems.map(p => p.brand));
    return Array.from(b).sort();
  }, [stockItems]);

  const handleUpdateStock = () => {
    if (!selectedItem || adjustmentValue <= 0) return;
    const qtyMultiplier = (adjustmentInPacks && selectedItem.units_per_box > 1) ? selectedItem.units_per_box : 1;
    const finalQty = adjustmentValue * qtyMultiplier;
    const change = adjustmentType === 'income' ? finalQty : -finalQty;
    const targetWarehouse = adjustmentWarehouse || selectedItem.warehouse;
    
    let finalCostToApply = selectedItem.cost_price;
    if (adjustmentType === 'income' && adjustmentCost !== null && adjustmentCost !== selectedItem.cost_price) {
      if (window.confirm(`Has modificado el costo de $${selectedItem.cost_price} a $${adjustmentCost}.\n\nSi aceptas, se actualizarán automáticamente los precios de venta en todos los depósitos para este producto.\n\n¿Deseas aplicar este nuevo costo? (Cancelar mantendrá el costo anterior)`)) {
        finalCostToApply = adjustmentCost;
      }
    }

    const existingProduct = stockItems.find(i => 
      (i.sku === selectedItem.sku || (i.barcode && i.barcode === selectedItem.barcode)) && 
      i.warehouse === targetWarehouse
    );

    if (!existingProduct && adjustmentType === 'outcome') {
      alert("No se puede hacer egreso de un depósito sin stock de este producto.");
      return;
    }

    setStockItems(prev => {
      let next = [...prev];

      // Update cost and prices for ALL items with the same SKU
      if (finalCostToApply !== selectedItem.cost_price) {
        next = next.map(item => {
          if (item.sku === selectedItem.sku || (item.barcode && item.barcode === selectedItem.barcode)) {
            const margins = item.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 };
            return {
              ...item,
              cost_price: finalCostToApply,
              prices: {
                Minorista: calculatePrice(finalCostToApply, item.iva_rate, margins.Minorista),
                Mayorista: calculatePrice(finalCostToApply, item.iva_rate, margins.Mayorista),
                Distribuidor: calculatePrice(finalCostToApply, item.iva_rate, margins.Distribuidor)
              }
            };
          }
          return item;
        });
      }

      // Add new item if new warehouse
      if (!existingProduct) {
        const margins = selectedItem.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 };
        const newItem: StockItem = {
          ...selectedItem,
          id: Math.random().toString(36).substr(2, 9),
          warehouse: targetWarehouse,
          stock_actual: change,
          stock_reservado: 0,
          cost_price: finalCostToApply,
          prices: {
            Minorista: calculatePrice(finalCostToApply, selectedItem.iva_rate, margins.Minorista),
            Mayorista: calculatePrice(finalCostToApply, selectedItem.iva_rate, margins.Mayorista),
            Distribuidor: calculatePrice(finalCostToApply, selectedItem.iva_rate, margins.Distribuidor)
          },
          last_update: new Date().toLocaleString()
        };
        next.push(newItem);
      } else {
        // Update stock of existing item
        next = next.map(item => {
          if (item.id === existingProduct.id) {
            return { ...item, stock_actual: item.stock_actual + change, last_update: new Date().toLocaleString() };
          }
          return item;
        });
      }

      return next;
    });

    const auditReason = reason 
      ? reason + (adjustmentInPacks && selectedItem.units_per_box > 1 ? ` (${adjustmentValue} Pack/s)` : '')
      : (adjustmentInPacks && selectedItem.units_per_box > 1 ? `Ajuste manual (${adjustmentValue} Pack/s)` : 'Ajuste manual');

    const newLogs: AuditLog[] = [{ 
      id: Math.random().toString(36).substr(2, 9), 
      item_name: selectedItem.name, 
      type: adjustmentType === 'income' ? 'ingreso' : 'egreso', 
      quantity: finalQty, 
      warehouse_dest: targetWarehouse, 
      reason: auditReason, 
      timestamp: new Date().toLocaleString(), 
      user: 'Admin' 
    }];

    if (finalCostToApply !== selectedItem.cost_price) {
      newLogs.push({
        id: Math.random().toString(36).substr(2, 9),
        item_name: selectedItem.name,
        type: 'precio_update',
        old_value: selectedItem.cost_price,
        new_value: finalCostToApply,
        reason: 'Actualización de Costo durante Ingreso de Stock',
        timestamp: new Date().toLocaleString(),
        user: 'Admin'
      });
    }

    newLogs.forEach(log => addAuditLog(log));
    setIsModalOpen(false); setAdjustmentValue(0); setReason(''); setSelectedItem(null); setAdjustmentWarehouse(''); setAdjustmentCost(null);
  };

  const filteredItems = useMemo(() => {
    return (stockItems || []).filter(item => {
      if (!item) return false;
      const name = String(item.name || '');
      const sku = String(item.sku || '');
      const barcode = String(item.barcode || '');
      
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           barcode.includes(searchTerm);
      const matchesWarehouse = warehouseFilter === 'all' || item.warehouse === warehouseFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchesSearch && matchesWarehouse && matchesStatus && matchesBrand && matchesCategory;
    });
  }, [stockItems, searchTerm, warehouseFilter, statusFilter, brandFilter, categoryFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredItems, sortField, sortDirection]);

  const displayItems = useMemo(() => {
    if (viewMode === 'warehouse') return sortedItems;
    const grouped = sortedItems.reduce((acc, item) => {
      const existing = acc.find(i => i.sku === item.sku);
      if (existing) {
        existing.stock_actual += item.stock_actual;
        existing.stock_reservado += item.stock_reservado;
      } else {
        acc.push({ ...item, warehouse: 'GLOBAL' });
      }
      return acc;
    }, [] as StockItem[]);
    return grouped;
  }, [sortedItems, viewMode]);

  const handleSort = (field: keyof StockItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-smoke uppercase tracking-tight">Stock Maestro</h1>
          <p className="text-brand-steel text-sm font-medium">Gestión integral de productos y logística</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAuditOpen(true)} className="btn-secondary py-2 px-4 flex items-center gap-2 relative">
            <History size={18} /> Auditoría
            {auditLogs.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-gold text-brand-black text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">{auditLogs.length}</span>}
          </button>
          <button onClick={() => setIsBulkModalOpen(true)} className="btn-secondary py-2 px-4 flex items-center gap-2"><Layers size={18} /> Act. Masiva</button>
          <button onClick={() => { setAdjustmentType('income'); setSelectedItem(null); setIsModalOpen(true); }} className="btn-gold py-2 px-6 flex items-center gap-2 font-bold"><Plus size={18} /> Ingreso de Mercadería</button>
        </div>
      </div>

      <div className="glass-card p-4 mb-8 flex flex-col gap-4 border-brand-charcoal">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-steel" size={20} />
            <input type="text" placeholder="Buscar por Nombre, SKU o Código de Barras..." className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-12 pr-4 py-3 text-brand-smoke focus:border-brand-gold outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex bg-brand-charcoal p-1 rounded-xl">
            <button 
              onClick={() => setLayoutMode('list')}
              className={cn("p-2 rounded-lg transition-all", layoutMode === 'list' ? "bg-brand-wine/80 text-white shadow-inner" : "text-brand-steel hover:text-white")}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setLayoutMode('grid')}
              className={cn("p-2 rounded-lg transition-all", layoutMode === 'grid' ? "bg-brand-wine/80 text-white shadow-inner" : "text-brand-steel hover:text-white")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <div className="flex gap-2 bg-brand-black/50 p-1 rounded-xl border border-brand-charcoal h-fit">
            <button onClick={() => setViewMode('warehouse')} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", viewMode === 'warehouse' ? "bg-brand-wine text-white shadow-lg" : "text-brand-steel hover:text-white")}>Por Depósito</button>
            <button onClick={() => setViewMode('global')} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", viewMode === 'global' ? "bg-brand-wine text-white shadow-lg" : "text-brand-steel hover:text-white")}>Vista Global</button>
          </div>
          <button onClick={() => setIsTransferModalOpen(true)} className="btn-secondary py-3 px-6 flex items-center gap-2 font-bold whitespace-nowrap"><ArrowRightLeft size={18} /> Transferir</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-brand-charcoal/50">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-brand-gold px-1 tracking-widest">Depósito</label>
            <select className="bg-brand-black border-2 border-brand-charcoal rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-brand-gold transition-all shadow-lg" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
              <option value="all">📍 Todos los Depósitos</option>
              {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-brand-gold px-1 tracking-widest">Estado</label>
            <select 
              className="bg-brand-black border-2 border-brand-charcoal rounded-xl px-4 py-2.5 text-xs text-white font-bold outline-none focus:border-brand-gold shadow-lg"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">⚡ Todos los Estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-brand-gold px-1 tracking-widest">Marca</label>
            <select className="bg-brand-black border-2 border-brand-charcoal rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-brand-gold transition-all shadow-lg" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="all">🏷️ Todas las Marcas</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase font-bold text-brand-gold px-1 tracking-widest">Categoría</label>
            <select className="bg-brand-black border-2 border-brand-charcoal rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none focus:border-brand-gold transition-all shadow-lg" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">📦 Todas las Categorías</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden border border-brand-charcoal shadow-2xl p-0">
        <div>
          {layoutMode === 'list' ? (
            <>
              {/* Mobile/Tablet view: list cards */}
              <div className="block lg:hidden bg-brand-black/20 p-3 sm:p-4">
                {displayItems.length === 0 ? (
                  <div className="p-6 text-center text-brand-steel">No se encontraron productos.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayItems.map((item) => {
                      const inTerminalCart = (Array.isArray(terminalCart) ? terminalCart : []).find(c => c?.product?.id === item.id)?.quantity || 0;
                      const stock_disponible = item.stock_actual - item.stock_reservado - inTerminalCart;
                      const isLow = viewMode === 'global' && item.stock_actual < item.stock_minimo;
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "glass-card p-4 space-y-3 flex flex-col justify-between border-brand-charcoal/40 bg-brand-charcoal/10 relative",
                            selectedIds.includes(item.id) ? "border-brand-wine bg-brand-wine/5" : "border-brand-charcoal/40",
                            item.status === 'inactivo' && "opacity-50 grayscale"
                          )}
                        >
                          {/* Checkbox */}
                          <div className="absolute top-4 right-4 z-10">
                            <input 
                              type="checkbox" 
                              className="rounded-md border-brand-charcoal bg-brand-black w-4 h-4 cursor-pointer" 
                              checked={selectedIds.includes(item.id)} 
                              onChange={() => selectedIds.includes(item.id) ? setSelectedIds(selectedIds.filter(id => id !== item.id)) : setSelectedIds([...selectedIds, item.id])} 
                            />
                          </div>

                          <div className="space-y-3 pr-6">
                            <div>
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                <span className="text-[8px] px-1 bg-brand-charcoal rounded text-brand-steel uppercase font-bold">{item.brand}</span>
                                <span className="text-[8px] px-1 bg-brand-gold/10 rounded text-brand-gold uppercase font-bold">{item.category}</span>
                              </div>
                              <h4 className="font-display font-bold text-sm text-brand-smoke truncate max-w-[200px]" title={item.name}>
                                {item.short_description || item.name}
                              </h4>
                              <p className="text-[10px] text-brand-steel font-mono font-medium">SKU: {item.sku}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="text-brand-steel space-y-1">
                                <p className="text-[10px]">Físico: <span className={cn("font-bold", isLow ? "text-rose-400" : "text-brand-smoke")}>{item.stock_actual}</span></p>
                                <p className="text-[10px]">Disponible: <span className="font-bold text-brand-gold">{stock_disponible}</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-brand-steel font-medium">Minorista</p>
                                <p className="font-mono font-bold text-brand-gold text-sm">${item.prices.Minorista.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-brand-charcoal/20 mt-auto">
                            <button 
                              onClick={() => { 
                                setSelectedItem(item); 
                                setEditName(item.name || '');
                                setEditShortDesc(item.short_description || '');
                                setEditSku(item.sku || '');
                                setEditBarcode(item.barcode || '');
                                setEditBrand(item.brand || '');
                                setEditCategory(item.category || '');
                                setEditCost(item.cost_price || 0);
                                setEditIva(item.iva_rate || 21);
                                setEditMargins(item.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 });
                                setEditStockMin(item.stock_minimo || 0);
                                setEditSubcategory(item.subcategory || '');
                                setEditPresentation(item.presentation || '');
                                setEditUnitsPerBox(item.units_per_box || 1);
                                setEditStatus(item.status || 'activo');
                                setEditAllowOverstock(item.allow_overstock || false);
                                setEditOnlyPackSale(item.only_pack_sale || false);
                                setEditLongDesc(item.long_description || '');
                                setEditNetContent(item.net_content || undefined);
                                setEditUnitMeasure(item.unit_measure || '');
                                setEditObservations(item.observations || '');
                                setEditImageUrl(item.image_url || '');
                                setEditLooseSurcharge(item.loose_surcharge);
                                setIsEditModalOpen(true); 
                              }}
                              className="flex-1 py-2 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Info size={12} className="text-brand-gold" /> Ficha
                            </button>
                            <button 
                              onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                              className="flex-1 py-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/20 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus size={12} /> Stock
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Desktop view: standard table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-brand-charcoal/50 text-brand-steel text-[10px] uppercase tracking-widest font-black border-b border-brand-charcoal">
                    <tr>
                      <th className="px-6 py-5 w-10 text-center"><input type="checkbox" className="rounded-md border-brand-charcoal bg-brand-black w-4 h-4" onChange={(e) => e.target.checked ? setSelectedIds(displayItems.map(i => i.id)) : setSelectedIds([])} checked={selectedIds.length === displayItems.length && displayItems.length > 0} /></th>
                      <th className="px-6 py-5 cursor-pointer hover:text-brand-gold transition-colors" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-2">Producto {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-5 text-center cursor-pointer hover:text-brand-gold transition-colors" onClick={() => handleSort('sku')}>
                        <div className="flex items-center justify-center gap-2">Referencia {sortField === 'sku' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                      </th>
                      {viewMode === 'warehouse' && <th className="px-6 py-5 text-center">Ubicación</th>}
                      <th className="px-6 py-5 text-center">Listas (Min / May / Dis)</th>
                      <th className="px-6 py-5 text-center cursor-pointer hover:text-brand-gold transition-colors" onClick={() => handleSort('stock_actual')}>
                        <div className="flex items-center justify-center gap-2">Físico {sortField === 'stock_actual' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-5 text-center">Disponible</th>
                      <th className="px-6 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-charcoal">
                    {displayItems.map((item) => {
                      const inTerminalCart = (Array.isArray(terminalCart) ? terminalCart : []).find(c => c?.product?.id === item.id)?.quantity || 0;
                      const stock_disponible = item.stock_actual - item.stock_reservado - inTerminalCart;
                      const isLow = viewMode === 'global' && item.stock_actual < item.stock_minimo;
                      return (
                        <tr key={item.id} className={cn("table-row-hover group transition-colors", selectedIds.includes(item.id) && "bg-brand-wine/5 border-l-4 border-brand-wine", item.status === 'inactivo' && "opacity-50 grayscale bg-brand-black/20")}>
                          <td className="px-6 py-5 text-center"><input type="checkbox" className="rounded-md border-brand-charcoal bg-brand-black w-4 h-4" checked={selectedIds.includes(item.id)} onChange={() => selectedIds.includes(item.id) ? setSelectedIds(selectedIds.filter(id => id !== item.id)) : setSelectedIds([...selectedIds, item.id])} /></td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <ProductImage imageUrl={item.image_url} category={item.category} className="w-10 h-10 rounded-lg flex-shrink-0" />
                              <div>
                                <div className="font-bold text-brand-smoke text-base leading-tight">
                                  {item.short_description || item.name} 
                                  {item.status === 'inactivo' && <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded ml-2 uppercase font-black">Inactivo</span>}
                                </div>
                                <div className="flex gap-2 mt-1.5">
                                  <span className="text-[9px] px-1.5 py-0.5 bg-brand-charcoal rounded font-bold text-brand-steel border border-brand-charcoal uppercase">{item.brand}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 bg-brand-gold/10 rounded font-bold text-brand-gold border border-brand-gold/20 uppercase">{item.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="text-xs font-mono font-bold text-brand-steel">{item.sku}</div>
                            <div className="text-[9px] text-brand-steel/50 mt-0.5 flex items-center justify-center gap-1"><Barcode size={10} /> {item.barcode || 'SIN BARRAS'}</div>
                          </td>
                          {viewMode === 'warehouse' && (
                            <td className="px-6 py-5 text-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-black/40 rounded-full text-[10px] font-bold text-brand-smoke border border-brand-charcoal"><Warehouse size={12} className="text-brand-gold" /> {item.warehouse}</span>
                            </td>
                          )}
                          <td className="px-6 py-5 text-center min-w-[200px]">
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-center bg-brand-black/40 px-2 py-1 rounded border border-brand-charcoal">
                                 <span className="text-[8px] font-black text-brand-steel uppercase tracking-tighter">Min</span>
                                 <span className="text-sm font-display font-black text-brand-gold">${item.prices.Minorista.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center opacity-60">
                                 <span className="text-[8px] font-black text-brand-steel uppercase tracking-tighter">May</span>
                                 <span className="text-xs font-bold text-brand-smoke">${item.prices.Mayorista.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center opacity-40">
                                 <span className="text-[8px] font-black text-brand-steel uppercase tracking-tighter">Dis</span>
                                 <span className="text-xs font-bold text-brand-smoke">${item.prices.Distribuidor.toLocaleString()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center font-bold">
                            <span className={cn("text-base", isLow ? "text-rose-500 font-black animate-pulse" : "text-brand-smoke")}>{item.stock_actual}</span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="text-xl font-display font-black text-brand-gold">{stock_disponible}</div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => { 
                                  setSelectedItem(item); 
                                  setEditName(item.name || '');
                                  setEditShortDesc(item.short_description || '');
                                  setEditSku(item.sku || '');
                                  setEditBarcode(item.barcode || '');
                                  setEditBrand(item.brand || '');
                                  setEditCategory(item.category || '');
                                  setEditCost(item.cost_price || 0);
                                  setEditIva(item.iva_rate || 21);
                                  setEditMargins(item.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 });
                                  setEditStockMin(item.stock_minimo || 0);
                                  setEditSubcategory(item.subcategory || '');
                                  setEditPresentation(item.presentation || '');
                                  setEditUnitsPerBox(item.units_per_box || 1);
                                  setEditStatus(item.status || 'activo');
                                  setEditOnlyPackSale(item.only_pack_sale || false);
                                  setEditAllowOverstock(item.allow_overstock || false);
                                  setEditLongDesc(item.long_description || '');
                                  setEditNetContent(item.net_content || undefined);
                                  setEditUnitMeasure(item.unit_measure || '');
                                  setEditObservations(item.observations || '');
                                  setEditImageUrl(item.image_url || '');
                                  setEditLooseSurcharge(item.loose_surcharge);
                                  setIsEditModalOpen(true); 
                                }} 
                                className="p-2.5 bg-brand-charcoal/50 hover:bg-brand-charcoal rounded-xl text-brand-steel hover:text-white transition-all shadow-sm"
                                title="Ficha Maestra"
                              >
                                <Info size={16} />
                              </button>
                              <button onClick={() => { setSelectedItem(item); setIsModalOpen(true); }} className="p-2.5 bg-brand-gold/10 hover:bg-brand-gold text-brand-gold hover:text-white rounded-xl transition-all shadow-sm" title="Ingreso/Egreso">
                                <Plus size={20} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-brand-black/20">
              {displayItems.map((item) => {
                const inTerminalCart = (Array.isArray(terminalCart) ? terminalCart : []).find(c => c?.product?.id === item.id)?.quantity || 0;
                const stock_disponible = item.stock_actual - item.stock_reservado - inTerminalCart;
                const isLow = viewMode === 'global' && item.stock_actual < item.stock_minimo;
                
                return (
                  <div key={item.id} className={cn("bg-brand-charcoal/30 border rounded-xl overflow-hidden flex flex-col justify-between hover:border-brand-gold/50 transition-colors group relative", selectedIds.includes(item.id) ? "border-brand-wine bg-brand-wine/5" : "border-brand-charcoal", item.status === 'inactivo' && "opacity-50 grayscale")}>
                    
                    {/* Checkbox */}
                    <div className="absolute top-4 right-4 z-10">
                      <input type="checkbox" className="rounded-md border-brand-charcoal bg-brand-black w-4 h-4 cursor-pointer" checked={selectedIds.includes(item.id)} onChange={() => selectedIds.includes(item.id) ? setSelectedIds(selectedIds.filter(id => id !== item.id)) : setSelectedIds([...selectedIds, item.id])} />
                    </div>

                    {/* Product Image header */}
                    <div className="w-full h-32 relative bg-brand-black/20 border-b border-brand-charcoal/30">
                      <ProductImage imageUrl={item.image_url} category={item.category} className="w-full h-full object-cover" />
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2 items-center mb-2 pr-6">
                          <span className="text-[10px] px-1.5 py-0.5 bg-brand-charcoal rounded font-bold text-brand-steel border border-brand-charcoal uppercase">{item.brand}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-brand-gold/10 rounded font-bold text-brand-gold border border-brand-gold/20 uppercase">{item.category}</span>
                          {viewMode === 'warehouse' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-black/40 rounded text-[9px] font-bold text-brand-smoke border border-brand-charcoal uppercase"><Warehouse size={10} className="text-brand-gold" /> {item.warehouse}</span>
                          )}
                          {item.status === 'inactivo' && <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase font-black">Inactivo</span>}
                        </div>
                        
                        <h4 className="font-bold text-brand-smoke group-hover:text-brand-gold transition-colors leading-tight mb-1">{item.short_description || item.name}</h4>
                        <div className="text-xs font-mono font-bold text-brand-steel flex items-center gap-2">
                          {item.sku} <span className="text-[9px] text-brand-steel/50 flex items-center gap-1"><Barcode size={10} /> {item.barcode || 'S/B'}</span>
                        </div>
                      </div>
                    
                    <div className="mt-4 pt-4 border-t border-brand-charcoal/50 grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-[9px] font-black text-brand-steel uppercase tracking-widest mb-1">Stock Físico</p>
                         <p className={cn("text-xl font-display font-black", isLow ? "text-rose-500 animate-pulse" : "text-brand-smoke")}>{item.stock_actual}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-brand-steel uppercase tracking-widest mb-1">Disponible</p>
                         <p className="text-xl font-display font-black text-brand-gold">{stock_disponible}</p>
                      </div>
                    </div>

                    <div className="mt-3 bg-brand-black/40 rounded border border-brand-charcoal p-2 flex justify-between items-center">
                       <div>
                         <span className="text-[8px] font-black text-brand-steel uppercase tracking-tighter block mb-0.5">Precio Min.</span>
                         <span className="text-sm font-display font-black text-brand-smoke">${item.prices.Minorista.toLocaleString()}</span>
                       </div>
                       <div className="flex gap-1">
                          <button 
                            onClick={() => { 
                              setSelectedItem(item); 
                              setEditName(item.name || '');
                              setEditShortDesc(item.short_description || '');
                              setEditSku(item.sku || '');
                              setEditBarcode(item.barcode || '');
                              setEditBrand(item.brand || '');
                              setEditCategory(item.category || '');
                              setEditCost(item.cost_price || 0);
                              setEditIva(item.iva_rate || 21);
                              setEditMargins(item.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 });
                              setEditStockMin(item.stock_minimo || 0);
                              setEditSubcategory(item.subcategory || '');
                              setEditPresentation(item.presentation || '');
                              setEditUnitsPerBox(item.units_per_box || 1);
                              setEditStatus(item.status || 'activo');
                              setEditOnlyPackSale(item.only_pack_sale || false);
                              setEditAllowOverstock(item.allow_overstock || false);
                              setEditLongDesc(item.long_description || '');
                              setEditNetContent(item.net_content || undefined);
                              setEditUnitMeasure(item.unit_measure || '');
                              setEditObservations(item.observations || '');
                              setEditImageUrl(item.image_url || '');
                              setEditLooseSurcharge(item.loose_surcharge);
                              setIsEditModalOpen(true); 
                            }} 
                            className="p-2 bg-brand-charcoal/50 hover:bg-brand-charcoal rounded-lg text-brand-steel hover:text-white transition-all shadow-sm"
                            title="Ficha Maestra"
                          >
                            <Info size={14} />
                          </button>
                          <button onClick={() => { setSelectedItem(item); setIsModalOpen(true); }} className="p-2 bg-brand-gold/10 hover:bg-brand-gold text-brand-gold hover:text-white rounded-lg transition-all shadow-sm" title="Ingreso/Egreso">
                            <Plus size={16} />
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

      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/90 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)} />
          <div className="glass-card w-full max-w-2xl p-0 relative z-10 border-brand-gold/30 shadow-[0_0_50px_rgba(184,134,11,0.2)] overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
            <div className="bg-brand-gold/10 px-8 py-6 border-b border-brand-gold/20 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-display font-black text-brand-gold flex items-center gap-3"><Info size={24} /> FICHA MAESTRA</h3>
                  <div className="flex bg-brand-black/50 rounded-lg p-1 border border-brand-charcoal">
                    <button 
                      type="button"
                      onClick={() => setEditStatus('activo')}
                      className={cn("px-3 py-1 rounded text-[10px] font-black uppercase transition-all", editStatus === 'activo' ? "bg-emerald-500 text-white shadow-lg" : "text-brand-steel hover:text-brand-smoke")}
                    >
                      Activo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditStatus('inactivo')}
                      className={cn("px-3 py-1 rounded text-[10px] font-black uppercase transition-all", editStatus === 'inactivo' ? "bg-rose-500 text-white shadow-lg" : "text-brand-steel hover:text-brand-smoke")}
                    >
                      Inactivo
                    </button>
                  </div>
                </div>
                <p className="text-brand-steel text-[10px] font-bold uppercase tracking-widest mt-1">Modificando Registro Principal</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors"><X size={28} /></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const prices = {
                Minorista: calculatePrice(editCost, editIva, editMargins.Minorista),
                Mayorista: calculatePrice(editCost, editIva, editMargins.Mayorista),
                Distribuidor: calculatePrice(editCost, editIva, editMargins.Distribuidor)
              };
              
              updateProduct(selectedItem.id, { 
                name: editName, 
                short_description: editShortDesc, 
                sku: editSku, 
                barcode: editBarcode, 
                brand: editBrand, 
                category: editCategory, 
                cost_price: editCost, 
                iva_rate: editIva, 
                margins: editMargins,
                prices,
                stock_minimo: editStockMin,
                subcategory: editSubcategory,
                presentation: editPresentation,
                units_per_box: editUnitsPerBox,
                status: editStatus,
                allow_overstock: editAllowOverstock,
                only_pack_sale: editUnitsPerBox > 1 ? editOnlyPackSale : false,
                long_description: editLongDesc,
                net_content: editNetContent,
                unit_measure: editUnitMeasure,
                observations: editObservations,
                image_url: editImageUrl,
                loose_surcharge: editUnitsPerBox > 1 ? editLooseSurcharge : undefined
              });

              if (editCost !== selectedItem.cost_price) {
                addAuditLog({
                  id: Math.random().toString(36).substr(2,9),
                  item_name: editName,
                  type: 'precio_update',
                  old_value: selectedItem.cost_price,
                  new_value: editCost,
                  reason: 'Actualización de costo desde Ficha Maestra',
                  timestamp: new Date().toLocaleString(),
                  user: 'Admin'
                });
              }

              const changes: string[] = [];
              if (editName !== selectedItem.name) changes.push(`Nombre`);
              if (editShortDesc !== selectedItem.short_description) changes.push(`Nombre Corto`);
              if (editSku !== selectedItem.sku) changes.push(`SKU`);
              if (editBarcode !== selectedItem.barcode) changes.push(`Cód. Barras`);
              if (editBrand !== selectedItem.brand) changes.push(`Marca (${selectedItem.brand || '-'} -> ${editBrand})`);
              if (editCategory !== selectedItem.category) changes.push(`Categoría (${selectedItem.category || '-'} -> ${editCategory})`);
              if (editStockMin !== selectedItem.stock_minimo) changes.push(`Stock Mín. (${selectedItem.stock_minimo || 0} -> ${editStockMin})`);
              if (editStatus !== selectedItem.status) changes.push(`Estado (${selectedItem.status} -> ${editStatus})`);
              if (editAllowOverstock !== selectedItem.allow_overstock) changes.push(`Sobrestock (${selectedItem.allow_overstock ? 'Sí' : 'No'} -> ${editAllowOverstock ? 'Sí' : 'No'})`);
              if (editOnlyPackSale !== selectedItem.only_pack_sale) changes.push(`Venta Sólo Pack (${selectedItem.only_pack_sale ? 'Sí' : 'No'} -> ${editOnlyPackSale ? 'Sí' : 'No'})`);
              if (editIva !== selectedItem.iva_rate) changes.push(`IVA (${selectedItem.iva_rate}% -> ${editIva}%)`);
              if (JSON.stringify(editMargins) !== JSON.stringify(selectedItem.margins)) changes.push(`Márgenes`);
              if (editLooseSurcharge !== selectedItem.loose_surcharge) changes.push(`Recargo Unidad Suelta (${selectedItem.loose_surcharge || 0}% -> ${editLooseSurcharge || 0}%)`);

              if (changes.length > 0) {
                addAuditLog({
                  id: Math.random().toString(36).substr(2,9),
                  item_name: editName,
                  type: 'info_update',
                  reason: `Actualización: ${changes.join(', ')}`,
                  timestamp: new Date().toLocaleString(),
                  user: 'Admin'
                });
              } else if (editCost === selectedItem.cost_price) {
                addAuditLog({
                  id: Math.random().toString(36).substr(2,9),
                  item_name: editName,
                  type: 'info_update',
                  reason: 'Actualización Ficha Maestra (Sin cambios)',
                  timestamp: new Date().toLocaleString(),
                  user: 'Admin'
                });
              }
              setIsEditModalOpen(false);
            }} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Sección de Imagen de Ficha Técnica */}
              <div className="bg-brand-charcoal/20 border border-brand-charcoal/50 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border border-brand-charcoal bg-brand-black/50 flex-shrink-0 relative group">
                  <ProductImage imageUrl={editImageUrl} category={editCategory} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 w-full space-y-3">
                  <h4 className="text-[10px] font-black text-brand-gold uppercase tracking-widest flex items-center gap-1.5"><ImageIcon size={14} /> Imagen de Ficha Técnica</h4>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      placeholder="Pegar URL de la imagen del producto..."
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      className="flex-1 w-full bg-brand-black/50 border border-brand-charcoal rounded-xl px-4 py-2 text-xs text-brand-smoke focus:border-brand-gold outline-none transition-all"
                    />
                    
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const cat = editCategory.toLowerCase();
                          let mockUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400';
                          if (cat.includes('cerveza')) mockUrl = 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=400';
                          else if (cat.match(/bebida|gaseosa|jugo/)) mockUrl = 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400';
                          else if (cat.match(/librería|libreria|papel/)) mockUrl = 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400';
                          else if (cat.includes('limpieza')) mockUrl = 'https://images.unsplash.com/photo-1585421514738-ee1a3b2e5fe2?w=400';
                          
                          setEditImageUrl(mockUrl);
                          alert(`Se sugirió una foto web para "${editName}".`);
                        }}
                        className="bg-brand-wine/40 border border-brand-wine/50 hover:bg-brand-wine text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                      >
                        🔍 Buscar Web
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          const cat = editCategory.toLowerCase();
                          let mockUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400';
                          if (cat.includes('cerveza')) mockUrl = 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=400';
                          else if (cat.match(/bebida|gaseosa|jugo/)) mockUrl = 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400';
                          else if (cat.match(/librería|libreria|papel/)) mockUrl = 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400';
                          else if (cat.includes('limpieza')) mockUrl = 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400';
                          
                          setEditImageUrl(mockUrl);
                          alert("Archivo local cargado con éxito (Simulado).");
                        }}
                        className="bg-brand-gold/10 border border-brand-gold/20 hover:bg-brand-gold hover:text-brand-black text-brand-gold px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                      >
                        📁 Subir Foto
                      </button>

                      {editImageUrl && (
                        <button 
                          type="button"
                          onClick={() => setEditImageUrl('')}
                          className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white p-2 rounded-xl text-xs transition-all cursor-pointer"
                          title="Eliminar imagen"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-steel uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-brand-gold" /> Información Base</h4>
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Nombre Técnico (Largo)</label>
                    <input className="w-full input-field text-xs font-bold" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Nombre Comercial (Corto)</label>
                    <input className="w-full input-field text-xs bg-brand-gold/5" value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value)} placeholder="Ej: Corona 710ml" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Marca</label>
                      <input className="w-full input-field text-xs" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Categoría</label>
                      <select className="w-full input-field text-xs" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                        <option value="" disabled>Seleccionar...</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">SKU (Interno)</label>
                    <input className="w-full input-field text-xs font-mono" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-steel uppercase tracking-widest flex items-center gap-2"><Barcode size={14} className="text-brand-gold" /> Logística y Escáner</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Subcategoría</label>
                        <input className="w-full input-field text-xs" value={editSubcategory} onChange={(e) => setEditSubcategory(e.target.value)} placeholder="Ej: Importadas..." />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Stock Mínimo</label>
                        <input type="number" className="w-full input-field text-xs" value={editStockMin} onChange={(e) => setEditStockMin(Number(e.target.value))} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Contenido Neto / Medida</label>
                      <div className="flex gap-1">
                        <input type="number" className="flex-1 input-field text-xs" value={editNetContent || ''} onChange={(e) => setEditNetContent(Number(e.target.value))} placeholder="Ej: 750" />
                        <input className="w-20 input-field text-xs text-center bg-brand-gold/5" value={editUnitMeasure} onChange={(e) => setEditUnitMeasure(e.target.value)} placeholder="ml, kg, etc" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Código de Barras (EAN/UPC)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input className="w-full input-field pl-10 text-xs font-mono" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} placeholder="Esperando escaneo..." />
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={16} />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditBarcode(`INT-${editSku || Math.random().toString(36).substr(2, 5).toUpperCase()}`)}
                        className="bg-brand-charcoal hover:bg-brand-smoke p-3 rounded-xl transition-colors text-brand-gold"
                        title="Generar Código Interno"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[40%_30%_30%] gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Presentación</label>
                      <input className="w-full input-field text-xs" value={editPresentation} onChange={(e) => setEditPresentation(e.target.value)} placeholder="Ej: Botella, Caja, Pack" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">U. por Bulto</label>
                      <input type="number" className="w-full input-field text-xs" value={editUnitsPerBox} onChange={(e) => setEditUnitsPerBox(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Recargo Suelto %</label>
                      <input 
                        type="number" 
                        className="w-full input-field text-xs disabled:opacity-50 disabled:cursor-not-allowed" 
                        value={editLooseSurcharge !== undefined ? editLooseSurcharge : ''} 
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          setEditLooseSurcharge(val);
                        }} 
                        disabled={editUnitsPerBox <= 1}
                        placeholder={editUnitsPerBox <= 1 ? 'N/A' : `${globalLooseSurcharge}% (Sist)`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-brand-black/40 p-3 rounded-xl border border-brand-charcoal">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-brand-smoke uppercase">Permite Venta sin Stock</p>
                      <p className="text-[8px] text-brand-steel italic">Activa sobrestock para este producto</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditAllowOverstock(!editAllowOverstock)}
                      className={cn(
                        "w-12 h-6 rounded-full p-1 transition-all duration-300",
                        editAllowOverstock ? "bg-brand-gold" : "bg-brand-charcoal"
                      )}
                    >
                      <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", editAllowOverstock ? "translate-x-6" : "translate-x-0")} />
                    </button>
                  </div>
                  {editUnitsPerBox > 1 && (
                     <div className="flex items-center gap-4 bg-brand-black/40 p-3 rounded-xl border border-brand-charcoal animate-in fade-in duration-200">
                       <div className="flex-1">
                         <p className="text-[10px] font-bold text-brand-smoke uppercase">Vender sólo por pack cerrado</p>
                         <p className="text-[8px] text-brand-steel italic">Deshabilita la venta por unidad suelta</p>
                       </div>
                       <button 
                         type="button"
                         onClick={() => setEditOnlyPackSale(!editOnlyPackSale)}
                         className={cn(
                           "w-12 h-6 rounded-full p-1 transition-all duration-300",
                           editOnlyPackSale ? "bg-brand-wine" : "bg-brand-charcoal"
                         )}
                       >
                         <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", editOnlyPackSale ? "translate-x-6" : "translate-x-0")} />
                       </button>
                     </div>
                   )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-brand-charcoal">
                <h4 className="text-[10px] font-black text-brand-steel uppercase tracking-widest flex items-center gap-2"><DollarSign size={14} className="text-brand-gold" /> Estructura de Precios</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Costo Neto</label>
                    <div className="relative">
                      <input type="number" className="w-full input-field pl-8 font-bold text-sm" value={editCost} onChange={(e) => setEditCost(Number(e.target.value))} />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel">$</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">IVA Aplicable</label>
                    <select className="w-full input-field text-xs" value={editIva} onChange={(e) => setEditIva(Number(e.target.value))}>
                      <option value={21}>21% (Básico)</option>
                      <option value={10.5}>10.5% (Reducido)</option>
                      <option value={0}>0% (Exento)</option>
                    </select>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    {['Minorista', 'Mayorista', 'Distribuidor'].map((tier) => (
                      <div key={tier}>
                        <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block">Mgn {tier.slice(0,3)}%</label>
                        <input 
                          type="number" 
                          className="w-full input-field text-xs font-bold text-brand-gold" 
                          value={editMargins[tier as keyof typeof editMargins]} 
                          onChange={(e) => setEditMargins({...editMargins, [tier]: Number(e.target.value)})} 
                        />
                      </div>
                    ))}
                  </div>

                  <div className="md:col-span-4 bg-brand-black/40 p-4 rounded-xl border border-brand-charcoal overflow-x-auto">
                    <div className="flex gap-6 min-w-max">
                      {['Minorista', 'Mayorista', 'Distribuidor'].map((tier) => {
                        const finalP = calculatePrice(editCost, editIva, editMargins[tier as keyof typeof editMargins]);
                        return (
                          <div key={tier} className="flex-1 min-w-[140px] border-r border-brand-charcoal last:border-0 pr-6">
                            <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-1">{tier}</p>
                            <p className="text-2xl font-display font-black text-brand-smoke tracking-tight">${finalP.toLocaleString()}</p>
                            <p className="text-[8px] text-emerald-500 font-bold mt-1">Margen: {editMargins[tier as keyof typeof editMargins]}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-charcoal">
                <div>
                  <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block tracking-widest">Descripción Técnica (Catálogo)</label>
                  <textarea 
                    className="w-full input-field text-xs h-24 resize-none leading-relaxed" 
                    value={editLongDesc} 
                    onChange={(e) => setEditLongDesc(e.target.value)}
                    placeholder="Detalles técnicos, notas de cata, etc..."
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-brand-steel uppercase mb-1 block tracking-widest">Observaciones Internas</label>
                  <textarea 
                    className="w-full input-field text-xs h-24 resize-none leading-relaxed border-brand-charcoal/50" 
                    value={editObservations} 
                    onChange={(e) => setEditObservations(e.target.value)}
                    placeholder="Notas para el equipo de ventas o logística..."
                  />
                </div>
              </div>

              <button type="submit" className="w-full btn-gold py-5 font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl mt-4">
                <Check size={24} /> Actualizar Registro Maestro
              </button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="glass-card w-full max-w-md p-0 relative z-10 border-brand-gold/30 overflow-hidden shadow-2xl">
            <div className="bg-brand-gold/10 px-6 py-4 border-b border-brand-gold/20 flex justify-between items-center">
              <h3 className="text-xl font-display font-bold">{adjustmentType === 'income' ? 'Ingreso Stock' : 'Ajuste Stock'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!selectedItem ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={14} />
                    <input 
                      type="text" 
                      placeholder="Filtrar por SKU o Nombre..." 
                      className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-9 pr-4 py-2 text-xs text-brand-smoke outline-none focus:border-brand-gold"
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-brand-gold" 
                    onChange={(e) => { 
                      const item = stockItems.find(i => i.id === e.target.value) || null;
                      setSelectedItem(item); 
                      setAdjustmentCost(item ? item.cost_price : null);
                      setModalSearch(''); 
                    }}
                  >
                    <option value="">Seleccionar producto...</option>
                    {stockItems.filter(i => i.name.toLowerCase().includes(modalSearch.toLowerCase()) || i.sku.toLowerCase().includes(modalSearch.toLowerCase())).map(i => (
                      <option key={i.id} value={i.id}>[{i.sku}] {i.name} ({i.warehouse})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-4 bg-brand-black/40 rounded-xl border border-brand-charcoal flex justify-between items-center">
                  <span className="font-bold text-brand-smoke">{selectedItem.name}</span>
                  <button onClick={() => setSelectedItem(null)} className="text-brand-steel hover:text-white"><X size={16} /></button>
                </div>
              )}
              <div className="flex gap-4">
                <input type="number" className="flex-1 bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-xl font-black text-white outline-none focus:border-brand-gold" placeholder="0" value={adjustmentValue} onChange={(e) => setAdjustmentValue(Number(e.target.value))} />
                <div className="flex bg-brand-black/50 rounded-xl p-1 border border-brand-charcoal">
                  <button onClick={() => setAdjustmentType('income')} className={cn("px-4 rounded-lg transition-all font-black text-lg", adjustmentType === 'income' ? "bg-emerald-500 text-white shadow-lg" : "text-brand-steel hover:text-brand-smoke")}>+</button>
                  <button onClick={() => setAdjustmentType('outcome')} className={cn("px-4 rounded-lg transition-all font-black text-lg", adjustmentType === 'outcome' ? "bg-rose-500 text-white shadow-lg" : "text-brand-steel hover:text-brand-smoke")}>-</button>
                </div>
              </div>
              {/* Toggle Stock Unit if units_per_box > 1 */}
              {selectedItem && selectedItem.units_per_box > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-brand-black/40 rounded-xl border border-brand-charcoal">
                    <span className="text-[10px] uppercase font-bold text-brand-steel">Cargar stock en</span>
                    <div className="flex bg-brand-black p-0.5 rounded-lg border border-brand-charcoal text-[9px] font-black uppercase">
                      <button
                        type="button"
                        onClick={() => setAdjustmentInPacks(true)}
                        className={cn(
                          "px-2.5 py-1 rounded-[4px] transition-all duration-200 cursor-pointer",
                          adjustmentInPacks ? "bg-brand-gold text-brand-black shadow font-bold" : "text-brand-steel hover:text-white"
                        )}
                      >
                        Pack (x{selectedItem.units_per_box})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentInPacks(false)}
                        className={cn(
                          "px-2.5 py-1 rounded-[4px] transition-all duration-200 cursor-pointer",
                          !adjustmentInPacks ? "bg-brand-wine text-white shadow font-bold" : "text-brand-steel hover:text-white"
                        )}
                      >
                        Unidades
                      </button>
                    </div>
                  </div>
                  {adjustmentValue > 0 && (
                    <div className="text-right text-[10px] text-brand-steel italic pr-1">
                      {adjustmentType === 'income' ? 'Se ingresarán' : 'Se egresarán'} <span className="font-bold text-brand-gold">{adjustmentValue * (adjustmentInPacks ? selectedItem.units_per_box : 1)}</span> unidades físicas en total.
                    </div>
                  )}
                </div>
              )}
              {selectedItem && adjustmentType === 'income' && (
                <div className="bg-brand-black/40 p-4 rounded-xl border border-brand-charcoal">
                  <label className="text-[10px] uppercase font-bold text-brand-gold mb-1 block">Costo Neto Actual</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel">$</span>
                    <input 
                      type="number" 
                      className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl pl-8 pr-4 py-3 text-lg font-black text-white outline-none focus:border-brand-gold transition-all"
                      value={adjustmentCost !== null ? adjustmentCost : selectedItem.cost_price}
                      onChange={(e) => setAdjustmentCost(Number(e.target.value))}
                    />
                  </div>
                  <p className="text-[8px] text-brand-steel mt-1.5 italic">Si modificas este valor, se recalcularán las listas de precio automáticamente.</p>
                </div>
              )}
              {selectedItem && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">Depósito</label>
                  <select 
                    className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-gold"
                    value={adjustmentWarehouse || selectedItem.warehouse}
                    onChange={(e) => setAdjustmentWarehouse(e.target.value)}
                  >
                    {WAREHOUSES.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">Motivo / Justificación</label>
                <textarea 
                  className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-brand-gold h-20 resize-none"
                  placeholder="Ej: Rotura, Error de carga, Devolución..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <button onClick={handleUpdateStock} className="w-full btn-gold py-4 font-black uppercase tracking-widest shadow-xl">Confirmar Ajuste</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm" onClick={() => setIsBulkModalOpen(false)} />
          <div className="glass-card w-full max-w-md p-0 relative z-10 border-brand-gold/30 overflow-hidden shadow-2xl">
            <div className="bg-brand-gold/10 px-6 py-4 border-b border-brand-gold/20 flex justify-between items-center">
              <h3 className="text-xl font-display font-bold flex items-center gap-2"><Layers size={20} className="text-brand-gold" /> Act. Masiva</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-1 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const val = Number(f.get('val'));
              const type = f.get('type');
              const targetField = f.get('field'); 
              const group = f.get('group');
              setStockItems(prev => prev.map(i => {
                const isTarget = selectedIds.length > 0 ? selectedIds.includes(i.id) : (group === 'all' || i.brand === group || i.category === group);
                if (isTarget) {
                  let newCost = i.cost_price;
                  const newPrices = { ...i.prices };
                  const currentMargins = i.margins || { Minorista: 30, Mayorista: 20, Distribuidor: 15 };

                  if (targetField === 'cost') {
                    newCost = type === 'pct' ? i.cost_price * (1 + val/100) : i.cost_price + val;
                    newCost = Math.round(newCost);
                    // Recalcular todos los precios
                    newPrices.Minorista = calculatePrice(newCost, i.iva_rate, currentMargins.Minorista);
                    newPrices.Mayorista = calculatePrice(newCost, i.iva_rate, currentMargins.Mayorista);
                    newPrices.Distribuidor = calculatePrice(newCost, i.iva_rate, currentMargins.Distribuidor);
                  } else {
                    // Actualizar todos los precios finales por el mismo factor
                    newPrices.Minorista = type === 'pct' ? i.prices.Minorista * (1 + val/100) : i.prices.Minorista + val;
                    newPrices.Mayorista = type === 'pct' ? i.prices.Mayorista * (1 + val/100) : i.prices.Mayorista + val;
                    newPrices.Distribuidor = type === 'pct' ? i.prices.Distribuidor * (1 + val/100) : i.prices.Distribuidor + val;
                    
                    // Redondear a la decena
                    newPrices.Minorista = Math.round(newPrices.Minorista / 10) * 10;
                    newPrices.Mayorista = Math.round(newPrices.Mayorista / 10) * 10;
                    newPrices.Distribuidor = Math.round(newPrices.Distribuidor / 10) * 10;
                  }
                  return { ...i, cost_price: newCost, prices: newPrices };
                }
                return i;
              }));
              addAuditLog({
                id: Math.random().toString(36).substr(2,9),
                item_name: group === 'all' ? 'Todo el Catálogo' : `Grupo: ${group}`,
                type: 'precio_update',
                reason: `Actualización Masiva: ${type === 'pct' ? val + '%' : '$' + val} en ${targetField === 'cost' ? 'Costos' : 'Precios'}`,
                timestamp: new Date().toLocaleString(),
                user: 'Admin'
              });
              setIsBulkModalOpen(false); setSelectedIds([]);
            }} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">¿Qué valor quieres aumentar?</label>
                <select name="field" className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-brand-gold transition-all appearance-none">
                  <option value="cost">Costo Neto (Base)</option>
                  <option value="final">Precio de Venta</option>
                </select>
              </div>
              {!selectedIds.length && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">Filtrar por</label>
                  <select name="group" className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-brand-gold transition-all appearance-none">
                    <option value="all">Todo el Catálogo</option>
                    <optgroup label="Marcas">
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                    <optgroup label="Categorías">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <select name="type" className="bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-brand-gold transition-all appearance-none"><option value="pct">Porcentaje (%)</option><option value="fixed">Monto Fijo ($)</option></select>
                <input name="val" type="number" className="bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-brand-gold transition-all" placeholder="Ej: 10" required />
              </div>
              <button type="submit" className="w-full btn-gold py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <Check size={20} /> Aplicar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm" onClick={() => setIsTransferModalOpen(false)} />
          <div className="glass-card w-full max-w-md p-0 relative z-10 border-blue-500/30 overflow-hidden shadow-2xl">
            <div className="bg-blue-500/10 px-6 py-4 border-b border-blue-500/20 flex justify-between items-center">
              <h3 className="text-xl font-display font-bold flex items-center gap-2"><ArrowRightLeft className="text-blue-500" /> Transferencia</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="p-1 hover:bg-blue-500/20 rounded-full text-brand-steel hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={14} />
                  <input 
                    type="text" 
                    placeholder="Filtrar producto por SKU o Nombre..." 
                    className="w-full bg-brand-black/50 border border-brand-charcoal rounded-xl pl-9 pr-4 py-2 text-xs text-brand-smoke outline-none focus:border-blue-500"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </div>
                <select 
                  className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" 
                  onChange={(e) => { setSelectedItem(stockItems.find(i => i.id === e.target.value) || null); setModalSearch(''); }}
                >
                  <option value="">Seleccionar producto...</option>
                  {stockItems.filter(i => i.name.toLowerCase().includes(modalSearch.toLowerCase()) || i.sku.toLowerCase().includes(modalSearch.toLowerCase())).map(i => (
                    <option key={i.id} value={i.id}>[{i.sku}] {i.name} ({i.warehouse})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">Origen</label>
                  <div className="w-full bg-brand-black/40 border border-brand-charcoal rounded-xl px-4 py-2 text-xs text-brand-steel font-bold">
                    {selectedItem?.warehouse || '-'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-steel mb-1 block">Destino</label>
                  <select 
                    className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500"
                    value={transferDest}
                    onChange={(e) => setTransferDest(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {WAREHOUSES.filter(w => w !== selectedItem?.warehouse).map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input 
                type="number" 
                className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-xl font-black text-white outline-none focus:border-blue-500" 
                placeholder="Cantidad a mover..." 
                value={adjustmentValue || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (selectedItem && !selectedItem.allow_overstock) {
                    const max = selectedItem.stock_actual - selectedItem.stock_reservado;
                    const maxAllowed = (adjustmentInPacks && selectedItem.units_per_box > 1) 
                      ? Math.floor(max / selectedItem.units_per_box) 
                      : max;
                    if (val > maxAllowed) {
                      alert(`No puedes transferir más de ${maxAllowed} ${adjustmentInPacks ? 'packs' : 'unidades'} (Stock Disponible).`);
                      setAdjustmentValue(maxAllowed);
                      return;
                    }
                  }
                  setAdjustmentValue(val);
                }} 
              />
              {/* Toggle Stock Unit for Transfer if units_per_box > 1 */}
              {selectedItem && selectedItem.units_per_box > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-brand-black/40 rounded-xl border border-brand-charcoal">
                    <span className="text-[10px] uppercase font-bold text-brand-steel">Transferir en</span>
                    <div className="flex bg-brand-black p-0.5 rounded-lg border border-brand-charcoal text-[9px] font-black uppercase">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustmentInPacks(true);
                          setAdjustmentValue(0);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-[4px] transition-all duration-200 cursor-pointer",
                          adjustmentInPacks ? "bg-brand-gold text-brand-black shadow font-bold" : "text-brand-steel hover:text-white"
                        )}
                      >
                        Pack (x{selectedItem.units_per_box})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustmentInPacks(false);
                          setAdjustmentValue(0);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-[4px] transition-all duration-200 cursor-pointer",
                          !adjustmentInPacks ? "bg-blue-600 text-white shadow font-bold" : "text-brand-steel hover:text-white"
                        )}
                      >
                        Unidades
                      </button>
                    </div>
                  </div>
                  {adjustmentValue > 0 && (
                    <div className="text-right text-[10px] text-brand-steel italic pr-1">
                      Se transferirán <span className="font-bold text-blue-400">{adjustmentValue * (adjustmentInPacks ? selectedItem.units_per_box : 1)}</span> unidades físicas en total.
                    </div>
                  )}
                </div>
              )}
              <button 
                onClick={() => {
                  if (!selectedItem || adjustmentValue <= 0 || !transferDest) return;
                  const finalTransferQty = (adjustmentInPacks && selectedItem.units_per_box > 1)
                    ? adjustmentValue * selectedItem.units_per_box
                    : adjustmentValue;
                  
                  if (!selectedItem.allow_overstock && finalTransferQty > (selectedItem.stock_actual - selectedItem.stock_reservado)) {
                    alert('La cantidad supera el stock disponible en origen.');
                    return;
                  }
                  const destWarehouse = transferDest;
                  
                  setStockItems(prev => {
                    // 1. Descontar del origen
                    const newItems = prev.map(i => i.id === selectedItem.id ? { ...i, stock_actual: i.stock_actual - finalTransferQty } : i);
                    
                    // 2. Buscar si el producto ya existe en el destino (por SKU o Barcode)
                    const existingInDest = prev.find(i => (i.sku === selectedItem.sku || i.barcode === selectedItem.barcode) && i.warehouse === destWarehouse);
                    
                    if (existingInDest) {
                      // Sumar al existente
                      return newItems.map(i => i.id === existingInDest.id ? { ...i, stock_actual: i.stock_actual + finalTransferQty } : i);
                    } else {
                      // Crear nuevo registro para ese depósito
                      const newItem: StockItem = {
                        ...selectedItem,
                        id: Math.random().toString(36).substr(2, 9),
                        warehouse: destWarehouse,
                        stock_actual: finalTransferQty,
                        stock_reservado: 0,
                        last_update: new Date().toLocaleString()
                      };
                      return [...newItems, newItem];
                    }
                  });

                  const transferReason = (adjustmentInPacks && selectedItem.units_per_box > 1) 
                    ? `Transferencia entre depósitos (${adjustmentValue} Pack/s)` 
                    : 'Transferencia entre depósitos';

                  addAuditLog({ id: Math.random().toString(36).substr(2,9), item_name: selectedItem.name, type: 'transferencia', warehouse_source: selectedItem.warehouse, warehouse_dest: destWarehouse, quantity: finalTransferQty, timestamp: new Date().toLocaleString(), user: 'Admin', reason: transferReason });
                  setIsTransferModalOpen(false);
                  setAdjustmentValue(0);
                  setSelectedItem(null);
                  setTransferDest('');
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 text-white font-black uppercase tracking-widest shadow-xl transition-all rounded-xl"
              >Ejecutar Movimiento</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Side Drawer Panel */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full md:w-[450px] bg-brand-black border-l border-brand-charcoal z-[200] shadow-2xl transition-transform duration-500 ease-out",
        isAuditOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-brand-charcoal bg-brand-charcoal/20 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-display font-bold flex items-center gap-2 uppercase tracking-widest text-brand-gold">
                <History size={20} /> Registro Auditoría
              </h3>
              <p className="text-[9px] text-brand-steel font-black uppercase tracking-widest mt-1">Actividad en tiempo real</p>
            </div>
            <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-brand-charcoal rounded-full transition-colors"><X size={24} className="text-brand-steel" /></button>
          </div>

          <div className="p-4 space-y-4 bg-brand-black/80 backdrop-blur-md border-b border-brand-charcoal">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={14} />
              <input 
                type="text" 
                placeholder="Buscar por producto..." 
                className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl pl-9 pr-4 py-3 text-xs text-brand-smoke outline-none focus:border-brand-gold/50 shadow-inner"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-brand-steel uppercase tracking-widest ml-1">Desde</label>
                <input 
                  type="date" 
                  className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-brand-gold/50 transition-all"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-brand-steel uppercase tracking-widest ml-1">Hasta</label>
                <input 
                  type="date" 
                  className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-brand-gold/50 transition-all"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                />
              </div>
            </div>

            <select 
              className="w-full bg-brand-charcoal border border-brand-charcoal rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-brand-gold/50 shadow-lg"
              value={auditTypeFilter}
              onChange={(e) => setAuditTypeFilter(e.target.value)}
            >
              <option value="all">Todas las Operaciones</option>
              <option value="precio_update">Precios / Fichas</option>
              <option value="ingreso">Ingresos de Stock</option>
              <option value="egreso">Egresos / Ajustes</option>
              <option value="transferencia">Transferencias</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredAuditLogs.length === 0 ? (
              <div className="text-center py-20 text-brand-steel italic text-sm">No hay actividad registrada.</div>
            ) : (
              filteredAuditLogs.map(log => (
                <div key={log.id} className="glass-card p-4 border border-brand-charcoal/50 hover:border-brand-gold/20 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-brand-steel">{log.timestamp}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded font-black uppercase text-[8px] border",
                      log.type === 'ingreso' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                      log.type === 'precio_update' ? "bg-brand-gold/10 text-brand-gold border-brand-gold/20" : 
                      log.type === 'transferencia' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      "bg-brand-smoke/10 text-brand-smoke border-brand-smoke/20"
                    )}>{log.type.replace('_', ' ')}</span>
                  </div>
                  <div className="font-bold text-brand-smoke text-sm mb-2">{log.item_name}</div>
                  <div className="text-xs text-brand-steel bg-brand-black/40 p-2 rounded-lg border border-brand-charcoal/30">
                    {log.type === 'precio_update' && log.old_value ? (
                      <div className="flex items-center gap-2">
                        <span className="line-through opacity-30 font-mono">${log.old_value}</span>
                        <ArrowUpRight size={10} className="text-emerald-500" />
                        <span className="text-brand-gold font-black font-mono">${log.new_value}</span>
                        <span className={cn(
                          "text-[9px] font-black",
                          Number(log.new_value) >= Number(log.old_value) ? "text-emerald-500" : "text-rose-500"
                        )}>
                          ({Number(log.new_value) >= Number(log.old_value) ? '+' : '-'}${Math.abs(Number(log.new_value) - Number(log.old_value))})
                        </span>
                      </div>
                    ) : log.type === 'transferencia' ? (
                      <div className="flex items-center gap-2">
                        <span>{log.warehouse_source}</span>
                        <ArrowRightLeft size={10} className="text-brand-gold" />
                        <span>{log.warehouse_dest}</span>
                      </div>
                    ) : log.reason}
                  </div>
                  <div className="mt-2 flex justify-between items-center border-t border-brand-charcoal/20 pt-2">
                    <span className="text-[10px] text-brand-steel font-bold uppercase tracking-tighter">Operador: <span className="text-brand-smoke">{log.user}</span></span>
                    {log.quantity && <span className="text-[10px] font-black text-brand-gold">CANT: {log.quantity}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {isAuditOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[190]" onClick={() => setIsAuditOpen(false)} />}
    </div>
  );
};

export default StockManagement;
