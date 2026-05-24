import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Catalog from './pages/Catalog'
import Login from './pages/Login'
import Cart from './pages/Cart'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import ImportProducts from './pages/admin/ImportProducts'
import StockManagement from './pages/admin/StockManagement'
import ClientsManagement from './pages/admin/ClientsManagement'
import ProvidersManagement from './pages/admin/ProvidersManagement'
import SalesTerminal from './pages/admin/SalesTerminal'
import OrdersManagement from './pages/admin/OrdersManagement'
import { Copilot } from './pages/admin/Copilot'
import SettingsManagement from './pages/admin/SettingsManagement'
import RecessTerminal from './pages/admin/RecessTerminal'
import { DemoManager } from './components/admin/DemoManager'
import { SupabaseSyncService } from './services/supabaseSyncService'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  useEffect(() => {
    // Hydrate local Zustand store with latest data from Supabase if online
    SupabaseSyncService.syncAll();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/catalogo" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/carrito" element={<Cart />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/importar-productos" element={<AdminLayout><ImportProducts /></AdminLayout>} />
          <Route path="/admin/stock" element={<AdminLayout><StockManagement /></AdminLayout>} />
          <Route path="/admin/clientes" element={<AdminLayout><ClientsManagement /></AdminLayout>} />
          <Route path="/admin/proveedores" element={<AdminLayout><ProvidersManagement /></AdminLayout>} />
          <Route path="/admin/ventas" element={<AdminLayout><SalesTerminal /></AdminLayout>} />
          <Route path="/admin/recreo" element={<AdminLayout><RecessTerminal /></AdminLayout>} />
          <Route path="/admin/pedidos" element={<AdminLayout><OrdersManagement /></AdminLayout>} />
          <Route path="/admin/copiloto" element={<AdminLayout><Copilot /></AdminLayout>} />
          <Route path="/admin/configuracion" element={<AdminLayout><SettingsManagement /></AdminLayout>} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/catalogo" replace />} />
        </Routes>
        <DemoManager />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
