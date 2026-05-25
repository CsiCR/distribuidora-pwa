import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Wifi, 
  WifiOff, 
  RotateCw, 
  Plus, 
  X, 
  ShoppingCart, 
  User, 
  Search, 
  Sparkles, 
  Coins, 
  CreditCard, 
  AlertTriangle, 
  Check,
  Barcode,
  LayoutGrid,
  List,
  ArrowLeft
} from 'lucide-react';
import { useOfflineSalesStore } from '../../store/useOfflineSalesStore';
import { useStockStore } from '../../store/useStockStore';
import { useClientsStore, type Client } from '../../store/useClientsStore';
import { cn } from '../../lib/utils';
import { SupabaseSyncService } from '../../services/supabaseSyncService';


const RecessTerminal: React.FC = () => {
  const {
    isOfflineMode,
    offlineOrders,
    activeCarts,
    activeCartId,
    toggleOfflineMode,
    addCartQueue,
    removeCartQueue,
    setActiveCart,
    updateCartName,
    updateCartClient,
    addToCart,
    updateCartQty,
    removeFromCart,
    processOfflineSale,
    syncPendingSales,
    supabaseStatus,
    supabaseError
  } = useOfflineSalesStore();

  const { products } = useStockStore();
  const { clients } = useClientsStore();

  // Local UI State
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  
  // Unified Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'Efectivo' | 'Cuenta Corriente' | 'Mixto'>('Efectivo');
  const [cashInputAmount, setCashInputAmount] = useState<string>('0');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [checkoutStudentSearchQuery, setCheckoutStudentSearchQuery] = useState<string>('');
  const [showCheckoutSearchDropdown, setShowCheckoutSearchDropdown] = useState<boolean>(false);

  // Mixed payment detailed states
  const [mixedCashPortion, setMixedCashPortion] = useState<string>('0');
  const [mixedCashDelivered, setMixedCashDelivered] = useState<string>('0');
  const [activeMixedField, setActiveMixedField] = useState<'portion' | 'delivered'>('portion');

  // Buffer and references for Scanner
  const scanBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  // Auto-notification helper
  const triggerNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setShowNotification({ text, type });
    setTimeout(() => {
      setShowNotification(null);
    }, 3500);
  };

  // 1. Global Barcode Credential Listener (Usb scanner emulation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if focused in inputs (prevent conflicts with manual student search or config inputs)
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const now = Date.now();
      // Reset scanner buffer if time gap between keys is too large (> 50ms implies manual typing)
      if (now - lastKeyTime.current > 50 && scanBuffer.current.length > 0) {
        scanBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 4) {
          const scannedCode = scanBuffer.current.trim().toUpperCase();
          scanBuffer.current = '';

          // Look up client by credential_id
          const matchedStudent = clients.find(
            c => c.credential_id?.toUpperCase() === scannedCode || c.cuit?.toUpperCase() === scannedCode
          );

          if (matchedStudent) {
            updateCartClient(activeCartId, matchedStudent.id);
            // Auto rename queue to student's name
            const firstName = matchedStudent.name.split(' ')[0];
            updateCartName(activeCartId, firstName);
            triggerNotification(`Credencial leída: ${matchedStudent.fantasy_name || matchedStudent.name}`, 'success');
          } else {
            triggerNotification(`Código de credencial no encontrado: "${scannedCode}"`, 'error');
          }
        } else {
          scanBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        scanBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clients, activeCartId]);

  // Syncing simulation
  // Syncing action
  const handleSyncClick = async () => {
    if (isOfflineMode) {
      triggerNotification('Activa la señal (Online) para poder sincronizar.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      // 1. Check/retry Supabase connection first
      const connectionSuccess = await SupabaseSyncService.checkConnection();
      if (!connectionSuccess) {
        const errorMsg = useOfflineSalesStore.getState().supabaseError || 'No se pudo conectar a la base de datos central.';
        triggerNotification(`Error de conexión: ${errorMsg}`, 'error');
        return;
      }

      // 2. Sync pending sales (this will push and trigger syncAll)
      const count = await syncPendingSales();
      
      // 3. Hydrate store one extra time to fetch any external updates
      await SupabaseSyncService.syncAll();
      
      if (count > 0) {
        triggerNotification(`¡Sincronización completada! ${count} venta(s) cargadas al servidor y catálogo actualizado.`, 'success');
      } else {
        triggerNotification('¡Base de datos y catálogo sincronizados con la nube!', 'success');
      }
    } catch (e: any) {
      triggerNotification(`Error de red: ${e?.message || 'Error de conexión'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Active Cart Calculations
  const currentCart = useMemo(() => {
    return activeCarts.find(c => c.id === activeCartId) || activeCarts[0];
  }, [activeCarts, activeCartId]);

  const selectedStudent = useMemo(() => {
    if (!currentCart.selectedClientId) return null;
    return clients.find(c => c.id === currentCart.selectedClientId) || null;
  }, [clients, currentCart.selectedClientId]);

  const cartTotal = useMemo(() => {
    return currentCart.items.reduce((acc, item) => {
      const price = item.prices.Minorista || 0;
      return acc + (price * item.quantity);
    }, 0);
  }, [currentCart.items]);

  // Credit alerts
  const creditLimitDetails = useMemo(() => {
    if (!selectedStudent) return { isOverLimit: false, remainingCredit: 0 };
    const limit = selectedStudent.credit_limit ?? 10000;
    // balance is negative if deudor, e.g. -2500. So remaining limit is limit - abs(balance)
    const currentDebt = selectedStudent.balance < 0 ? Math.abs(selectedStudent.balance) : 0;
    const projectedDebt = currentDebt + cartTotal;
    const isOverLimit = projectedDebt > limit;
    const remainingCredit = Math.max(0, limit - projectedDebt);
    return { isOverLimit, remainingCredit, limit };
  }, [selectedStudent, cartTotal]);

  // Set default cash amount based on checkout method
  useEffect(() => {
    if (showCheckoutModal) {
      if (checkoutMethod === 'Efectivo') {
        setCashInputAmount(cartTotal.toString());
      } else if (checkoutMethod === 'Cuenta Corriente') {
        setCashInputAmount('0');
      } else if (checkoutMethod === 'Mixto') {
        setCashInputAmount(Math.round(cartTotal / 2).toString());
      }
    }
  }, [showCheckoutModal, checkoutMethod, cartTotal]);

  const filteredCheckoutStudentsSuggestions = useMemo(() => {
    if (!checkoutStudentSearchQuery.trim()) return [];
    return clients.filter(c => {
      const term = checkoutStudentSearchQuery.toLowerCase();
      const isSchoolStudent = c.zone === 'Colegio San Martin' || c.id.startsWith('student_') || c.id.startsWith('teacher_');
      if (!isSchoolStudent) return false;
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.fantasy_name || '').toLowerCase().includes(term) ||
        (c.credential_id || '').toLowerCase().includes(term)
      );
    });
  }, [clients, checkoutStudentSearchQuery]);

  const handleCheckoutStudentSelect = (student: Client) => {
    updateCartClient(activeCartId, student.id);
    const firstName = student.name.split(' ')[0];
    updateCartName(activeCartId, firstName);
    setCheckoutStudentSearchQuery('');
    setShowCheckoutSearchDropdown(false);
    triggerNotification(`Asociado a ${student.fantasy_name || student.name}`);
  };

  // QWERTY visual keyboard helper
  const renderVirtualQwertyKeyboard = (
    query: string, 
    setQuery: (q: string) => void,
    setDropdown: (b: boolean) => void
  ) => {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    const handleKeyPress = (char: string) => {
      setQuery(query + char);
      setDropdown(true);
    };

    const handleBackspace = () => {
      setQuery(query.slice(0, -1));
      setDropdown(true);
    };

    const handleClear = () => {
      setQuery('');
      setDropdown(false);
    };

    return (
      <div className="bg-brand-black/60 border border-brand-charcoal p-2.5 rounded-xl space-y-1.5 mt-2 w-full max-w-md mx-auto select-none shrink-0 z-50">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1">
            {row.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="flex-1 h-8 rounded bg-brand-charcoal/50 border border-brand-charcoal text-[11px] font-black text-brand-white active:scale-90 transition-all cursor-pointer flex items-center justify-center"
              >
                {char}
              </button>
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-1">
          <button
            type="button"
            onClick={handleClear}
            className="flex-[1.5] h-8 rounded bg-brand-wine/20 border border-brand-wine/30 text-[9px] font-black text-brand-wine uppercase tracking-wider active:scale-90 transition-all cursor-pointer flex items-center justify-center"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress(' ')}
            className="flex-[4] h-8 rounded bg-brand-charcoal/50 border border-brand-charcoal text-[10px] font-bold text-brand-steel uppercase tracking-widest active:scale-90 transition-all cursor-pointer flex items-center justify-center"
          >
            Espacio
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex-[1.5] h-8 rounded bg-brand-wine/20 border border-brand-wine/30 text-[11px] font-black text-brand-wine active:scale-90 transition-all cursor-pointer flex items-center justify-center"
          >
            ⌫
          </button>
        </div>
      </div>
    );
  };

  // Dynamically compute categories based on actual active products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.status === 'activo' && p.category) {
        cats.add(p.category);
      }
    });
    return ['Todos', ...Array.from(cats)];
  }, [products]);

  // Filter products for school quick canteen
  const schoolProducts = useMemo(() => {
    return products.filter(p => {
      if (p.status === 'inactivo') return false;
      if (activeCategory === 'Todos') return true;
      return p.category === activeCategory;
    });
  }, [products, activeCategory]);

  // Student Search
  const filteredStudentsSuggestions = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];
    return clients.filter(c => {
      const term = studentSearchQuery.toLowerCase();
      const isSchoolStudent = c.zone === 'Colegio San Martin' || c.id.startsWith('student_') || c.id.startsWith('teacher_');
      if (!isSchoolStudent) return false;
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.fantasy_name || '').toLowerCase().includes(term) ||
        (c.credential_id || '').toLowerCase().includes(term)
      );
    });
  }, [clients, studentSearchQuery]);

  // Handlers
  const handleStudentSelect = (student: Client) => {
    updateCartClient(activeCartId, student.id);
    const firstName = student.name.split(' ')[0];
    updateCartName(activeCartId, firstName);
    setStudentSearchQuery('');
    setShowSearchDropdown(false);
    triggerNotification(`Asociado a ${student.fantasy_name || student.name}`);
  };

  const handleRemoveStudent = () => {
    updateCartClient(activeCartId, undefined);
    // Reset queue name
    const index = activeCarts.findIndex(c => c.id === activeCartId) + 1;
    updateCartName(activeCartId, `Cola ${index}`);
    triggerNotification('Alumno desvinculado. Cobrando a Consumidor Final.', 'info');
  };

  const handleFinishSale = (method: 'Efectivo' | 'Cuenta Corriente' | 'Mixto', cashAmt: number, creditAmt: number) => {
    const res = processOfflineSale(method, cashAmt, creditAmt);
    if (res.success) {
      triggerNotification(`¡Venta #${res.orderId} realizada con éxito!`, 'success');
      setShowCheckoutModal(false);
      setCashInputAmount('0');
    } else {
      triggerNotification('Error al procesar la venta. El carrito está vacío.', 'error');
    }
  };

  const cashInputNumber = useMemo(() => {
    return parseFloat(cashInputAmount) || 0;
  }, [cashInputAmount]);

  // Mixed Payment Calculator helper
  const calculatedRemainingCreditDebt = useMemo(() => {
    const diff = cartTotal - (checkoutMethod === 'Mixto' ? (parseFloat(mixedCashPortion) || 0) : cashInputNumber);
    return diff > 0 ? diff : 0;
  }, [cartTotal, checkoutMethod, mixedCashPortion, cashInputNumber]);

  // Unified Checkout Validation
  const isCheckoutValid = useMemo(() => {
    if (checkoutMethod === 'Efectivo') {
      return cashInputNumber >= cartTotal;
    }
    if (checkoutMethod === 'Cuenta Corriente') {
      return !!selectedStudent;
    }
    if (checkoutMethod === 'Mixto') {
      const portion = parseFloat(mixedCashPortion) || 0;
      const delivered = parseFloat(mixedCashDelivered) || 0;
      return !!selectedStudent && portion >= 0 && portion <= cartTotal && delivered >= portion;
    }
    return false;
  }, [checkoutMethod, selectedStudent, cashInputNumber, cartTotal, mixedCashPortion, mixedCashDelivered]);

  const handleKeypadPress = (val: string) => {
    if (checkoutMethod === 'Efectivo') {
      if (val === 'C') {
        setCashInputAmount('0');
        return;
      }
      if (val === '⌫') {
        setCashInputAmount(prev => {
          if (prev.length <= 1) return '0';
          return prev.slice(0, -1);
        });
        return;
      }
      setCashInputAmount(prev => {
        const newAmount = prev === '0' ? val : prev + val;
        return newAmount;
      });
    } else if (checkoutMethod === 'Mixto') {
      if (activeMixedField === 'portion') {
        if (val === 'C') {
          setMixedCashPortion('0');
          setMixedCashDelivered('0');
          return;
        }
        if (val === '⌫') {
          setMixedCashPortion(prev => {
            const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
            setMixedCashDelivered(next);
            return next;
          });
          return;
        }
        setMixedCashPortion(prev => {
          const next = prev === '0' ? val : prev + val;
          const parsed = parseFloat(next) || 0;
          if (parsed > cartTotal) {
            setMixedCashDelivered(cartTotal.toString());
            return cartTotal.toString();
          }
          setMixedCashDelivered(next);
          return next;
        });
      } else {
        // Delivered field
        if (val === 'C') {
          setMixedCashDelivered('0');
          return;
        }
        if (val === '⌫') {
          setMixedCashDelivered(prev => {
            if (prev.length <= 1) return '0';
            return prev.slice(0, -1);
          });
          return;
        }
        setMixedCashDelivered(prev => {
          const next = prev === '0' ? val : prev + val;
          return next;
        });
      }
    }
  };

  const handlePresetPress = (amount: number) => {
    if (checkoutMethod === 'Efectivo') {
      setCashInputAmount(amount.toString());
    } else if (checkoutMethod === 'Mixto') {
      if (activeMixedField === 'portion') {
        const val = Math.min(cartTotal, amount).toString();
        setMixedCashPortion(val);
        setMixedCashDelivered(val);
      } else {
        setMixedCashDelivered(amount.toString());
      }
    }
  };

  const handleConfirmCheckout = () => {
    if (!isCheckoutValid) return;
    
    let cashAmt = 0;
    let creditAmt = 0;
    
    if (checkoutMethod === 'Efectivo') {
      cashAmt = cartTotal;
      creditAmt = 0;
    } else if (checkoutMethod === 'Cuenta Corriente') {
      cashAmt = 0;
      creditAmt = cartTotal;
    } else if (checkoutMethod === 'Mixto') {
      cashAmt = parseFloat(mixedCashPortion) || 0;
      creditAmt = Math.max(0, cartTotal - cashAmt);
    }
    
    handleFinishSale(checkoutMethod, cashAmt, creditAmt);
  };

  return (
    <div className="flex flex-col h-full w-full text-brand-smoke select-none overflow-hidden">
      {/* Top Status and Simultaneous Queue tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-brand-charcoal/20 border border-brand-charcoal/50 p-4 rounded-2xl mb-4">
        {/* Connection status and sync */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Zap className="text-brand-gold animate-pulse shrink-0" size={24} />
            <h3 className="font-accent text-2xl tracking-wider text-brand-gold">MODO RECREO</h3>
            <Link 
              to="/admin" 
              className="flex items-center gap-1.5 px-3 py-1 bg-brand-charcoal/40 hover:bg-brand-charcoal text-brand-steel hover:text-white border border-brand-charcoal rounded-xl text-[10px] font-bold transition-all ml-2"
              title="Volver al panel de administración"
            >
              <ArrowLeft size={10} />
              <span>Volver a Admin</span>
            </Link>
          </div>
          
          {/* Real-time Supabase connection status / Offline manual switch */}
          {isOfflineMode ? (
            <button 
              onClick={toggleOfflineMode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 cursor-pointer hover:bg-rose-500/20 transition-colors"
              title="El sistema está configurado en modo local manual offline."
            >
              <WifiOff size={14} className="animate-pulse" />
              Modo Local Manual
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {supabaseStatus === 'connected' && (
                <button 
                  onClick={toggleOfflineMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  title="Conectado a la nube. Toca para desactivar la señal (modo local)."
                >
                  <Wifi size={14} />
                  Nube Conectada
                </button>
              )}
              {supabaseStatus === 'connecting' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                  <RotateCw size={12} className="animate-spin" />
                  Conectando...
                </div>
              )}
              {supabaseStatus === 'disconnected' && (
                <button 
                  onClick={() => handleSyncClick()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 cursor-pointer hover:bg-rose-500/20 transition-colors"
                  title={`Error al conectar con la base de datos: ${supabaseError || 'Error de red'}. Toca para reintentar.`}
                >
                  <WifiOff size={14} />
                  Error Nube (Reintentar)
                </button>
              )}
              {supabaseStatus === 'missing_credentials' && (
                <button 
                  onClick={() => alert(`Variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no configuradas en Vercel.\n\nPara solucionarlo:\n1. Ve a tu proyecto en Vercel -> Settings -> Environment Variables\n2. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con sus respectivos valores\n3. Redespliega la aplicación.`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/40 cursor-pointer hover:bg-rose-500/20 transition-colors"
                  title="Las variables de entorno de Supabase no están configuradas en Vercel. Toca para ver instrucciones."
                >
                  <AlertTriangle size={14} className="text-rose-400 animate-bounce" />
                  Nube sin Configurar
                </button>
              )}
            </div>
          )}

          <button 
            onClick={handleSyncClick}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
              offlineOrders.length > 0 
                ? "bg-brand-gold/15 text-brand-gold border-brand-gold/40 animate-pulse hover:bg-brand-gold hover:text-brand-black" 
                : "bg-brand-charcoal/40 text-brand-steel border-brand-charcoal hover:bg-brand-charcoal"
            )}
          >
            <RotateCw size={14} className={cn(isSyncing && "animate-spin")} />
            Sincronizar
            {offlineOrders.length > 0 && (
              <span className="bg-brand-wine text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {offlineOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Queue Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full sm:max-w-[50%] py-1 scrollbar-thin">
          {activeCarts.map((cart) => {
            const isActive = cart.id === activeCartId;
            const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            
            return (
              <div 
                key={cart.id}
                onClick={() => setActiveCart(cart.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-brand-wine border-brand-wine/50 text-white shadow-md shadow-brand-wine/30"
                    : "bg-brand-charcoal/40 border-brand-charcoal text-brand-steel hover:text-brand-smoke"
                )}
              >
                <ShoppingCart size={12} className={itemsCount > 0 ? "text-brand-gold" : ""} />
                <span>{cart.name}</span>
                {itemsCount > 0 && (
                  <span className="bg-brand-gold text-brand-black text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    {itemsCount}
                  </span>
                )}
                {activeCarts.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCartQueue(cart.id);
                    }}
                    className="p-0.5 rounded-full hover:bg-black/20 text-brand-steel hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => addCartQueue()}
            className="p-2 bg-brand-charcoal hover:bg-brand-steel/30 text-brand-gold rounded-xl transition-all cursor-pointer border border-brand-charcoal"
            title="Abrir nueva cola de atención"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Left Side: Touch grid of quick canteen items */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden bg-brand-charcoal/10 border border-brand-charcoal/30 rounded-2xl p-4">
          
          {/* Quick Categories Bar & View switcher */}
          <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-brand-charcoal/50 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap",
                    activeCategory === cat
                      ? "bg-brand-gold text-brand-black border-transparent shadow-lg shadow-brand-gold/15"
                      : "bg-brand-charcoal/40 border-brand-charcoal text-brand-steel hover:text-brand-smoke hover:border-brand-steel/30"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-brand-black/40 border border-brand-charcoal p-1 rounded-xl shrink-0">
              <button
                onClick={() => setProductViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  productViewMode === 'grid'
                    ? "bg-brand-gold text-brand-black shadow"
                    : "text-brand-steel hover:text-brand-smoke"
                )}
                title="Vista de Tarjetas"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setProductViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-all cursor-pointer",
                  productViewMode === 'list'
                    ? "bg-brand-gold text-brand-black shadow"
                    : "text-brand-steel hover:text-brand-smoke"
                )}
                title="Vista de Lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Canteen Products Touch Grid */}
          {productViewMode === 'grid' ? (
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-4 custom-scrollbar">
              {schoolProducts.map((p) => {
                const inActiveCart = currentCart.items.find(i => i.id === p.id)?.quantity || 0;
                const stockLeft = p.stock_actual - inActiveCart;
                const isOutOfStock = stockLeft <= 0;

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p, 1)}
                    className={cn(
                      "flex flex-col bg-brand-charcoal/30 border rounded-2xl h-56 w-full overflow-hidden transition-all active:scale-95 border-brand-charcoal cursor-pointer hover:border-brand-gold/40 group relative",
                      isOutOfStock && "opacity-40 grayscale cursor-not-allowed hover:border-brand-charcoal active:scale-100"
                    )}
                  >
                    {/* Top half: Clear Product Image */}
                    <div className="w-full h-[70%] bg-brand-black relative shrink-0 border-b border-brand-charcoal/40 overflow-hidden">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-black/40 text-brand-steel text-xs font-bold uppercase">
                          {p.brand}
                        </div>
                      )}
                      
                      {/* Stock tag */}
                      <div className="absolute top-2 right-2 z-10">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest border backdrop-blur-md",
                          stockLeft <= 0 && "bg-rose-500/90 text-white border-rose-500/20",
                          stockLeft > 0 && stockLeft <= 5 && "bg-amber-500/80 text-white border-amber-500/20 animate-pulse",
                          stockLeft > 5 && "bg-brand-black/85 text-brand-steel border-brand-charcoal"
                        )}>
                          {stockLeft <= 0 ? 'Sin Stock' : stockLeft <= 5 ? `Últimos ${stockLeft}` : `Stock: ${stockLeft}`}
                        </span>
                      </div>

                      {/* Selected count badge */}
                      {inActiveCart > 0 && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="w-6 h-6 rounded-full bg-brand-wine text-white border border-brand-gold/40 flex items-center justify-center text-[10px] font-black shadow-lg shadow-brand-black/50 animate-scale-up">
                            {inActiveCart}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom half: Info */}
                    <div className="p-2 flex flex-col justify-between h-[30%] w-full z-10 bg-brand-charcoal/15 text-left">
                      <div className="w-full">
                        <p className="text-[8px] font-black text-brand-steel uppercase tracking-widest block mb-0.5 truncate">
                          {p.brand}
                        </p>
                        <h4 className="font-display font-extrabold text-[11px] sm:text-xs text-brand-smoke group-hover:text-brand-gold transition-colors leading-tight line-clamp-2">
                          {p.name}
                        </h4>
                      </div>

                      <div className="w-full flex items-center justify-between mt-0.5">
                        <span className="text-[11px] sm:text-xs font-black text-brand-gold font-mono bg-brand-black/70 px-2 py-0.5 rounded-lg border border-brand-charcoal shadow-inner">
                          ${p.prices.Minorista.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
              {schoolProducts.map((p) => {
                const inActiveCart = currentCart.items.find(i => i.id === p.id)?.quantity || 0;
                const stockLeft = p.stock_actual - inActiveCart;
                const isOutOfStock = stockLeft <= 0;

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3.5 bg-brand-charcoal/20 border border-brand-charcoal p-2.5 rounded-xl transition-all relative overflow-hidden",
                      isOutOfStock && "opacity-40 grayscale"
                    )}
                  >
                    {/* Thumbnail Product Image */}
                    <div className="w-14 h-14 rounded-lg bg-brand-black border border-brand-charcoal overflow-hidden shrink-0 relative flex items-center justify-center">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-brand-steel font-bold text-xs uppercase">{p.brand.substring(0, 2)}</span>
                      )}
                    </div>

                    {/* Product Name, Brand and Stock */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black text-brand-steel uppercase tracking-widest">
                          {p.brand}
                        </span>
                        <span className={cn(
                          "text-[8px] font-bold px-1.5 py-0.2 rounded border",
                          stockLeft <= 0 && "bg-rose-500/20 text-rose-400 border-rose-500/20",
                          stockLeft > 0 && stockLeft <= 5 && "bg-amber-500/20 text-amber-400 border-amber-500/20 animate-pulse",
                          stockLeft > 5 && "bg-brand-black/40 text-brand-steel border-brand-charcoal"
                        )}>
                          {stockLeft <= 0 ? 'Sin Stock' : `Stock: ${stockLeft}`}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-brand-smoke truncate">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-brand-steel mt-0.5 font-mono font-bold">
                        ${p.prices.Minorista.toLocaleString('es-AR')}
                      </p>
                    </div>

                    {/* Controls and Cart Action */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {inActiveCart > 0 && (
                        <div className="flex items-center gap-1 bg-brand-black/40 border border-brand-charcoal rounded-xl">
                          <button
                            onClick={() => updateCartQty(p.id, Math.max(1, inActiveCart - 1))}
                            className="px-2.5 py-1 text-brand-gold hover:bg-brand-charcoal/50 text-xs font-black transition-colors rounded-l-xl cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-brand-smoke min-w-[20px] text-center font-mono">
                            {inActiveCart}
                          </span>
                          <button
                            onClick={() => {
                              if (stockLeft > 0) addToCart(p, 1);
                            }}
                            disabled={isOutOfStock}
                            className="px-2.5 py-1 text-brand-gold hover:bg-brand-charcoal/50 text-xs font-black transition-colors rounded-r-xl cursor-pointer disabled:opacity-20"
                          >
                            +
                          </button>
                        </div>
                      )}
                      
                      <button
                        disabled={isOutOfStock}
                        onClick={() => addToCart(p, 1)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border",
                          inActiveCart > 0
                            ? "bg-brand-wine/10 text-brand-smoke border-brand-wine/40"
                            : "bg-brand-gold text-brand-black border-transparent hover:bg-brand-gold/85"
                        )}
                      >
                        {inActiveCart > 0 ? (
                          'En carro'
                        ) : (
                          <>
                            <Plus size={12} />
                            <span>Agregar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Cart details & Checkout methods */}
        <div className="flex flex-col h-full overflow-hidden bg-brand-charcoal/10 border border-brand-charcoal/30 rounded-2xl p-4">
          
          {/* Section A: Scanner / Credential Student Info */}
          <div className="bg-brand-black/60 border border-brand-charcoal p-3.5 rounded-2xl mb-4 relative shrink-0">
            {!selectedStudent ? (
              <div className="flex flex-col items-center justify-center py-2 text-center">
                <div className="flex items-center gap-2 text-brand-gold font-accent text-lg tracking-widest animate-pulse mb-3">
                  <Barcode size={20} />
                  <span>APROXIMAR CREDENCIAL</span>
                </div>
                
                {/* Search Fallback */}
                <div className="w-full relative flex flex-col gap-2">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={16} />
                    <input
                      type="text"
                      inputMode="none"
                      placeholder="Búsqueda manual de alumno/curso..."
                      className="w-full input-field pl-9 py-1.5 text-xs"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                    />
                  </div>
                  
                  {showSearchDropdown && renderVirtualQwertyKeyboard(studentSearchQuery, setStudentSearchQuery, setShowSearchDropdown)}
                  
                  {showSearchDropdown && filteredStudentsSuggestions.length > 0 && (
                    <div className="absolute top-10 left-0 right-0 mt-1 bg-brand-graphite border border-brand-charcoal rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                      {filteredStudentsSuggestions.map((std) => (
                        <div
                          key={std.id}
                          onClick={() => handleStudentSelect(std)}
                          className="flex justify-between items-center px-4 py-2.5 hover:bg-brand-charcoal transition-colors cursor-pointer text-xs"
                        >
                          <div>
                            <p className="font-bold text-brand-white">{std.name}</p>
                            <p className="text-[10px] text-brand-steel">{std.fantasy_name}</p>
                          </div>
                          <span className="text-[9px] bg-brand-black/60 text-brand-gold px-1.5 py-0.5 rounded font-mono">
                            {std.credential_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showSearchDropdown && studentSearchQuery.trim() && filteredStudentsSuggestions.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-brand-graphite border border-brand-charcoal rounded-xl p-3 text-center text-xs text-brand-steel z-50">
                      Sin coincidencias para "{studentSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold shrink-0">
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-brand-smoke leading-snug">
                      {selectedStudent.name}
                    </h4>
                    <p className="text-[10px] text-brand-steel">
                      {selectedStudent.fantasy_name} • Cred: <span className="font-mono text-brand-gold">{selectedStudent.credential_id}</span>
                    </p>
                    
                    {/* Balance */}
                    <p className="text-xs mt-1">
                      Saldo: {' '}
                      <span className={cn(
                        "font-bold font-mono",
                        selectedStudent.balance < 0 ? "text-rose-400" : selectedStudent.balance > 0 ? "text-emerald-400" : "text-brand-steel"
                      )}>
                        {selectedStudent.balance < 0 
                          ? `-$${Math.abs(selectedStudent.balance).toLocaleString('es-AR')}`
                          : `$${selectedStudent.balance.toLocaleString('es-AR')}`
                        }
                      </span>
                      <span className="text-[9px] text-brand-steel ml-1.5">
                        (Límite: ${selectedStudent.credit_limit?.toLocaleString()})
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveStudent}
                  className="p-1 hover:bg-brand-charcoal text-brand-steel hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title="Desvincular Alumno"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Credit Warning Alert (Visual only) */}
            {selectedStudent && creditLimitDetails.isOverLimit && (
              <div className="mt-2.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-lg flex items-center gap-2 text-rose-400 text-[10px] font-bold">
                <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                <span>⚠️ Límite de crédito excedido por ${Math.abs(selectedStudent.balance - cartTotal + (selectedStudent.credit_limit ?? 10000)).toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>

          {/* Section B: Cart Items List */}
          <div className="flex-1 overflow-y-auto pr-1 mb-4 custom-scrollbar">
            {currentCart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-brand-steel gap-3 py-10">
                <ShoppingCart size={40} strokeWidth={1} />
                <p className="text-xs">Cola vacía. Agrega productos tocando el menú.</p>
              </div>
            ) : (
              <div className="divide-y divide-brand-charcoal">
                {currentCart.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex justify-between items-center gap-3 animate-scale-up">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-xs text-brand-white truncate">{item.name}</h5>
                      <p className="text-[10px] text-brand-steel">${item.prices.Minorista.toLocaleString()}/u</p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-brand-black/40 border border-brand-charcoal rounded-xl">
                      <button
                        onClick={() => updateCartQty(item.id, Math.max(1, item.quantity - 1))}
                        className="px-2.5 py-1 text-brand-gold hover:bg-brand-charcoal/50 text-xs font-black transition-colors rounded-l-xl cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-brand-smoke min-w-[20px] text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.id, item.quantity + 1)}
                        className="px-2.5 py-1 text-brand-gold hover:bg-brand-charcoal/50 text-xs font-black transition-colors rounded-r-xl cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-brand-gold font-mono">
                        ${(item.prices.Minorista * item.quantity).toLocaleString('es-AR')}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-[10px] text-brand-steel hover:text-brand-wine mt-0.5 transition-colors cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Totals and Checkout buttons */}
          <div className="mt-auto border-t border-brand-charcoal pt-4 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs uppercase tracking-widest font-black text-brand-steel">TOTAL</span>
              <span className="text-3xl font-display font-black text-brand-gold font-mono">
                ${cartTotal.toLocaleString('es-AR')}
              </span>
            </div>

            {/* Unified checkout button */}
            <button
              disabled={cartTotal === 0}
              onClick={() => {
                setCheckoutMethod(selectedStudent ? 'Cuenta Corriente' : 'Efectivo');
                setCashInputAmount(cartTotal.toString());
                setShowCheckoutModal(true);
              }}
              className="w-full btn-gold py-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 text-sm font-black uppercase tracking-wider rounded-xl shadow-lg shadow-brand-gold/10 hover:bg-brand-gold/90 transition-all active:scale-95"
            >
              <Coins size={18} />
              Cobrar Venta
            </button>
          </div>
        </div>
      </div>

      {/* Unified Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div 
            className="glass-card max-w-4xl w-full p-6 border-brand-gold/30 shadow-2xl flex flex-col md:flex-row gap-6 animate-scale-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Column: Checkout Summary & Payment Methods */}
            <div className="flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-display font-bold text-brand-gold uppercase flex items-center gap-2">
                    <Coins size={20} /> Cobro de Venta
                  </h3>
                  <button 
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setCheckoutStudentSearchQuery('');
                    }}
                    className="p-1 hover:bg-brand-charcoal text-brand-steel hover:text-white rounded-lg transition-colors cursor-pointer md:hidden"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Tabs to select checkout method */}
                <div className="grid grid-cols-3 gap-2 bg-brand-black/40 border border-brand-charcoal p-1 rounded-xl">
                  {(['Efectivo', 'Cuenta Corriente', 'Mixto'] as const).map((method) => {
                    const isActive = checkoutMethod === method;
                    return (
                      <button
                        key={method}
                        onClick={() => setCheckoutMethod(method)}
                        className={cn(
                          "py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                          isActive
                            ? "bg-brand-gold text-brand-black font-black"
                            : "text-brand-steel hover:text-brand-smoke"
                        )}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>

                {/* Account details & warnings */}
                <div className="space-y-3.5">
                  {/* Linked student display or finder if credit/mixed */}
                  {checkoutMethod !== 'Efectivo' && (
                    <div className="bg-brand-black/60 border border-brand-charcoal p-4 rounded-xl">
                      {!selectedStudent ? (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertTriangle size={14} /> Requiere vincular un Alumno
                          </p>
                          <div className="relative flex flex-col gap-2">
                            <div className="relative w-full">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" size={16} />
                              <input
                                type="text"
                                inputMode="none"
                                placeholder="Buscar alumno para cta cte..."
                                className="w-full input-field pl-9 py-2 text-xs"
                                value={checkoutStudentSearchQuery}
                                onChange={(e) => {
                                  setCheckoutStudentSearchQuery(e.target.value);
                                  setShowCheckoutSearchDropdown(true);
                                }}
                                onFocus={() => setShowCheckoutSearchDropdown(true)}
                              />
                            </div>
                            
                            {showCheckoutSearchDropdown && renderVirtualQwertyKeyboard(checkoutStudentSearchQuery, setCheckoutStudentSearchQuery, setShowCheckoutSearchDropdown)}
                            
                            {showCheckoutSearchDropdown && filteredCheckoutStudentsSuggestions.length > 0 && (
                              <div className="absolute top-11 left-0 right-0 mt-1 bg-brand-graphite border border-brand-charcoal rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto">
                                {filteredCheckoutStudentsSuggestions.map((std) => (
                                  <div
                                    key={std.id}
                                    onClick={() => handleCheckoutStudentSelect(std)}
                                    className="flex justify-between items-center px-4 py-2 hover:bg-brand-charcoal transition-colors cursor-pointer text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-brand-white">{std.name}</p>
                                      <p className="text-[10px] text-brand-steel">{std.fantasy_name}</p>
                                    </div>
                                    <span className="text-[9px] bg-brand-black/60 text-brand-gold px-1.5 py-0.5 rounded font-mono">
                                      {std.credential_id}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <p className="text-[10px] font-black text-brand-steel uppercase tracking-widest">Alumno vinculado</p>
                            <h4 className="font-bold text-sm text-brand-white mt-0.5">{selectedStudent.name}</h4>
                            <p className="text-[10px] text-brand-steel mt-0.5">
                              Saldo actual:{' '}
                              <span className={cn(
                                "font-mono font-bold",
                                selectedStudent.balance < 0 ? "text-rose-400" : "text-emerald-400"
                              )}>
                                ${selectedStudent.balance.toLocaleString('es-AR')}
                              </span>{' '}
                              (Límite: ${selectedStudent.credit_limit?.toLocaleString()})
                            </p>
                          </div>
                          <button
                            onClick={handleRemoveStudent}
                            className="p-1 hover:bg-brand-charcoal text-brand-steel hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          >
                            Desvincular
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary displays depending on active method */}
                  <div className="bg-brand-black/50 border border-brand-charcoal rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase">
                      <span>Total de venta</span>
                      <span className="text-xl font-black font-mono text-brand-white">${cartTotal.toLocaleString()}</span>
                    </div>

                    {checkoutMethod === 'Efectivo' && (
                      <>
                        <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase pt-2 border-t border-brand-charcoal/50">
                          <span>Efectivo Recibido</span>
                          <span className="text-lg font-mono text-brand-gold font-black">${cashInputNumber.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                          <span className="text-xs font-bold text-emerald-400 uppercase">Vuelto a devolver</span>
                          <span className="text-2xl font-black font-mono text-emerald-400">
                            ${Math.max(0, cashInputNumber - cartTotal).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}

                    {checkoutMethod === 'Cuenta Corriente' && selectedStudent && (
                      <div className="pt-2 border-t border-brand-charcoal/50 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase">
                          <span>Importe a Cuenta</span>
                          <span className="text-lg font-mono text-brand-gold font-black">${cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase">
                          <span>Saldo Proyectado</span>
                          <span className={cn(
                            "font-mono font-black",
                            selectedStudent.balance - cartTotal < -(selectedStudent.credit_limit ?? 10000) ? "text-rose-400" : "text-brand-smoke"
                          )}>
                            ${(selectedStudent.balance - cartTotal).toLocaleString('es-AR')}
                          </span>
                        </div>
                        
                        {selectedStudent.balance - cartTotal < -(selectedStudent.credit_limit ?? 10000) && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                            <span>Límite de crédito excedido por ${Math.abs(selectedStudent.balance - cartTotal + (selectedStudent.credit_limit ?? 10000)).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {checkoutMethod === 'Mixto' && selectedStudent && (
                      <div className="pt-2 border-t border-brand-charcoal/50 space-y-3">
                        {/* Portion Field (Selector) */}
                        <div 
                          onClick={() => setActiveMixedField('portion')}
                          className={cn(
                            "flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer",
                            activeMixedField === 'portion'
                              ? "bg-brand-gold/10 border-brand-gold text-brand-white"
                              : "bg-brand-black/30 border-brand-charcoal hover:border-brand-steel/30 text-brand-steel"
                          )}
                        >
                          <div className="text-left">
                            <span className="text-[9px] font-black uppercase tracking-wider block">1. Efectivo a Cobrar</span>
                            <span className="text-xs text-brand-steel block">Porción del total a abonar en caja</span>
                          </div>
                          <span className="text-lg font-mono font-black text-brand-white">
                            ${(parseFloat(mixedCashPortion) || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Delivered Field (Selector) */}
                        <div 
                          onClick={() => setActiveMixedField('delivered')}
                          className={cn(
                            "flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer",
                            activeMixedField === 'delivered'
                              ? "bg-brand-gold/10 border-brand-gold text-brand-white"
                              : "bg-brand-black/30 border-brand-charcoal hover:border-brand-steel/30 text-brand-steel"
                          )}
                        >
                          <div className="text-left">
                            <span className="text-[9px] font-black uppercase tracking-wider block">2. Efectivo Entregado</span>
                            <span className="text-xs text-brand-steel block">Dinero que acerca el cliente</span>
                          </div>
                          <span className="text-lg font-mono font-black text-brand-white">
                            ${(parseFloat(mixedCashDelivered) || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Calculations */}
                        <div className="bg-brand-black/40 border border-brand-charcoal p-3.5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase">
                            <span>Saldo a Cuenta Corriente</span>
                            <span className="text-lg font-mono text-brand-gold font-black">
                              ${calculatedRemainingCreditDebt.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs font-bold text-brand-steel uppercase">
                            <span>Saldo Proyectado Alumno</span>
                            <span className={cn(
                              "font-mono font-black",
                              selectedStudent.balance - calculatedRemainingCreditDebt < -(selectedStudent.credit_limit ?? 10000) ? "text-rose-400" : "text-brand-smoke"
                            )}>
                              ${(selectedStudent.balance - calculatedRemainingCreditDebt).toLocaleString('es-AR')}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs font-bold text-emerald-400 uppercase pt-2 border-t border-brand-charcoal/50">
                            <span>Vuelto a devolver</span>
                            <span className="text-xl font-mono text-emerald-400 font-black">
                              ${Math.max(0, (parseFloat(mixedCashDelivered) || 0) - (parseFloat(mixedCashPortion) || 0)).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {selectedStudent.balance - calculatedRemainingCreditDebt < -(selectedStudent.credit_limit ?? 10000) && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                            <span>Límite de crédito excedido por ${Math.abs(selectedStudent.balance - calculatedRemainingCreditDebt + (selectedStudent.credit_limit ?? 10000)).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setCheckoutStudentSearchQuery('');
                  }}
                  className="flex-1 py-4 bg-brand-charcoal text-brand-smoke rounded-xl font-bold uppercase tracking-wider text-xs border border-brand-steel/15 transition-all hover:bg-brand-steel/10 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  disabled={!isCheckoutValid}
                  onClick={handleConfirmCheckout}
                  className="flex-[2] py-4 btn-gold rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none text-center shadow-lg shadow-brand-gold/5"
                >
                  Confirmar Cobro
                </button>
              </div>
            </div>

            {/* Right Column: Virtual Numeric Keypad (Calculator) */}
            <div className="w-full md:w-[360px] bg-brand-black/50 border border-brand-charcoal p-5 rounded-2xl flex flex-col gap-4 justify-between shrink-0">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-brand-charcoal pb-2">
                  <span className="text-[10px] font-black text-brand-steel uppercase tracking-widest">
                    {checkoutMethod === 'Mixto' 
                      ? (activeMixedField === 'portion' ? 'Mixto: Efectivo a Cobrar' : 'Mixto: Efectivo Entregado')
                      : 'Ingreso Efectivo Recibido'}
                  </span>
                  <button 
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setCheckoutStudentSearchQuery('');
                    }}
                    className="p-1 hover:bg-brand-charcoal text-brand-steel hover:text-white rounded-lg transition-colors cursor-pointer hidden md:block"
                  >
                    <X size={20} />
                  </button>
                </div>

                {checkoutMethod !== 'Cuenta Corriente' ? (
                  <>
                    {/* Simulated Calculator Display */}
                    <div className="bg-brand-black/90 border-2 border-brand-charcoal p-4 rounded-xl flex items-center justify-between shadow-inner">
                      <span className="font-mono text-2xl text-brand-gold font-bold">$</span>
                      <span className="font-mono text-3xl text-brand-white font-black overflow-x-auto scrollbar-none whitespace-nowrap">
                        {checkoutMethod === 'Mixto' 
                          ? (activeMixedField === 'portion' ? mixedCashPortion : mixedCashDelivered)
                          : cashInputAmount}
                      </span>
                    </div>

                    {/* Presets Row */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handlePresetPress(cartTotal)}
                        className="py-2 bg-brand-charcoal/60 hover:bg-brand-charcoal text-brand-gold border border-brand-charcoal/60 rounded-lg text-[10px] font-black uppercase cursor-pointer"
                      >
                        Total
                      </button>
                      {[500, 1000, 2000, 5000, 10000].slice(0, 5).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handlePresetPress(preset)}
                          className="py-2 bg-brand-charcoal/30 hover:bg-brand-charcoal text-brand-smoke border border-brand-charcoal/50 rounded-lg text-xs font-mono font-bold cursor-pointer"
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>

                    {/* Main Keypad Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => {
                        const isAction = key === 'C' || key === '⌫';
                        return (
                          <button
                            key={key}
                            onClick={() => handleKeypadPress(key)}
                            className={cn(
                              "h-14 rounded-xl text-lg font-black transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 border",
                              isAction 
                                ? "bg-brand-wine/10 border-brand-wine/25 text-brand-wine hover:bg-brand-wine/20"
                                : "bg-brand-charcoal/40 border-brand-charcoal/80 text-brand-white hover:bg-brand-charcoal"
                            )}
                          >
                            {key}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  /* Credit helper message */
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-brand-wine/10 border border-brand-wine/30 flex items-center justify-center text-brand-gold animate-pulse">
                      <CreditCard size={40} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-brand-white">Cobro Cuenta Corriente</h4>
                      <p className="text-xs text-brand-steel mt-2 max-w-[240px] leading-relaxed">
                        El total de la venta (${cartTotal.toLocaleString()}) se cargará directamente a la cuenta corriente del alumno. No se requiere cobro de efectivo.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notifications (Alert boxes) */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 z-[999] animate-slide-up">
          <div className={cn(
            "glass-card px-5 py-4 border shadow-2xl flex items-center gap-3.5 max-w-sm rounded-2xl",
            showNotification.type === 'success' && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
            showNotification.type === 'error' && "border-rose-500/30 bg-rose-500/10 text-rose-400",
            showNotification.type === 'info' && "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
          )}>
            <div className="shrink-0">
              {showNotification.type === 'success' && <Check size={20} />}
              {showNotification.type === 'error' && <AlertTriangle size={20} />}
              {showNotification.type === 'info' && <Sparkles size={20} />}
            </div>
            <p className="text-xs font-bold leading-tight">{showNotification.text}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecessTerminal;
