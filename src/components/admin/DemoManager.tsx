import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database, Trash2, Beer, ShoppingBag, Coffee, BookOpen, ChevronRight, ChevronLeft, IceCream, PartyPopper, Type } from 'lucide-react';
import { useStockStore } from '../../store/useStockStore';
import { useOrdersStore } from '../../store/useOrdersStore';
import { useClientsStore } from '../../store/useClientsStore';
import { useParkedOrdersStore } from '../../store/useParkedOrdersStore';
import { useTransactionsStore } from '../../store/useTransactionsStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useProvidersStore } from '../../store/useProvidersStore';
import { useCartStore } from '../../store/useCartStore';
import { seedProfiles } from '../../data/seedProfiles';
import { cn } from '../../lib/utils';
import { generateDemoData } from '../../utils/demoDataGenerator';

export const DemoManager: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // No mostrar el panel de demo en el catálogo, carrito y la terminal de recreo
  if (location.pathname === '/catalogo' || location.pathname === '/carrito' || location.pathname === '/' || location.pathname === '/admin/recreo') {
    return null;
  }
  const { clearStore, setProducts } = useStockStore();
  const { clearOrders, setOrders } = useOrdersStore();
  const { clearClients, setClients } = useClientsStore();
  const { clearParkedOrders } = useParkedOrdersStore();
  const { clearTransactions, setTransactions } = useTransactionsStore();
  const { clearTerminal } = useTerminalStore();
  const { clearStore: clearProviders, setProvidersData } = useProvidersStore();
  const { clearCart } = useCartStore();
  
  const distributorName = useSettingsStore(state => state.distributorName);
  const setDistributorName = useSettingsStore(state => state.setDistributorName);
  const [tempName, setTempName] = useState(distributorName);

  const handleResetAll = () => {
    if (window.confirm('¿Está seguro de borrar TODOS los datos? Se eliminarán pedidos, clientes, stock, proveedores, transacciones y carrito.')) {
      clearStore();
      clearOrders();
      clearClients();
      clearParkedOrders();
      clearTransactions();
      clearTerminal();
      clearProviders();
      clearCart();
      alert('Sistema reiniciado a cero.');
    }
  };

  const handleSeed = (type: keyof typeof seedProfiles) => {
    const profile = seedProfiles[type];
    const demoData = generateDemoData(profile.products);

    clearStore();
    clearOrders();
    clearClients();
    clearParkedOrders();
    clearTransactions();
    clearTerminal();
    clearProviders();
    clearCart();
    
    setProducts(demoData.products);
    setClients(demoData.clients);
    setProvidersData(demoData.providers, demoData.providerInvoices, demoData.providerPayments);
    setOrders(demoData.orders);
    setTransactions(demoData.transactions);

    setIsOpen(false);
    alert(`Cargado perfil de demostración: ${profile.name} con 5 días de movimientos.`);
  };

  const handleNameChange = () => {
    setDistributorName(tempName || 'CRÍSTICO');
    alert('Nombre de la distribuidora actualizado para la demo.');
  };

  return (
    <div className={cn(
      "fixed left-0 top-1/2 -translate-y-1/2 z-[500] transition-all duration-300 flex items-center",
      isOpen ? "translate-x-0" : "-translate-x-[calc(100%-40px)]"
    )}>
      <div className="bg-brand-black border-2 border-brand-charcoal rounded-r-3xl shadow-2xl overflow-hidden flex flex-col w-[260px]">
        <div className="p-4 bg-brand-wine/20 border-b border-brand-charcoal flex items-center gap-3">
          <Database className="text-brand-gold" size={20} />
          <h4 className="text-[10px] font-black text-brand-gold uppercase tracking-[0.2em]">Panel de Demostración</h4>
        </div>
        
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <p className="text-[8px] font-black text-brand-steel uppercase tracking-widest">Nombre de Distribuidora</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="CRÍSTICO"
                className="w-full bg-brand-charcoal/40 border border-brand-charcoal rounded-lg px-3 py-2 text-xs text-brand-smoke focus:outline-none focus:border-brand-gold/40 transition-colors"
              />
              <button 
                onClick={handleNameChange}
                className="bg-brand-gold/20 text-brand-gold p-2 rounded-lg hover:bg-brand-gold/30 transition-colors"
                title="Actualizar Nombre"
              >
                <Type size={16} />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-brand-charcoal space-y-2">
            <p className="text-[8px] font-black text-brand-steel uppercase tracking-widest">Cargar Perfil de Rubro</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleSeed('bebidas')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <Beer size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Bebidas</span>
              </button>
              <button onClick={() => handleSeed('almacen')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <ShoppingBag size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Almacén</span>
              </button>
              <button onClick={() => handleSeed('kiosko')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <Coffee size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Kiosko</span>
              </button>
              <button onClick={() => handleSeed('libreria')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <BookOpen size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Librería</span>
              </button>
              <button onClick={() => handleSeed('heladeria')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <IceCream size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Heladería</span>
              </button>
              <button onClick={() => handleSeed('cotillon')} className="flex flex-col items-center gap-2 p-3 bg-brand-charcoal/40 hover:bg-brand-gold/10 rounded-2xl border border-brand-charcoal hover:border-brand-gold/40 transition-all group">
                <PartyPopper size={18} className="text-brand-steel group-hover:text-brand-gold" />
                <span className="text-[8px] font-bold text-brand-smoke uppercase">Cotillón</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-brand-charcoal">
            <button 
              onClick={handleResetAll}
              className="w-full flex items-center justify-center gap-2 p-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-rose-500/30"
            >
              <Trash2 size={14} /> Reiniciar Sistema
            </button>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-brand-black border-2 border-l-0 border-brand-charcoal p-2 rounded-r-xl text-brand-gold hover:bg-brand-charcoal transition-colors shadow-xl"
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
    </div>
  );
};

