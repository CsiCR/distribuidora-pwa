import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  Upload, 
  Settings, 
  Menu,
  X,
  ChevronRight,
  TrendingUp,
  ArrowLeft,
  Bot,
  Truck,
  Zap
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const distributorName = useSettingsStore(state => state.distributorName);
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = React.useState(true);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: ShoppingCart, label: 'Pedidos', path: '/admin/pedidos' },
    { icon: TrendingUp, label: 'Terminal de Ventas', path: '/admin/ventas' },
    { icon: Zap, label: 'Modo Recreo (Offline)', path: '/admin/recreo' },
    { icon: Package, label: 'Productos', path: '/admin/productos' },
    { icon: Upload, label: 'Importar Excel', path: '/admin/importar-productos' },
    { icon: Package, label: 'Gestión de Stock', path: '/admin/stock' },
    { icon: Users, label: 'Clientes', path: '/admin/clientes' },
    { icon: Truck, label: 'Proveedores', path: '/admin/proveedores' },
    { icon: Bot, label: 'Copiloto IA', path: '/admin/copiloto' },
    { icon: Settings, label: 'Configuración', path: '/admin/configuracion' },
  ];

  const showFullSidebar = isSidebarOpen && location.pathname !== '/admin/recreo';

  return (
    <div className="min-h-screen bg-brand-black flex text-brand-smoke">
      {/* Sidebar */}
      <aside className={`
        ${showFullSidebar ? 'w-64' : 'w-20'} 
        bg-brand-graphite border-r border-brand-charcoal transition-all duration-300 flex flex-col sticky top-0 h-screen z-40
      `}>
        <div className="p-6 flex items-center justify-between">
          {showFullSidebar ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-wine rounded-full flex items-center justify-center border border-brand-gold/30">
                <span className="text-brand-gold font-bold">{distributorName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="font-display font-bold text-sm tracking-tighter">ADMIN PANEL</span>
            </div>
          ) : (
             <div className="w-8 h-8 bg-brand-wine rounded-full flex items-center justify-center border border-brand-gold/30 mx-auto">
                <span className="text-brand-gold font-bold">{distributorName.charAt(0).toUpperCase()}</span>
              </div>
          )}
          {location.pathname !== '/admin/recreo' && (
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-brand-charcoal rounded text-brand-steel">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-4 px-4 py-3 rounded-xl transition-all group
                  ${isActive 
                    ? 'bg-brand-wine text-white shadow-lg shadow-brand-wine/20' 
                    : 'text-brand-steel hover:bg-brand-charcoal hover:text-brand-smoke'}
                `}
              >
                <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:text-brand-gold'} />
                {showFullSidebar && <span className="font-medium text-sm">{item.label}</span>}
                {isActive && showFullSidebar && <ChevronRight size={16} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-charcoal">
          <Link to="/catalogo" className="flex items-center gap-4 px-4 py-3 text-brand-steel hover:text-brand-smoke">
             <ArrowLeft size={20} />
             {showFullSidebar && <span className="text-sm">Volver al Catálogo</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-w-0 h-screen ${location.pathname === '/admin/recreo' ? 'overflow-hidden bg-brand-black' : 'overflow-y-auto'}`}>
        {location.pathname !== '/admin/recreo' && (
          <header className="h-16 bg-brand-graphite/50 backdrop-blur-md border-b border-brand-charcoal px-8 flex items-center justify-between sticky top-0 z-30">
            <h2 className="font-display font-bold uppercase tracking-widest text-brand-steel text-xs">
              {menuItems.find(m => m.path === location.pathname)?.label || 'Admin'}
            </h2>
            <div className="flex items-center gap-4">
               <div className="text-right hidden sm:block">
                 <div className="text-sm font-bold">Admin {distributorName}</div>
                 <div className="text-[10px] text-brand-gold uppercase font-bold tracking-tighter">Super Admin</div>
               </div>
               <div className="w-10 h-10 rounded-full bg-brand-charcoal border border-brand-steel/30" />
            </div>
          </header>
        )}
        
        <div className={location.pathname === '/admin/recreo' ? 'flex-1 h-full p-2 overflow-hidden' : 'p-8'}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
