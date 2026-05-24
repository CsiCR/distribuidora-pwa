import React, { useMemo, useState } from 'react';
import { TrendingUp, ShoppingBag, Users, Package, DollarSign, Activity, AlertOctagon, BarChart3, Wallet, Info } from 'lucide-react';
import { useOrdersStore } from '../../store/useOrdersStore';
import { useStockStore } from '../../store/useStockStore';
import { useClientsStore } from '../../store/useClientsStore';
import { useTransactionsStore } from '../../store/useTransactionsStore';
import { formatDistanceToNow, parseISO, format, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const AdminDashboard: React.FC = () => {
  const [chartPeriod, setChartPeriod] = useState<'7' | '30' | 'year'>('7');
  const [debtorsSort, setDebtorsSort] = useState<'amount_desc' | 'amount_asc' | 'days_desc' | 'days_asc'>('amount_desc');
  
  const orders = useOrdersStore(state => state.orders);
  const stockItems = useStockStore(state => state.products);
  const clients = useClientsStore(state => state.clients);
  const transactions = useTransactionsStore(state => state.transactions);

  const getDaysOverdue = (client: any) => {
    if (!client || typeof client.balance !== 'number' || client.balance >= 0) return 0;

    // 1. Buscar en transacciones de tipo factura
    const clientTxs = (transactions || []).filter((t: any) => t && t.client_id === client.id && t.type === 'FACTURA');
    if (clientTxs.length > 0) {
      let oldestDate: any = null;
      clientTxs.forEach((tx: any) => {
        let txDate: Date;
        try {
          const txDateStr = tx?.date || '';
          txDate = new Date(txDateStr);
          if (isNaN(txDate.getTime())) {
            const parts = txDateStr.match(/(\d+)\/(\d+)\/(\d+)/);
            if (parts) {
              const d = parseInt(parts[1], 10);
              const m = parseInt(parts[2], 10) - 1;
              const y = parseInt(parts[3], 10);
              txDate = new Date(y, m, d);
            }
          }
        } catch (e) {
          return;
        }
        if (!isNaN(txDate.getTime())) {
          if (!oldestDate || txDate < oldestDate) {
            oldestDate = txDate;
          }
        }
      });

      if (oldestDate) {
        const diffTime = Math.abs(new Date().getTime() - oldestDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      }
    }

    // 2. Buscar en órdenes no canceladas
    const clientOrders = (orders || []).filter((o: any) => o && o.client_name === client.name && o.status !== 'Cancelado');
    if (clientOrders.length > 0) {
      let oldestDate: any = null;
      clientOrders.forEach((order: any) => {
        let orderDate: Date;
        try {
          const dateStr = order?.date || '';
          if (dateStr.includes('T')) {
            orderDate = parseISO(dateStr);
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            orderDate = new Date(dateStr.replace(' ', 'T'));
          } else if (dateStr) {
            orderDate = new Date(dateStr);
          } else {
            return;
          }
        } catch (e) {
          return;
        }
        if (!isNaN(orderDate.getTime())) {
          if (!oldestDate || orderDate < oldestDate) {
            oldestDate = orderDate;
          }
        }
      });

      if (oldestDate) {
        const diffTime = Math.abs(new Date().getTime() - oldestDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      }
    }

    // 3. Fallback determinista para el demo basado en su ID
    const clientIdStr = String(client?.id || '');
    const idNum = parseInt(clientIdStr.replace(/\D/g, '')) || 1;
    return ((idNum * 13) % 30) + 5;
  };

  // 1. ¿Cuánto vendí? y ¿Cuánto gané? 
  const { totalVentas, totalGanancia, chartData } = useMemo(() => {
    const activeOrders = orders.filter(o => o.status === 'Confirmado' || o.status === 'Entregado');
    let ventas = 0;
    let ganancia = 0;

    let periodChartData: any[] = [];
    if (chartPeriod === 'year') {
      periodChartData = Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(new Date(), 11 - i);
        return {
          date: format(d, 'yyyy-MM'),
          label: format(d, 'MMM yy', { locale: es }),
          shortLabel: format(d, 'MMM', { locale: es }),
          ventas: 0,
          ganancia: 0
        };
      });
    } else {
      const days = chartPeriod === '30' ? 30 : 7;
      periodChartData = Array.from({ length: days }, (_, i) => {
        const d = subDays(new Date(), days - 1 - i);
        return {
          date: format(d, 'yyyy-MM-dd'),
          label: format(d, 'd MMM', { locale: es }),
          shortLabel: chartPeriod === '7' ? format(d, 'EEE', { locale: es }) : format(d, 'd', { locale: es }),
          ventas: 0,
          ganancia: 0
        };
      });
    }

    activeOrders.forEach(order => {
      let orderCost = 0;
      const orderItems = order?.items || [];
      orderItems.forEach(item => {
        const product = (stockItems || []).find(p => p && (p.id === item.id || p.name === item.name));
        const unitCost = product 
          ? (product.cost_price / (product.units_per_box || 1)) 
          : (item?.price || 0) * 0.7; 
        orderCost += unitCost * (item?.quantity || 0);
      });
      const orderProfit = (order?.total || 0) - orderCost;
      try {
        let orderDateObj;
        const dateStr = order?.date || '';
        if (dateStr.includes('T')) {
          orderDateObj = parseISO(dateStr);
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          orderDateObj = new Date(dateStr.replace(' ', 'T'));
        } else if (dateStr) {
          // Intento nativo
          orderDateObj = new Date(dateStr);
          if (isNaN(orderDateObj.getTime())) {
            // Intento DD/MM/YYYY (toLocaleString de Argentina)
            const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+)/);
            if (parts) {
              const d = parseInt(parts[1], 10);
              const m = parseInt(parts[2], 10) - 1;
              const y = parseInt(parts[3], 10);
              orderDateObj = new Date(y, m, d);
            }
          }
        } else {
          orderDateObj = new Date();
        }
        
        // Si sigue fallando, forzar al día de hoy para no perder el dato financiero
        if (isNaN(orderDateObj.getTime())) {
          orderDateObj = new Date();
        }
        
        const localDateStr = chartPeriod === 'year' 
          ? format(orderDateObj, 'yyyy-MM') 
          : format(orderDateObj, 'yyyy-MM-dd');
          
        const dayMatch = periodChartData.find(d => d.date === localDateStr);
        if (dayMatch) {
          dayMatch.ventas += order.total;
          dayMatch.ganancia += orderProfit;
          ventas += order.total;
          ganancia += orderProfit;
        }
      } catch (e) {}
    });

    return { totalVentas: ventas, totalGanancia: ganancia, chartData: periodChartData };
  }, [orders, stockItems, chartPeriod]);

  // 2. ¿Quién me debe plata?
  const debtors = useMemo(() => {
    const debtorsList = clients
      .filter(c => c.balance < 0)
      .map(c => ({
        ...c,
        daysOverdue: getDaysOverdue(c)
      }));

    if (debtorsSort === 'amount_desc') {
      return debtorsList.sort((a, b) => a.balance - b.balance);
    } else if (debtorsSort === 'amount_asc') {
      return debtorsList.sort((a, b) => b.balance - a.balance);
    } else if (debtorsSort === 'days_desc') {
      return debtorsList.sort((a, b) => b.daysOverdue - a.daysOverdue);
    } else {
      return debtorsList.sort((a, b) => a.daysOverdue - b.daysOverdue);
    }
  }, [clients, debtorsSort, transactions, orders]);

  const totalDeuda = debtors.reduce((sum, client) => sum + Math.abs(client.balance), 0);

  // 3. ¿Qué me falta reponer?
  const lowStockItems = stockItems.filter(item => item.stock_actual > 0 && item.stock_actual <= item.stock_minimo);
  const outOfStockItems = stockItems.filter(item => item.stock_actual === 0);
  const stockAlertsCount = lowStockItems.length + outOfStockItems.length;

  // Inteligencia de Capital
  const { totalInvested, expectedRevenue, deadStockValue } = useMemo(() => {
    let invested = 0;
    let revenue = 0;
    let deadStock = 0;

    stockItems.forEach(item => {
      if (item.stock_actual > 0) {
        const upb = item.units_per_box || 1;
        const unitCost = item.cost_price / upb;
        const unitPrice = item.prices.Minorista / upb;

        invested += item.stock_actual * unitCost;
        revenue += item.stock_actual * unitPrice;
        
        if (item.status === 'inactivo' || (item.stock_minimo > 0 && item.stock_actual > item.stock_minimo * 3)) {
          deadStock += item.stock_actual * unitCost;
        }
      }
    });

    return { totalInvested: invested, expectedRevenue: revenue, deadStockValue: deadStock };
  }, [stockItems]);

  const potentialProfit = expectedRevenue - totalInvested;
  const profitMarginPct = expectedRevenue > 0 ? (potentialProfit / expectedRevenue) * 100 : 0;

  const topStats = [
    { label: 'Ventas Totales', value: `$${totalVentas.toLocaleString()}`, icon: ShoppingBag, color: 'text-blue-500', formula: '∑ Ventas de pedidos activos dentro del período seleccionado (7 días, 30 días o 12 meses).' },
    { label: 'Ganancia Neta', value: `$${totalGanancia.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', formula: 'Ventas del período - Costo Neto de la mercadería vendida en el período.' },
    { label: 'Por Cobrar (Deuda)', value: `$${totalDeuda.toLocaleString()}`, icon: Wallet, color: 'text-rose-500', formula: '∑ Saldos negativos en cuentas corrientes de clientes.' },
    { label: 'A Reponer (Alertas)', value: stockAlertsCount.toString(), icon: Package, color: 'text-brand-gold', formula: 'Productos con Stock = 0 o por debajo del mínimo ideal.' },
  ];

  const maxChartValue = Math.max(...chartData.map(d => d.ventas), 1);

  return (
    <div className="animate-fade-in pb-20">
      <h1 className="text-3xl font-display font-bold mb-8 uppercase tracking-tight text-brand-smoke">Dashboard Ejecutivo</h1>
      
      {/* Top Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {topStats.map((stat, i) => (
          <div key={i} className={`glass-card p-6 flex items-center justify-between border-l-4 border-l-brand-charcoal hover:border-l-${stat.color.replace('text-', '')} transition-all relative group/card`}>
            
            <div className="absolute top-3 right-3 z-20 group/info cursor-help">
              <Info size={14} className="text-brand-steel hover:text-white transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-brand-black/95 backdrop-blur-md border border-brand-charcoal rounded-lg text-[10px] text-brand-smoke shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50">
                <span className={`font-bold ${stat.color} block mb-1 uppercase tracking-widest text-[9px]`}>Fórmula de Cálculo:</span>
                <p className="opacity-80 leading-relaxed">{stat.formula}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1 pr-4">
              <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest mb-1 truncate">{stat.label}</p>
              <h3 className="text-xl xl:text-2xl font-display font-black text-brand-smoke tracking-tight truncate" title={stat.value}>{stat.value}</h3>
            </div>
            <div className={`p-4 rounded-2xl bg-brand-black/50 ${stat.color} shadow-inner group-hover/card:scale-110 transition-transform shrink-0`}>
              <stat.icon size={28} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Gráfico de Evolución de Ventas */}
        <div className="lg:col-span-2 glass-card p-6 border-brand-charcoal flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="font-bold flex items-center gap-2 text-brand-smoke uppercase tracking-wide text-sm">
              <BarChart3 size={18} className="text-blue-500" /> Evolución de Ventas y Ganancias
            </h3>
            
            {/* Selector de Período */}
            <div className="flex items-center gap-1 bg-brand-charcoal/30 p-1 rounded-lg w-full sm:w-auto">
              <button 
                onClick={() => setChartPeriod('7')}
                className={`flex-1 sm:flex-none text-[10px] font-bold px-3 py-1.5 rounded-md transition-all uppercase tracking-wider ${chartPeriod === '7' ? 'bg-blue-500 text-white shadow-md' : 'text-brand-steel hover:text-brand-smoke'}`}
              >
                7 Días
              </button>
              <button 
                onClick={() => setChartPeriod('30')}
                className={`flex-1 sm:flex-none text-[10px] font-bold px-3 py-1.5 rounded-md transition-all uppercase tracking-wider ${chartPeriod === '30' ? 'bg-blue-500 text-white shadow-md' : 'text-brand-steel hover:text-brand-smoke'}`}
              >
                30 Días
              </button>
              <button 
                onClick={() => setChartPeriod('year')}
                className={`flex-1 sm:flex-none text-[10px] font-bold px-3 py-1.5 rounded-md transition-all uppercase tracking-wider ${chartPeriod === 'year' ? 'bg-blue-500 text-white shadow-md' : 'text-brand-steel hover:text-brand-smoke'}`}
              >
                12 Meses
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-end gap-1 sm:gap-2 mt-auto pt-4 h-48 relative">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
              <div className="border-t border-brand-steel w-full"></div>
              <div className="border-t border-brand-steel w-full"></div>
              <div className="border-t border-brand-steel w-full"></div>
              <div className="border-t border-brand-steel w-full"></div>
            </div>

            {chartData.map((dataPoint, i) => {
              const salesHeight = (dataPoint.ventas / maxChartValue) * 100;
              const profitHeight = dataPoint.ventas > 0 ? (dataPoint.ganancia / dataPoint.ventas) * 100 : 0;
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group cursor-crosshair h-full justify-end">
                  <div className="absolute -top-16 bg-brand-black border border-brand-charcoal p-2 rounded-lg text-[10px] shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10 w-max text-center pointer-events-none">
                    <p className="font-bold text-brand-smoke capitalize mb-1">{dataPoint.label}</p>
                    <p className="text-blue-400 font-bold">Ventas: ${dataPoint.ventas.toLocaleString()}</p>
                    <p className="text-emerald-400 font-bold">Ganancia: ${dataPoint.ganancia.toLocaleString()}</p>
                  </div>
                  
                  <div className={`w-full ${chartPeriod === '7' ? 'max-w-[40px]' : (chartPeriod === 'year' ? 'max-w-[30px]' : 'max-w-[12px]')} bg-blue-500/30 rounded-t-sm relative transition-all duration-500 hover:bg-blue-500/50`} style={{ height: `${salesHeight}%`, minHeight: dataPoint.ventas > 0 ? '4px' : '0' }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 rounded-t-sm transition-all duration-500" style={{ height: `${profitHeight}%` }}></div>
                  </div>
                  
                  {/* Label inferior: Ocultar algunos si son 30 días para evitar solapamiento en móviles */}
                  <span className={`text-[8px] text-brand-steel font-bold uppercase tracking-tighter truncate w-full text-center ${chartPeriod === '30' && i % 3 !== 0 ? 'hidden md:block' : ''}`}>
                    {dataPoint.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-6 pt-4 border-t border-brand-charcoal/50 justify-center">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-blue-500/50"></span>
              <span className="text-[10px] font-bold text-brand-steel uppercase tracking-widest">Ventas Totales</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/80"></span>
              <span className="text-[10px] font-bold text-brand-steel uppercase tracking-widest">Ganancia Neta</span>
            </div>
          </div>
        </div>

        {/* ¿Quién me debe plata? (Deudores) */}
        <div className="glass-card p-6 flex flex-col border-rose-500/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <h3 className="font-bold flex items-center gap-2 text-brand-smoke uppercase tracking-wide text-sm">
              <AlertOctagon size={18} className="text-rose-500" /> Cuentas por Cobrar
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
              <select 
                value={debtorsSort}
                onChange={(e) => setDebtorsSort(e.target.value as any)}
                className="bg-brand-black border border-brand-charcoal text-[10px] font-bold text-brand-smoke rounded px-2.5 py-1.5 outline-none cursor-pointer hover:border-brand-steel transition-colors"
              >
                <option value="amount_desc" className="bg-brand-black text-brand-smoke">Monto (Mayor a Menor)</option>
                <option value="amount_asc" className="bg-brand-black text-brand-smoke">Monto (Menor a Mayor)</option>
                <option value="days_desc" className="bg-brand-black text-brand-smoke">Atraso (Mayor a Menor)</option>
                <option value="days_asc" className="bg-brand-black text-brand-smoke">Atraso (Menor a Mayor)</option>
              </select>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2 py-1 rounded-full shrink-0">{debtors.length} Deudores</span>
            </div>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {debtors.slice(0, 7).map(client => (
              <div key={client.id} className="flex items-center justify-between p-3 bg-brand-charcoal/20 rounded-xl border border-rose-500/10 hover:border-rose-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-black flex items-center justify-center border border-brand-charcoal">
                    <Users size={12} className="text-brand-steel" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-brand-smoke">{client.fantasy_name}</div>
                    <div className="flex items-center gap-1.5 text-[9px] text-brand-steel uppercase tracking-widest">
                      <span>{client.phone || client.city}</span>
                      <span>•</span>
                      <span className="text-rose-400 font-bold">{client.daysOverdue} días</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-400 truncate max-w-[80px]" title={`$${Math.abs(client.balance).toLocaleString()}`}>
                    ${Math.abs(client.balance).toLocaleString()}
                  </div>
                  <button className="text-[8px] uppercase font-black tracking-widest text-brand-gold hover:underline">Reclamar</button>
                </div>
              </div>
            ))}
            {debtors.length === 0 && (
              <div className="text-center text-brand-steel py-8 text-sm italic">Todas las cuentas están al día 🎉</div>
            )}
          </div>
        </div>
      </div>

      {/* Inteligencia de Capital Widget Mejorado */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-brand-steel uppercase tracking-widest mb-4 flex items-center gap-2"><DollarSign size={16} className="text-brand-gold" /> Inteligencia de Capital Invertido</h2>
        
        {/* Tarjetas Superiores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="glass-card p-4 border-l-4 border-l-brand-gold border-brand-charcoal relative group/card">
            <div className="absolute top-2 right-2 z-20 group/info cursor-help">
              <Info size={14} className="text-brand-steel hover:text-brand-gold transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-brand-black/95 backdrop-blur-md border border-brand-charcoal rounded-lg text-[10px] text-brand-smoke shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50">
                <span className="font-bold text-brand-gold block mb-1 uppercase tracking-widest text-[9px]">Fórmula:</span>
                <p className="opacity-80 leading-relaxed">∑ (Stock Físico × Costo Neto)</p>
              </div>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover/card:opacity-10 transition-opacity"><DollarSign size={80} /></div>
            </div>
            <div className="relative z-10 pr-6">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand-steel mb-1 truncate">Capital Invertido</p>
              <p className="text-xl xl:text-2xl font-display font-black text-brand-smoke tracking-tight truncate" title={`$${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
                ${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          
          <div className="glass-card p-4 border-l-4 border-l-emerald-500 border-brand-charcoal relative group/card">
            <div className="absolute top-2 right-2 z-20 group/info cursor-help">
              <Info size={14} className="text-brand-steel hover:text-emerald-500 transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-brand-black/95 backdrop-blur-md border border-brand-charcoal rounded-lg text-[10px] text-brand-smoke shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50">
                <span className="font-bold text-emerald-500 block mb-1 uppercase tracking-widest text-[9px]">Fórmula:</span>
                <p className="opacity-80 leading-relaxed">∑ (Stock Físico × Precio Minorista)</p>
              </div>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover/card:opacity-10 transition-opacity"><TrendingUp size={80} /></div>
            </div>
            <div className="relative z-10 pr-6">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand-steel mb-1 truncate">Valor de Venta</p>
              <p className="text-xl xl:text-2xl font-display font-black text-emerald-400 tracking-tight truncate" title={`$${expectedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
                ${expectedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          
          <div className="glass-card p-4 border-l-4 border-l-blue-500 border-brand-charcoal relative group/card">
            <div className="absolute top-2 right-2 z-20 group/info cursor-help">
              <Info size={14} className="text-brand-steel hover:text-blue-500 transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-brand-black/95 backdrop-blur-md border border-brand-charcoal rounded-lg text-[10px] text-brand-smoke shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50">
                <span className="font-bold text-blue-500 block mb-1 uppercase tracking-widest text-[9px]">Fórmula:</span>
                <p className="opacity-80 leading-relaxed">Valor de Venta - Capital Invertido</p>
              </div>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover/card:opacity-10 transition-opacity"><Activity size={80} /></div>
            </div>
            <div className="relative z-10 pr-6">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand-steel mb-1 truncate">Rentabilidad Potencial</p>
              <p className="text-xl xl:text-2xl font-display font-black text-blue-400 tracking-tight truncate" title={`$${potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
                ${potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[9px] text-brand-steel mt-1 font-bold">Margen: <span className="text-blue-400">{profitMarginPct.toFixed(1)}%</span></p>
            </div>
          </div>
          
          <div className="glass-card p-4 border-l-4 border-l-rose-500 border-brand-charcoal relative group/card">
            <div className="absolute top-2 right-2 z-20 group/info cursor-help">
              <Info size={14} className="text-brand-steel hover:text-rose-500 transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-brand-black/95 backdrop-blur-md border border-brand-charcoal rounded-lg text-[10px] text-brand-smoke shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50">
                <span className="font-bold text-rose-500 block mb-1 uppercase tracking-widest text-[9px]">Fórmula:</span>
                <p className="opacity-80 leading-relaxed">Capital de Inactivos + Excesos (&gt; 3x mínimo)</p>
              </div>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover/card:opacity-10 transition-opacity"><AlertOctagon size={80} /></div>
            </div>
            <div className="relative z-10 pr-6">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand-steel mb-1 truncate">Capital en Riesgo</p>
              <p className="text-xl xl:text-2xl font-display font-black text-rose-500 tracking-tight truncate" title={`$${deadStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
                ${deadStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Gráficos de Composición de Capital */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5 border-brand-charcoal">
            <div className="flex justify-between items-end mb-3">
              <h4 className="text-[10px] font-bold text-brand-steel uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12} className="text-emerald-500"/> Composición del Valor de Venta</h4>
              <span className="text-xs font-black text-brand-smoke truncate max-w-[100px]">${expectedRevenue.toLocaleString()}</span>
            </div>
            <div className="h-4 w-full bg-brand-charcoal/50 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-brand-gold relative group" style={{ width: `${expectedRevenue > 0 ? (totalInvested / expectedRevenue) * 100 : 0}%`}}></div>
              <div className="h-full bg-blue-500 relative group" style={{ width: `${expectedRevenue > 0 ? (potentialProfit / expectedRevenue) * 100 : 0}%`}}></div>
            </div>
            <div className="flex justify-between mt-3 text-[9px] font-bold tracking-widest uppercase">
              <span className="text-brand-gold flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-brand-gold shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div> Costo Base ({(expectedRevenue > 0 ? (totalInvested / expectedRevenue) * 100 : 0).toFixed(0)}%)</span>
              <span className="text-blue-400 flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> Rentabilidad ({(expectedRevenue > 0 ? (potentialProfit / expectedRevenue) * 100 : 0).toFixed(0)}%)</span>
            </div>
          </div>

          <div className="glass-card p-5 border-brand-charcoal">
            <div className="flex justify-between items-end mb-3">
              <h4 className="text-[10px] font-bold text-brand-steel uppercase tracking-widest flex items-center gap-2"><DollarSign size={12} className="text-brand-gold"/> Estado del Capital Invertido</h4>
              <span className="text-xs font-black text-brand-smoke truncate max-w-[100px]">${totalInvested.toLocaleString()}</span>
            </div>
            <div className="h-4 w-full bg-brand-charcoal/50 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-emerald-500" style={{ width: `${totalInvested > 0 ? ((totalInvested - deadStockValue) / totalInvested) * 100 : 0}%`}}></div>
              <div className="h-full bg-rose-500" style={{ width: `${totalInvested > 0 ? (deadStockValue / totalInvested) * 100 : 0}%`}}></div>
            </div>
            <div className="flex justify-between mt-3 text-[9px] font-bold tracking-widest uppercase">
              <span className="text-emerald-500 flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Activo Sano ({(totalInvested > 0 ? ((totalInvested - deadStockValue) / totalInvested) * 100 : 0).toFixed(0)}%)</span>
              <span className="text-rose-500 flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div> En Riesgo / Exceso ({(totalInvested > 0 ? (deadStockValue / totalInvested) * 100 : 0).toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Listas Inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Alertas de Reposición */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2 text-brand-smoke uppercase tracking-wide text-sm">
              <Package size={18} className="text-brand-gold" /> Alertas de Reposición
            </h3>
            <span className="text-[10px] bg-brand-gold/10 text-brand-gold font-bold px-2 py-1 rounded-full">{stockAlertsCount} productos</span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {outOfStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center font-black text-xs text-rose-400 shadow-inner">0</div>
                  <div>
                    <div className="text-sm font-bold text-brand-smoke truncate max-w-[200px]">{item.name}</div>
                    <div className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Sin Stock</div>
                  </div>
                </div>
                <div className="text-[10px] uppercase font-black text-brand-steel">Min: {item.stock_minimo}</div>
              </div>
            ))}
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-brand-gold/5 rounded-xl border border-brand-gold/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center font-black text-xs text-brand-gold shadow-inner">{item.stock_actual}</div>
                  <div>
                    <div className="text-sm font-bold text-brand-smoke truncate max-w-[200px]">{item.name}</div>
                    <div className="text-[10px] text-brand-gold font-bold">Quedan pocas unidades</div>
                  </div>
                </div>
                <div className="text-[10px] uppercase font-black text-brand-steel">Min: {item.stock_minimo}</div>
              </div>
            ))}
            {stockAlertsCount === 0 && (
              <div className="text-center text-brand-steel py-8 text-sm italic">El stock está en niveles óptimos</div>
            )}
          </div>
        </div>

        {/* Últimos Pedidos */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2 text-brand-smoke uppercase tracking-wide text-sm">
              <ShoppingBag size={18} className="text-blue-500" /> Últimos Pedidos
            </h3>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {orders.slice(0, 5).map(order => {
              let timeAgo = '';
              try {
                const date = parseISO(order.date.replace(' ', 'T'));
                timeAgo = formatDistanceToNow(date, { addSuffix: true, locale: es });
              } catch (e) {
                timeAgo = order.date;
              }
              
              let statusColor = 'text-brand-steel';
              if (order.status === 'Confirmado') statusColor = 'text-emerald-500';
              if (order.status === 'Entregado') statusColor = 'text-blue-500';
              if (order.status === 'Cancelado') statusColor = 'text-rose-400';

              return (
                <div key={order.id} className="flex items-center justify-between p-3 bg-brand-charcoal/40 rounded-xl hover:bg-brand-charcoal/60 transition-colors border border-brand-charcoal/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-black flex items-center justify-center font-black text-[10px] text-brand-steel shadow-inner border border-brand-charcoal">{String(order?.id || '').replace('REM-', '#')}</div>
                    <div>
                      <div className="text-sm font-bold text-brand-smoke">{order.client_name}</div>
                      <div className="text-[10px] text-brand-steel capitalize">{timeAgo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-brand-gold truncate max-w-[80px]" title={`$${order.total.toLocaleString()}`}>
                      ${order.total.toLocaleString()}
                    </div>
                    <div className={`text-[9px] uppercase font-black tracking-wider ${statusColor}`}>{order.status}</div>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="text-center text-brand-steel py-8 text-sm italic">No hay pedidos recientes</div>
            )}
          </div>
        </div>

      </div>

      {/* Sección de Depuración de Costos */}
      <div className="mt-12 glass-card p-6 border-brand-charcoal">
        <h3 className="text-sm font-bold text-brand-smoke uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info size={16} className="text-brand-gold" /> Diagnóstico Técnico de Costos y Ganancias
        </h3>
        <p className="text-xs text-brand-steel mb-6 leading-relaxed">
          Esta sección desglosa el cálculo exacto de costo (COGS) y ganancia neta para cada pedido activo. Puedes verificar qué producto tiene un costo que supera su precio de venta.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-charcoal text-[10px] text-brand-steel uppercase tracking-widest">
                <th className="py-3 px-4">Pedido ID</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 text-right">Total Pedido</th>
                <th className="py-3 px-4">Artículos (Cant × Costo Unitario Mapeado - Subtotal)</th>
                <th className="py-3 px-4 text-right">Costo Total</th>
                <th className="py-3 px-4 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-charcoal/30 text-xs">
              {orders.filter(o => o && (o.status === 'Confirmado' || o.status === 'Entregado')).map(order => {
                let calculatedCost = 0;
                const orderItems = order?.items || [];
                const itemsBreakdown = orderItems.map((item, idx) => {
                  const product = (stockItems || []).find(p => p && (p.id === item.id || p.name === item.name));
                  const unitCost = product 
                    ? (product.cost_price / (product.units_per_box || 1)) 
                    : (item?.price || 0) * 0.7;
                  const itemCost = unitCost * (item?.quantity || 0);
                  calculatedCost += itemCost;
                  return (
                    <div key={idx} className="mb-2 text-[11px]">
                      <span className="text-brand-smoke font-medium">{item.name}</span>: {item.quantity} u × ${unitCost.toLocaleString(undefined, {minimumFractionDigits: 2})} = <span className="text-brand-steel">${itemCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      {product ? (
                        <div className="text-[9px] text-brand-gold italic">
                          (Coincidencia BD: Costo Caja: ${product.cost_price.toLocaleString()} / Unidades por Caja: {product.units_per_box || 1})
                        </div>
                      ) : (
                        <div className="text-[9px] text-rose-400 italic">
                          (Sin Coincidencia en BD - Estimando costo al 70% del precio de venta)
                        </div>
                      )}
                    </div>
                  );
                });
                const profit = order.total - calculatedCost;
                return (
                  <tr key={order.id} className="hover:bg-brand-charcoal/10 transition-colors">
                    <td className="py-4 px-4 font-bold text-brand-smoke">{order.id}</td>
                    <td className="py-4 px-4 text-brand-steel">{order.client_name}</td>
                    <td className="py-4 px-4 text-right font-bold text-brand-smoke">${order.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-4 px-4 text-brand-smoke">{itemsBreakdown}</td>
                    <td className="py-4 px-4 text-right font-semibold text-rose-400">${calculatedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className={`py-4 px-4 text-right font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${profit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
