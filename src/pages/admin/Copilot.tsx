import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  DollarSign, 
  Users, 
  HelpCircle,
  Play,
  RotateCcw,
  Loader2,
  Phone,
  Settings,
  Image as ImageIcon
} from 'lucide-react';
import { useStockStore, type Product, WAREHOUSES } from '../../store/useStockStore';
import { useClientsStore, type Client } from '../../store/useClientsStore';
import { useProvidersStore, type Provider } from '../../store/useProvidersStore';
import { useOrdersStore, type Order } from '../../store/useOrdersStore';
import { useTransactionsStore, type Transaction } from '../../store/useTransactionsStore';
import { cn } from '../../lib/utils';
import { ProductImage } from '../../components/ProductImage';
import { ImageSearchModal } from '../../components/admin/ImageSearchModal';

interface Message {
  sender: 'ai' | 'user';
  text: string;
  type?: 'text' | 'table' | 'action_cards' | 'recommendations';
  data?: any;
  timestamp: string;
}

// Helper to extract units per box and presentation for packs
const parsePackInfo = (name: string, presentation: string, aiUnitsPerBox?: number): { presentation: string; units_per_box: number } => {
  if (aiUnitsPerBox && aiUnitsPerBox > 1) {
    return {
      presentation: 'Pack',
      units_per_box: aiUnitsPerBox
    };
  }

  const normName = name.toLowerCase();
  const normPres = presentation.toLowerCase();
  
  // Pattern to match "pack x 12", "pack de 12", "x 12", "x12", etc.
  const packRegex = /(?:pack\s*(?:x|de)?\s*|x\s*)(\d+)\s*(?:unidades|uni|u)?\b/i;
  
  let match = normPres.match(packRegex);
  if (!match) {
    match = normName.match(packRegex);
  }

  if (match) {
    const units = parseInt(match[1], 10);
    if (units > 1) {
      return {
        presentation: 'Pack',
        units_per_box: units
      };
    }
  }

  return {
    presentation: presentation || 'Unidad',
    units_per_box: 1
  };
};

const generateProductSku = (name: string, brand: string): string => {
  const cleanBrand = (brand || 'GEN').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const cleanName = (name || 'PROD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${cleanBrand || 'GEN'}-${cleanName || 'PRD'}-${randomNum}`;
};

// Helper to normalize SKU and Barcode
const normalizeSkuAndBarcode = (
  sku: string, 
  barcode: string, 
  name?: string, 
  brand?: string
): { sku: string; barcode: string } => {
  let cleanSku = sku.trim();
  let cleanBarcode = barcode.trim();

  const isBarcode = (val: string) => /^\d{8,14}$/.test(val);

  // Case 1: SKU is a barcode
  if (isBarcode(cleanSku)) {
    if (!cleanBarcode) {
      cleanBarcode = cleanSku;
    }
    cleanSku = ''; // Clear it from SKU because it is a barcode
  }

  // Case 2: Barcode is not empty, but SKU is a barcode too
  if (cleanBarcode && isBarcode(cleanSku)) {
    cleanSku = '';
  }

  // Case 3: SKU is empty (or was cleared because it was a barcode)
  if (!cleanSku) {
    if (name) {
      cleanSku = generateProductSku(name, brand || 'Generico');
    } else if (cleanBarcode) {
      cleanSku = `SKU-${cleanBarcode.slice(-6)}`;
    } else {
      cleanSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    }
  }

  return { sku: cleanSku, barcode: cleanBarcode };
};

export const Copilot: React.FC = () => {
  const { products, updateProduct, addAuditLog, addProduct } = useStockStore();
  const { clients } = useClientsStore();
  const { providers, addProvider, addInvoice, updateProviderBalance } = useProvidersStore();
  const { orders } = useOrdersStore();
  const { transactions } = useTransactionsStore();

  const [activeTab, setActiveTab] = useState<'assistant' | 'digitizer'>('assistant');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Deposito Central');

  // Real Gemini API & Toggle States
  const [isRealMode, setIsRealMode] = useState(() => localStorage.getItem('copilot_mode') === 'real');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  // Assistant States
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '¡Hola! Soy tu Copiloto Financiero de Distribuidora con IA. Estoy diseñado para ayudarte a tomar decisiones estratégicas sobre tu negocio.\n\nPuedo analizar tus cuentas por cobrar, encontrar productos en sobrestock (capital en riesgo), detectar alertas de abastecimiento, o redactar mensajes de cobranzas.\n\n¿Por qué querés empezar hoy?',
      type: 'text',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Invoice Digitizer States
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'confirmed'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [invoiceMetadata, setInvoiceMetadata] = useState({
    providerName: 'TORRES KARINA NOEMI (EL NUEVO DON BOSCO)',
    cuit: '27-32186639-0',
    invoiceNumber: '00008-00000024',
    date: '18/05/2026',
    total: 154980
  });

  const [qtyInPacks, setQtyInPacks] = useState<Record<number, boolean>>({});

  const [invoiceItemsToProcess, setInvoiceItemsToProcess] = useState<Array<{
    sku: string;
    barcode: string;
    name: string;
    qty: number;
    cost: number;
    brand: string;
    category: string;
    presentation: string;
    units_per_box: number;
    image_url?: string;
  }>>([
    {
      sku: '7792564078160',
      barcode: '7792564078160',
      name: 'Resma Husares A4 75 GRS',
      qty: 15,
      cost: 9196.00,
      brand: 'Husares',
      category: 'Librería',
      presentation: 'Resma',
      units_per_box: 1
    },
    {
      sku: '100141',
      barcode: '',
      name: 'Tapas para Encuadernar A4 X 50',
      qty: 2,
      cost: 12844.15,
      brand: 'Generico',
      category: 'Librería',
      presentation: 'Pack',
      units_per_box: 50
    },
    {
      sku: '100306',
      barcode: '',
      name: 'Espiral 14 MM',
      qty: 50,
      cost: 205.70,
      brand: 'Generico',
      category: 'Librería',
      presentation: 'Unidad',
      units_per_box: 1
    },
    {
      sku: '100307',
      barcode: '',
      name: 'Espiral 20 MM',
      qty: 50,
      cost: 272.25,
      brand: 'Generico',
      category: 'Librería',
      presentation: 'Unidad',
      units_per_box: 1
    }
  ]);

  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [activeImageSearchIdx, setActiveImageSearchIdx] = useState<number | null>(null);

  // Inicializar selección al cambiar los productos leídos de la factura
  useEffect(() => {
    const initialSelection: Record<number, boolean> = {};
    invoiceItemsToProcess.forEach((_, idx) => {
      initialSelection[idx] = true;
    });
    setSelectedRows(initialSelection);
  }, [invoiceItemsToProcess]);

  const handleEditItem = (index: number, field: string, value: any) => {
    setInvoiceItemsToProcess(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  useEffect(() => {
    setQtyInPacks({});
  }, [invoiceItemsToProcess]);
  
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Calculations for AI Context (derived from real stores)
  const deadStockItems = useMemo(() => {
    return products.filter(p => p.status === 'inactivo' || (p.stock_minimo > 0 && p.stock_actual > p.stock_minimo * 3));
  }, [products]);

  const deadStockValue = useMemo(() => {
    return deadStockItems.reduce((acc, p) => acc + (p.stock_actual * (p.cost_price / (p.units_per_box || 1))), 0);
  }, [deadStockItems]);

  const totalOverdueDebts = useMemo(() => {
    return clients.filter(c => c.balance < 0).reduce((acc, c) => acc + Math.abs(c.balance), 0);
  }, [clients]);

  const debtorsCount = useMemo(() => {
    return clients.filter(c => c.balance < 0).length;
  }, [clients]);

  // AI Insights for Strategy Tab
  const insights = useMemo(() => {
    const list = [];
    
    if (debtorsCount > 0) {
      list.push({
        id: 'debtors',
        icon: Users,
        title: 'Recuperar Cuentas por Cobrar',
        desc: `Tenés ${debtorsCount} clientes con saldo deudor pendiente acumulando un total de $${totalOverdueDebts.toLocaleString()}.`,
        severity: 'high',
        actionLabel: 'Analizar Deudores',
        prompt: 'analizar mis cuentas por cobrar y clientes deudores'
      });
    }

    if (deadStockItems.length > 0) {
      list.push({
        id: 'dead_stock',
        icon: DollarSign,
        title: 'Capital Inmovilizado en Sobrestock',
        desc: `Hay ${deadStockItems.length} productos con stock en exceso o inactivos, sumando $${deadStockValue.toLocaleString()} de capital retenido.`,
        severity: 'medium',
        actionLabel: 'Ver Productos Excedentes',
        prompt: 'ver sobrestock y capital inmovilizado'
      });
    }

    // Check low stock
    const lowStockItems = products.filter(p => p.status === 'activo' && p.stock_actual <= p.stock_minimo);
    if (lowStockItems.length > 0) {
      list.push({
        id: 'low_stock',
        icon: AlertTriangle,
        title: 'Riesgo de Quiebre de Stock',
        desc: `Tenés ${lowStockItems.length} productos activos por debajo de su stock mínimo de seguridad.`,
        severity: 'medium',
        actionLabel: 'Planificar Reposición',
        prompt: 'cuales productos estan en quiebre de stock'
      });
    }

    return list;
  }, [products, clients, deadStockItems, deadStockValue, debtorsCount, totalOverdueDebts]);

  // AI Response Simulator (Free of quota usage!)
  const getAIResponse = (userText: string): Message => {
    const text = userText.toLowerCase().trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Welcome / Greeting
    if (text.includes('hola') || text.includes('buen') || text.includes('hola copilot') || text.includes('inicio')) {
      return {
        sender: 'ai',
        text: '¡Hola de nuevo! Estoy listo para analizar tus datos en tiempo real. Podés pedirme:\n\n1. 💸 **"cuentas por cobrar"** para ver deudas de clientes.\n2. 📦 **"sobrestock"** para ver dónde tenés capital inmovilizado.\n3. ⚠️ **"quiebre de stock"** para ver qué mercadería reponer.\n4. 💡 **"analizar negocio"** para una auditoría estratégica general.',
        timestamp
      };
    }

    // Debts & Accounts Receivable
    if (text.includes('deuda') || text.includes('deber') || text.includes('cobrar') || text.includes('atraso') || text.includes('cliente')) {
      const debtorClients = clients.filter(c => c.balance < 0);
      if (debtorClients.length === 0) {
        return {
          sender: 'ai',
          text: '✅ Excelente noticia: **No tenés clientes deudores** registrados con saldo negativo en este momento. Tu cuenta corriente está 100% al día.',
          timestamp
        };
      }

      return {
        sender: 'ai',
        text: `Encontré **${debtorClients.length} clientes con saldo deudor**. En total te deben **$${totalOverdueDebts.toLocaleString()}**.\nAquí tenés el detalle ordenado por monto para que decidas a quién contactar:`,
        type: 'table',
        data: {
          headers: ['Cliente', 'Zona', 'Lista', 'Saldo Deudor', 'Acción Cobro'],
          rows: debtorClients.map(c => ({
            name: c.fantasy_name,
            zone: c.zone,
            priceList: c.price_list,
            balance: `$${Math.abs(c.balance).toLocaleString()}`,
            phone: c.phone,
            action: `Enviar Recordatorio`
          }))
        },
        timestamp
      };
    }

    // Dead Stock / Capital Inmovilizado
    if (text.includes('sobrestock') || text.includes('exceso') || text.includes('inmovilizado') || text.includes('capital') || text.includes('muerto')) {
      if (deadStockItems.length === 0) {
        return {
          sender: 'ai',
          text: '✅ **Inventario Optimizado:** No detecté productos inactivos con stock ni productos que superen 3 veces su stock mínimo sugerido. Tu capital está rotando adecuadamente.',
          timestamp
        };
      }

      return {
        sender: 'ai',
        text: `Detecté **${deadStockItems.length} productos con exceso de stock o inactivos**, representando **$${deadStockValue.toLocaleString()}** de costo neto inmovilizado.\n\nSugerencia: Ofrecer promociones por volumen (ej: pack con descuento) para recuperar la liquidez de estos productos:`,
        type: 'table',
        data: {
          headers: ['Producto', 'Marca', 'Depósito', 'Stock Actual', 'Mínimo', 'Costo Inmovilizado'],
          rows: deadStockItems.map(p => ({
            name: p.short_description || p.name,
            brand: p.brand,
            warehouse: p.warehouse,
            stock: `${p.stock_actual} uni`,
            min: `${p.stock_minimo} uni`,
            cost: `$${(p.stock_actual * (p.cost_price / (p.units_per_box || 1))).toLocaleString()}`
          }))
        },
        timestamp
      };
    }

    // Low stock / Quiebre
    if (text.includes('quiebre') || text.includes('reponer') || text.includes('bajo stock') || text.includes('minimo') || text.includes('mínimo')) {
      const lowStockItems = products.filter(p => p.status === 'activo' && p.stock_actual <= p.stock_minimo);
      if (lowStockItems.length === 0) {
        return {
          sender: 'ai',
          text: '✅ **Todo abastecido:** Todos tus productos activos tienen stock por encima de su stock mínimo de seguridad.',
          timestamp
        };
      }

      return {
        sender: 'ai',
        text: `⚠️ Tenés **${lowStockItems.length} productos en riesgo de quiebre de stock** (stock actual por debajo del mínimo de seguridad). Sugiero emitir pedidos de reposición pronto:`,
        type: 'table',
        data: {
          headers: ['Producto', 'Marca', 'Stock Actual', 'Mínimo Sugerido', 'Costo Reposición (Sugerido)'],
          rows: lowStockItems.map(p => {
            const qtyNeeded = (p.stock_minimo * 2) - p.stock_actual; // suggest buying up to 2x min
            return {
              name: p.short_description || p.name,
              brand: p.brand,
              stock: `${p.stock_actual} uni`,
              min: `${p.stock_minimo} uni`,
              suggestedBuy: `$${(qtyNeeded * (p.cost_price / (p.units_per_box || 1))).toLocaleString()} (${qtyNeeded} uni)`
            };
          })
        },
        timestamp
      };
    }

    // Audit / Business analysis
    if (text.includes('analizar') || text.includes('analisis') || text.includes('negocio') || text.includes('auditoria') || text.includes('reporte')) {
      return {
        sender: 'ai',
        text: `📈 **Diagnóstico Financiero de Distribuidora**\n\nAnalicé la base de datos de stock y cobranzas. Aquí están las métricas clave para la dirección:\n\n* **Cuentas por Cobrar:** Hay $${totalOverdueDebts.toLocaleString()} pendientes de cobro repartidos en ${debtorsCount} clientes.\n* **Eficiencia de Inventario:** Tenés $${deadStockValue.toLocaleString()} inmovilizados en stock inactivo o con sobrestock (>3x mínimo).\n* **Salud Financiera:** La relación capital inmovilizado vs deudas indica que podrías aumentar tu liquidez en un **${Math.round((deadStockValue / (deadStockValue + totalOverdueDebts || 1)) * 100)}%** si liquidas el exceso de inventario.\n\n**Recomendaciones del Copiloto:**\n1. **Campaña de Cobro**: Priorizar la cobranza de clientes con saldos mayores.\n2. **Venta Combo Express**: Armar combos con los productos con exceso de stock para transformarlos en efectivo rápido.\n3. **Optimizar Compras**: Congelar compras de categorías sobreabastecidas.`,
        timestamp
      };
    }

    // Default Fallback
    return {
      sender: 'ai',
      text: `Entendí tu consulta. Como soy un prototipo local que **cuida tu cuota de API**, he analizado tu pregunta. \n\nNo encontré palabras clave específicas como "cuentas por cobrar", "sobrestock", "quiebre de stock" o "analizar negocio". \n\nPor favor, prueba haciendo click en alguna de las sugerencias rápidas abajo o reformula la pregunta para que pueda asistirte con los datos de tu distribuidora.`,
      timestamp
    };
  };

  const buildSystemContext = (
    productsList: Product[],
    clientsList: Client[],
    providersList: Provider[],
    ordersList: Order[],
    txsList: Transaction[]
  ) => {
    return `Eres el Copiloto IA Financiero de la Distribuidora. Tienes acceso en tiempo real a los siguientes datos del negocio:

PRODUCTOS DE STOCK:
${productsList.slice(0, 30).map(p => `- ${p.name} (SKU: ${p.sku}, Stock: ${p.stock_actual}, Reservado: ${p.stock_reservado}, Mínimo: ${p.stock_minimo}, Precio Minorista: $${p.prices.Minorista}, Costo: $${p.cost_price}, Unidades por bulto/pack: ${p.units_per_box || 1})`).join('\n')}

CLIENTES (CUENTAS CORRIENTES):
${clientsList.map(c => `- ${c.fantasy_name} (${c.name}, Balance: $${c.balance} - si es negativo es deuda que el cliente tiene con nosotros, si es positivo es saldo a favor del cliente).`).join('\n')}

PROVEEDORES:
${providersList.map(p => `- ${p.name} (Balance de Deuda: $${p.balance} - si es positivo le debemos este monto al proveedor, si es negativo tenemos saldo a favor).`).join('\n')}

ÚLTIMOS PEDIDOS:
${ordersList.slice(0, 15).map(o => `- ID: ${o.id}, Fecha: ${o.date}, Cliente: ${o.client_name}, Total: $${o.total}, Estado: ${o.status}`).join('\n')}

TRANSACCIONES DE CUENTA CORRIENTE (CLIENTES):
${txsList.slice(0, 15).map(t => `- Cliente: ${t.client_id}, Tipo: ${t.type}, Ref: ${t.reference}, Monto: $${t.amount}, Fecha: ${t.date}, Estado: ${t.status}`).join('\n')}

INSTRUCCIONES:
1. Responde de manera sumamente clara, profesional, ejecutiva y en español de Argentina.
2. Si el usuario te pregunta sobre las deudas o cuentas por cobrar, analiza el balance de los clientes e indica cuáles son los mayores deudores.
3. Si pregunta sobre sobrestock o capital inmovilizado, busca productos con stock_actual > stock_minimo * 3 y calcula cuánto dinero representan utilizando el costo unitario: (cost_price / units_per_box) * stock_actual.
4. Si el usuario te pide un mensaje para reclamar deuda por WhatsApp, redáctalo de manera muy educada pero firme y formal, detallando el saldo del cliente.
5. Puedes formatear las respuestas con negritas, listas o tablas en Markdown si es adecuado.
6. Si te preguntan sobre reposición o quiebre de stock, busca productos con stock_actual <= stock_minimo.
7. Evita mencionar que recibiste este contexto o que eres un modelo externo a menos que sea sumamente necesario; actúa como el Copiloto IA del sistema.
8. REGLA DE CONTEXTO ESTRICTO (ANTI-ALUCINACIÓN): No inventes, supongas o imagines datos financieros, transacciones, clientes, productos o deudas que no estén explícitamente detallados en el contexto arriba listado. Si el usuario realiza una pregunta para la cual no tienes suficiente información en los datos suministrados, explícale de manera clara y profesional qué datos de la distribuidora faltarían registrar en el sistema (por ejemplo, faltan facturas de compra históricas, más días de transacciones, costos de envío, etc.) en lugar de inventar una respuesta o suponer números.`;
  };

  const callGeminiAPI = async (query: string): Promise<Message> => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!apiKey) {
      return {
        sender: 'ai',
        text: '❌ **API Key Faltante**: Por favor, ingresa tu API Key de Gemini haciendo clic en el engranaje del switch de Modo Real para configurar.',
        timestamp
      };
    }

    try {
      const systemContext = buildSystemContext(products, clients, providers, orders, transactions);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemContext}\n\nConsulta del usuario: ${query}` }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Error HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No se recibió texto de respuesta de la API.');
      }

      return {
        sender: 'ai',
        text,
        timestamp
      };
    } catch (error: any) {
      console.error('Error al llamar a Gemini:', error);
      return {
        sender: 'ai',
        text: `❌ **Error de Conexión Real con Gemini IA**:\n${error.message || error}\n\nPor favor, verifica tu API Key o vuelve al **Modo Desarrollo Local (Gratuito)**.`,
        timestamp
      };
    }
  };

  const toggleMode = () => {
    const nextMode = !isRealMode;
    setIsRealMode(nextMode);
    localStorage.setItem('copilot_mode', nextMode ? 'real' : 'local');
    if (nextMode && !apiKey) {
      setIsKeyModalOpen(true);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText;
    const userMsg: Message = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    if (isRealMode) {
      const aiReply = await callGeminiAPI(query);
      setIsTyping(false);
      setMessages(prev => [...prev, aiReply]);
    } else {
      // Simulate AI response delay
      setTimeout(() => {
        setIsTyping(false);
        const aiReply = getAIResponse(query);
        setMessages(prev => [...prev, aiReply]);
      }, 1200);
    }
  };

  const triggerPrompt = (promptText: string) => {
    setInputText(promptText);
    setTimeout(async () => {
      setInputText(promptText);
      // Directly call send simulation
      const userMsg: Message = {
        sender: 'user',
        text: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      if (isRealMode) {
        const aiReply = await callGeminiAPI(promptText);
        setIsTyping(false);
        setMessages(prev => [...prev, aiReply]);
      } else {
        setTimeout(() => {
          setIsTyping(false);
          const aiReply = getAIResponse(promptText);
          setMessages(prev => [...prev, aiReply]);
        }, 1000);
      }
    }, 100);
  };



  const mappedInvoiceProducts = useMemo(() => {
    return invoiceItemsToProcess.map(item => {
      // Find in real store
      const existingProduct = products.find(p => 
        (item.barcode && p.barcode === item.barcode) || 
        (p.sku && p.sku.toLowerCase() === item.sku.toLowerCase())
      );

      const oldCost = existingProduct ? existingProduct.cost_price : 0;
      const costChangePct = oldCost > 0 ? parseFloat(((item.cost - oldCost) / oldCost * 100).toFixed(1)) : 0;

      return {
        id: existingProduct?.id || null,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        qty: item.qty,
        newCost: item.cost,
        oldCost: oldCost,
        costChangePct: costChangePct,
        stockActual: existingProduct ? existingProduct.stock_actual : 0,
        brand: item.brand,
        category: item.category,
        presentation: item.presentation,
        units_per_box: item.units_per_box || (existingProduct ? existingProduct.units_per_box : 1),
        exists: !!existingProduct,
        image_url: item.image_url || existingProduct?.image_url || ''
      };
    });
  }, [products, invoiceItemsToProcess]);

  const handleUploadExample = () => {
    setInvoiceMetadata({
      providerName: 'TORRES KARINA NOEMI (EL NUEVO DON BOSCO)',
      cuit: '27-32186639-0',
      invoiceNumber: '00008-00000024',
      date: '18/05/2026',
      total: 154980
    });
    
    const rawItems = [
      {
        sku: '7792564078160',
        barcode: '7792564078160',
        name: 'Resma Husares A4 75 GRS',
        qty: 15,
        cost: 9196.00,
        brand: 'Husares',
        category: 'Librería',
        presentation: 'Resma'
      },
      {
        sku: '100141',
        barcode: '',
        name: 'Tapas para Encuadernar A4 X 50',
        qty: 2,
        cost: 12844.15,
        brand: 'Generico',
        category: 'Librería',
        presentation: 'Pack x 50'
      },
      {
        sku: '100306',
        barcode: '',
        name: 'Espiral 14 MM',
        qty: 50,
        cost: 205.70,
        brand: 'Generico',
        category: 'Librería',
        presentation: 'Unidad'
      },
      {
        sku: '100307',
        barcode: '',
        name: 'Espiral 20 MM',
        qty: 50,
        cost: 272.25,
        brand: 'Generico',
        category: 'Librería',
        presentation: 'Unidad'
      }
    ];

    setInvoiceItemsToProcess(rawItems.map(item => {
      const packInfo = parsePackInfo(item.name, item.presentation);
      const codes = normalizeSkuAndBarcode(item.sku, item.barcode, item.name, item.brand);
      return {
        sku: codes.sku,
        barcode: codes.barcode,
        name: item.name,
        qty: item.qty,
        cost: item.cost,
        brand: item.brand,
        category: item.category,
        presentation: packInfo.presentation,
        units_per_box: packInfo.units_per_box
      };
    }));
    setFileName('FACTURA-B-NUEVO-DON-BOSCO-00008-00000024.pdf');
    setUploadState('uploading');
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadState('processing');
          
          // Simulate AI processing layout mapping
          setTimeout(() => {
            setUploadState('done');
          }, 1500);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processFileWithGemini = async (file: File) => {
    if (!apiKey) {
      alert('Para procesar facturas reales, por favor configura tu Gemini API Key en el menú de arriba.');
      setUploadState('idle');
      setIsKeyModalOpen(true);
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      const systemPrompt = `Eres un asistente especializado en la digitalización y análisis de facturas y remitos de compra para una distribuidora de mercadería.
Analiza el documento provisto (PDF o imagen) y extrae de forma precisa la información estructurada.
Debes identificar el proveedor, el CUIT del proveedor, el número de factura, la fecha y todos los productos detallados con su cantidad y costo unitario neto.
IMPORTANTE:
1. Si algún producto no tiene código SKU o código de barras, busca si tiene algún código interno en la factura o déjalo vacío.
2. Si detectas un código de barras (generalmente es numérico de 8 a 14 dígitos como EAN-13), ponlo obligatoriamente en el campo "barcode". Si viene bajo la etiqueta SKU o Código de Artículo, sepáralo al campo "barcode" y deja el campo "sku" vacío o con el código corto si lo hay.
3. Si el producto es un pack de X unidades (ej: "Pack x 6", "Pack de 12", "Corona x 12", o en la descripción figura "x 24" o similar), debes colocar la palabra "Pack" en el campo "presentation" y colocar el número de unidades (ej: 6, 12, 24) en el campo "units_per_box". Si no es un pack, "presentation" debe ser "Unidad" (o lo que corresponda como "Resma") y "units_per_box" debe ser 1.
Devuelve un JSON estrictamente con el siguiente esquema y sin marcas de markdown adicionales ni textos explicativos:
{
  "providerName": "nombre completo del proveedor",
  "cuit": "CUIT del proveedor con o sin guiones",
  "invoiceNumber": "número de la factura, ej: 00008-00000024",
  "date": "fecha de emisión, ej: 18/05/2026",
  "total": 154980.00,
  "items": [
    {
      "sku": "código SKU o interno si existe, sino vacío",
      "barcode": "código de barras de 13 dígitos si existe, sino vacío",
      "name": "nombre o descripción clara del producto",
      "qty": 15,
      "cost": 9196.00,
      "brand": "Marca del producto o 'Genérico'",
      "category": "Librería o Bebidas o Limpieza o Almacén o Varios",
      "presentation": "Unidad o Resma o Pack, etc.",
      "units_per_box": 1
    }
  ]
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                },
                {
                  text: systemPrompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Error en la llamada a la API de Gemini (Código ${response.status})`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("No se pudo obtener una respuesta legible de la IA.");
      }

      const parsedData = JSON.parse(rawText.trim());

      if (!parsedData.providerName || !parsedData.items || !Array.isArray(parsedData.items) || parsedData.items.length === 0) {
        throw new Error("El archivo no contiene una estructura de factura reconocible.");
      }

      setInvoiceMetadata({
        providerName: parsedData.providerName || 'Proveedor Desconocido',
        cuit: parsedData.cuit || '00-00000000-0',
        invoiceNumber: parsedData.invoiceNumber || 'Sin número',
        date: parsedData.date || new Date().toLocaleDateString(),
        total: typeof parsedData.total === 'number' ? parsedData.total : 0
      });

      setInvoiceItemsToProcess(parsedData.items.map((item: any) => {
        const name = String(item.name || 'Producto sin descripción');
        const brand = String(item.brand || 'Genérico');
        const originalPresentation = String(item.presentation || 'Unidad');
        const aiUnits = typeof item.units_per_box === 'number' ? item.units_per_box : undefined;
        
        const packInfo = parsePackInfo(name, originalPresentation, aiUnits);
        const codes = normalizeSkuAndBarcode(String(item.sku || ''), String(item.barcode || ''), name, brand);

        return {
          sku: codes.sku,
          barcode: codes.barcode,
          name: name,
          qty: typeof item.qty === 'number' ? item.qty : 1,
          cost: typeof item.cost === 'number' ? item.cost : 0,
          brand: brand,
          category: String(item.category || 'Varios'),
          presentation: packInfo.presentation,
          units_per_box: packInfo.units_per_box
        };
      }));

      setUploadState('done');
    } catch (error: any) {
      console.error("Error al procesar la factura con Gemini:", error);
      alert(`El archivo provisto no pudo ser leído por la IA o no es compatible:\n${error.message || error}\n\nVerifique el documento e intente nuevamente.`);
      setUploadState('idle');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert(`El formato de archivo .${fileExtension || 'desconocido'} no es compatible. Por favor suba un PDF o una imagen (PNG, JPG, JPEG).`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo excede el tamaño máximo permitido de 10MB.');
      return;
    }

    setFileName(file.name);
    setUploadState('uploading');
    setUploadProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setUploadState('processing');

        if (isRealMode) {
          processFileWithGemini(file);
        } else {
          setTimeout(() => {
            setInvoiceMetadata({
              providerName: 'TORRES KARINA NOEMI (EL NUEVO DON BOSCO)',
              cuit: '27-32186639-0',
              invoiceNumber: '00008-00000024',
              date: '18/05/2026',
              total: 154980
            });
            const rawItems = [
              {
                sku: '7792564078160',
                barcode: '7792564078160',
                name: 'Resma Husares A4 75 GRS',
                qty: 15,
                cost: 9196.00,
                brand: 'Husares',
                category: 'Librería',
                presentation: 'Resma'
              },
              {
                sku: '100141',
                barcode: '',
                name: 'Tapas para Encuadernar A4 X 50',
                qty: 2,
                cost: 12844.15,
                brand: 'Generico',
                category: 'Librería',
                presentation: 'Pack x 50'
              },
              {
                sku: '100306',
                barcode: '',
                name: 'Espiral 14 MM',
                qty: 50,
                cost: 205.70,
                brand: 'Generico',
                category: 'Librería',
                presentation: 'Unidad'
              },
              {
                sku: '100307',
                barcode: '',
                name: 'Espiral 20 MM',
                qty: 50,
                cost: 272.25,
                brand: 'Generico',
                category: 'Librería',
                presentation: 'Unidad'
              }
            ];

            setInvoiceItemsToProcess(rawItems.map(item => {
              const packInfo = parsePackInfo(item.name, item.presentation);
              const codes = normalizeSkuAndBarcode(item.sku, item.barcode, item.name, item.brand);
              return {
                sku: codes.sku,
                barcode: codes.barcode,
                name: item.name,
                qty: item.qty,
                cost: item.cost,
                brand: item.brand,
                category: item.category,
                presentation: packInfo.presentation,
                units_per_box: packInfo.units_per_box
              };
            }));
            setUploadState('done');
          }, 1500);
        }
      }
    }, 150);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmInvoice = () => {
    // Process stock imports into store
    mappedInvoiceProducts.forEach((prod, idx) => {
      // Si el ítem no está seleccionado para ingreso, omitimos la carga de stock
      if (selectedRows[idx] === false) return;

      // Find exact product in selected warehouse
      const exactProduct = products.find(p => 
        ((prod.barcode && p.barcode === prod.barcode) || (p.sku && p.sku.toLowerCase() === prod.sku.toLowerCase())) && 
        p.warehouse === selectedWarehouse
      );
      
      const calculatePrice = (cost: number, iva: number, margin: number) => {
        return Math.round((cost * (1 + iva/100) * (1 + margin/100)) / 10) * 10;
      };

      const isInPacks = qtyInPacks[idx] ?? (prod.units_per_box > 1);
      const unitsToAdd = isInPacks ? prod.qty * prod.units_per_box : prod.qty;

      if (exactProduct) {
        // Update stock and cost of existing product in selected warehouse
        updateProduct(exactProduct.id, {
          cost_price: prod.newCost,
          stock_actual: exactProduct.stock_actual + unitsToAdd,
          image_url: prod.image_url || exactProduct.image_url,
          prices: {
            Minorista: calculatePrice(prod.newCost, exactProduct.iva_rate, exactProduct.margins.Minorista),
            Mayorista: calculatePrice(prod.newCost, exactProduct.iva_rate, exactProduct.margins.Mayorista),
            Distribuidor: calculatePrice(prod.newCost, exactProduct.iva_rate, exactProduct.margins.Distribuidor),
          },
          last_update: new Date().toLocaleString()
        });

        addAuditLog({
          id: Math.random().toString(36).substr(2, 9),
          item_id: exactProduct.id,
          item_name: prod.name,
          type: 'ingreso',
          quantity: unitsToAdd,
          reason: `Ingreso automatizado por Copiloto IA (Factura ${invoiceMetadata.invoiceNumber} en ${selectedWarehouse})`,
          timestamp: new Date().toLocaleString(),
          user: 'Copiloto IA'
        });
      } else {
        // Try to find if product exists in another warehouse to clone its metadata
        const sisterProduct = products.find(p => 
          (prod.barcode && p.barcode === prod.barcode) || 
          (p.sku && p.sku.toLowerCase() === prod.sku.toLowerCase())
        );

        if (sisterProduct) {
          // Clone the sister product for the selected warehouse
          const newId = 'prod-' + Math.random().toString(36).substr(2, 9);
          addProduct({
            ...sisterProduct,
            id: newId,
            warehouse: selectedWarehouse,
            stock_actual: unitsToAdd,
            stock_reservado: 0,
            cost_price: prod.newCost,
            image_url: prod.image_url || sisterProduct.image_url,
            prices: {
              Minorista: calculatePrice(prod.newCost, sisterProduct.iva_rate, sisterProduct.margins.Minorista),
              Mayorista: calculatePrice(prod.newCost, sisterProduct.iva_rate, sisterProduct.margins.Mayorista),
              Distribuidor: calculatePrice(prod.newCost, sisterProduct.iva_rate, sisterProduct.margins.Distribuidor),
            },
            last_update: new Date().toLocaleString()
          });

          addAuditLog({
            id: Math.random().toString(36).substr(2, 9),
            item_id: newId,
            item_name: prod.name,
            type: 'ingreso',
            quantity: unitsToAdd,
            reason: `Clonado e ingreso automatizado por Copiloto IA en ${selectedWarehouse} (Factura ${invoiceMetadata.invoiceNumber})`,
            timestamp: new Date().toLocaleString(),
            user: 'Copiloto IA'
          });
        } else {
          // Create a completely new product in the selected warehouse
          const newId = 'prod-' + Math.random().toString(36).substr(2, 9);
          const margins = { Minorista: 30, Mayorista: 20, Distribuidor: 15 };
          const iva_rate = 21;

          addProduct({
            id: newId,
            sku: prod.sku,
            barcode: prod.barcode,
            name: prod.name,
            short_description: prod.name,
            brand: prod.brand || 'Varios',
            category: prod.category || 'Varios',
            presentation: prod.presentation || 'Unidad',
            units_per_box: prod.units_per_box || 1,
            warehouse: selectedWarehouse,
            stock_actual: unitsToAdd,
            stock_reservado: 0,
            stock_minimo: 10,
            cost_price: prod.newCost,
            iva_rate: iva_rate,
            status: 'activo',
            allow_overstock: false,
            margins: margins,
            image_url: prod.image_url,
            prices: {
              Minorista: calculatePrice(prod.newCost, iva_rate, margins.Minorista),
              Mayorista: calculatePrice(prod.newCost, iva_rate, margins.Mayorista),
              Distribuidor: calculatePrice(prod.newCost, iva_rate, margins.Distribuidor)
            },
            last_update: new Date().toLocaleString()
          });

          addAuditLog({
            id: Math.random().toString(36).substr(2, 9),
            item_id: newId,
            item_name: prod.name,
            type: 'ingreso',
            quantity: unitsToAdd,
            reason: `Creación e ingreso por Copiloto IA en ${selectedWarehouse} (Factura ${invoiceMetadata.invoiceNumber})`,
            timestamp: new Date().toLocaleString(),
            user: 'Copiloto IA'
          });
        }
      }
    });

    // 2. Link with the provider and update their Current Account (Cta Cte)
    let provider = providers.find(p => p.cuit === invoiceMetadata.cuit);
    if (!provider) {
      provider = {
        id: 'prov-' + Math.random().toString(36).substring(2, 9),
        name: invoiceMetadata.providerName,
        cuit: invoiceMetadata.cuit,
        tax_condition: 'Monotributista',
        balance: 0,
        email: 'contacto@proveedor.com',
        phone: '11-9999-9999',
        address: 'Dirección Comercial Detectada',
        city: 'CABA',
        status: 'Activo'
      };
      addProvider(provider);
    }

    addInvoice({
      id: 'pinv-' + Math.random().toString(36).substring(2, 9),
      provider_id: provider.id,
      invoice_number: invoiceMetadata.invoiceNumber,
      date: invoiceMetadata.date + ' 12:00',
      warehouse: selectedWarehouse,
      total_net: invoiceMetadata.total * 0.826,
      total_iva: invoiceMetadata.total * 0.174,
      total: invoiceMetadata.total,
      items: mappedInvoiceProducts.map((p, idx) => {
        const isInPacks = qtyInPacks[idx] ?? (p.units_per_box > 1);
        const nameSuffix = p.units_per_box > 1 ? ` (${isInPacks ? 'Pack' : 'Unidades'})` : '';
        return {
          name: p.name + nameSuffix,
          qty: p.qty,
          cost_net: p.newCost,
          iva_rate: 21,
          cost_final: p.newCost * 1.21
        };
      })
    });

    updateProviderBalance(provider.id, invoiceMetadata.total); // Incrementar deuda comercial de la distribuidora
    setUploadState('confirmed');
  };

  const handleResetDigitizer = () => {
    setUploadState('idle');
    setFileName('');
    setUploadProgress(0);
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-10">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-smoke uppercase tracking-tight flex items-center gap-2">
            <Bot className="text-brand-gold" /> Copiloto IA
          </h1>
          <p className="text-brand-steel text-sm font-medium">Asistente estratégico de toma de decisiones y automatización de procesos</p>
        </div>
        
        {/* Toggle Mode Switch */}
        <div className="flex items-center gap-3 bg-brand-charcoal/20 border border-brand-charcoal rounded-xl px-4 py-2">
          <div className="text-right">
            <span className="text-[9px] font-black text-brand-gold uppercase tracking-widest block mb-0.5">Tipo de Copiloto</span>
            <span className="text-xs font-bold text-brand-smoke">
              {isRealMode ? '🤖 Gemini API Real' : '⚡ Simulación Gratuita'}
            </span>
          </div>
          <button 
            onClick={toggleMode}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isRealMode ? "bg-brand-gold" : "bg-brand-charcoal"
            )}
          >
            <span 
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand-black shadow-lg ring-0 transition duration-200 ease-in-out",
                isRealMode ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
          
          {isRealMode && (
            <button 
              onClick={() => setIsKeyModalOpen(true)}
              className="bg-brand-charcoal/40 border border-brand-charcoal hover:border-brand-gold/40 text-brand-smoke hover:text-brand-gold p-1.5 rounded-lg transition-all"
              title="Configurar API Key"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-brand-charcoal gap-6 mb-8">
        <button 
          onClick={() => setActiveTab('assistant')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'assistant' ? 'text-brand-gold' : 'text-brand-steel hover:text-brand-smoke'}`}
        >
          Copiloto Conversacional
          {activeTab === 'assistant' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold" />}
        </button>
        <button 
          onClick={() => setActiveTab('digitizer')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'digitizer' ? 'text-brand-gold' : 'text-brand-steel hover:text-brand-smoke'}`}
        >
          Digitalizador de Facturas
          {activeTab === 'digitizer' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold" />}
        </button>
      </div>

      {activeTab === 'assistant' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chat Column */}
          <div className="lg:col-span-2 flex flex-col h-[600px] glass-card border-brand-charcoal overflow-hidden p-0 relative">
            <div className="p-4 border-b border-brand-charcoal bg-brand-charcoal/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-brand-smoke uppercase tracking-wider">Copiloto Activo</span>
              </div>
              <button 
                onClick={() => setMessages([
                  {
                    sender: 'ai',
                    text: 'Chat reiniciado. ¿En qué puedo ayudarte a decidir hoy?',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ])}
                className="text-brand-steel hover:text-brand-gold transition-colors p-1"
                title="Reiniciar conversación"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Chat Messages Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-brand-black/20">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[85%] rounded-2xl p-4 shadow-xl border
                    ${msg.sender === 'user' 
                      ? 'bg-brand-wine/40 border-brand-wine/60 text-white rounded-br-none' 
                      : 'bg-brand-charcoal border-brand-charcoal/50 text-brand-smoke rounded-bl-none'}
                  `}>
                    
                    {/* Render message text with simple markdown-ish format */}
                    <div className="text-sm leading-relaxed whitespace-pre-line font-medium">
                      {msg.text}
                    </div>

                    {/* Table Render Helper */}
                    {msg.type === 'table' && msg.data && (
                      <div className="mt-4 overflow-x-auto border border-brand-charcoal rounded-xl bg-brand-black/40">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-brand-charcoal border-b border-brand-charcoal/80 text-brand-gold">
                              {msg.data.headers.map((h: string, idx: number) => (
                                <th key={idx} className="px-3 py-2 font-bold uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-charcoal/50">
                            {msg.data.rows.map((row: any, rowIdx: number) => (
                              <tr key={rowIdx} className="hover:bg-brand-charcoal/30">
                                <td className="px-3 py-2.5 font-bold text-brand-smoke">{row.name}</td>
                                {row.zone && <td className="px-3 py-2.5 text-brand-steel">{row.zone}</td>}
                                {row.brand && <td className="px-3 py-2.5 text-brand-steel">{row.brand}</td>}
                                {row.warehouse && <td className="px-3 py-2.5 text-brand-steel">{row.warehouse}</td>}
                                {row.priceList && <td className="px-3 py-2.5 text-brand-steel">{row.priceList}</td>}
                                {row.stock && <td className="px-3 py-2.5 text-brand-smoke font-bold">{row.stock}</td>}
                                {row.min && <td className="px-3 py-2.5 text-brand-steel">{row.min}</td>}
                                {row.balance && <td className="px-3 py-2.5 text-rose-400 font-mono font-bold">{row.balance}</td>}
                                {row.cost && <td className="px-3 py-2.5 text-brand-smoke font-mono font-bold">{row.cost}</td>}
                                {row.suggestedBuy && <td className="px-3 py-2.5 text-brand-gold font-mono font-bold">{row.suggestedBuy}</td>}
                                {row.action && (
                                  <td className="px-3 py-2.5">
                                    <button 
                                      onClick={() => {
                                        const message = `Estimado cliente de *${row.name}*, le escribimos desde la administración de la distribuidora para recordarle su saldo pendiente de cobro de ${row.balance}. Agradecemos su regularización.`;
                                        const phoneNum = row.phone.replace(/\D/g, '') || '';
                                        window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`, '_blank');
                                      }}
                                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-brand-gold text-brand-black px-2 py-1 rounded hover:bg-yellow-400 transition-colors"
                                    >
                                      <Phone size={10} /> Enviar
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <span className="text-[9px] text-brand-steel block mt-2 text-right uppercase font-bold">{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-brand-charcoal border border-brand-charcoal/50 text-brand-smoke rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-brand-gold" />
                    <span className="text-xs text-brand-steel font-bold">El Copiloto está analizando el negocio...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions list */}
            <div className="p-3 border-t border-brand-charcoal bg-brand-charcoal/10 flex flex-wrap gap-2">
              <button 
                onClick={() => triggerPrompt('¿Quiénes son los clientes que me deben dinero?')}
                className="text-[10px] font-bold text-brand-steel bg-brand-charcoal/50 border border-brand-charcoal px-3 py-1.5 rounded-lg hover:border-brand-gold hover:text-brand-gold transition-all"
              >
                💸 Ver deudores
              </button>
              <button 
                onClick={() => triggerPrompt('¿Dónde tengo capital inmovilizado o sobrestock?')}
                className="text-[10px] font-bold text-brand-steel bg-brand-charcoal/50 border border-brand-charcoal px-3 py-1.5 rounded-lg hover:border-brand-gold hover:text-brand-gold transition-all"
              >
                📦 Ver sobrestock
              </button>
              <button 
                onClick={() => triggerPrompt('¿Qué productos tienen bajo stock o están en quiebre?')}
                className="text-[10px] font-bold text-brand-steel bg-brand-charcoal/50 border border-brand-charcoal px-3 py-1.5 rounded-lg hover:border-brand-gold hover:text-brand-gold transition-all"
              >
                ⚠️ Riesgos de stock
              </button>
              <button 
                onClick={() => triggerPrompt('Realizar un diagnóstico estratégico del negocio')}
                className="text-[10px] font-bold text-brand-gold bg-brand-gold/5 border border-brand-gold/20 px-3 py-1.5 rounded-lg hover:bg-brand-gold/10 hover:border-brand-gold transition-all"
              >
                📈 Diagnóstico general
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-brand-charcoal bg-brand-graphite/40 flex gap-3">
              <input 
                type="text" 
                placeholder="Preguntale a la IA sobre stock, deudores, o auditoría..."
                className="flex-1 bg-brand-black/60 border border-brand-charcoal rounded-xl px-4 py-3 text-sm text-brand-smoke outline-none focus:border-brand-gold transition-all"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isTyping}
                className="btn-gold px-5 py-3 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:grayscale"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

          {/* AI Alert & Action Column */}
          <div className="space-y-6">
            <div className="glass-card border-brand-charcoal">
              <h3 className="text-base font-display font-black text-brand-gold mb-4 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} /> Alertas Estratégicas
              </h3>
              <p className="text-xs text-brand-steel leading-relaxed mb-4">La IA monitorea continuamente la salud comercial de la distribuidora. Acciones inmediatas recomendadas para gerencia:</p>
              
              <div className="space-y-4">
                {insights.length === 0 ? (
                  <div className="text-center py-6 text-brand-steel border border-dashed border-brand-charcoal rounded-xl">
                    <CheckCircle className="text-emerald-500 mx-auto mb-2" size={24} />
                    <p className="text-xs font-bold">Todo está bajo control</p>
                  </div>
                ) : (
                  insights.map((item) => (
                    <div key={item.id} className="p-3.5 bg-brand-charcoal/20 border border-brand-charcoal rounded-xl flex flex-col justify-between hover:border-brand-gold/30 transition-all">
                      <div className="flex gap-3 items-start">
                        <div className={`p-2 rounded-lg ${item.severity === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'}`}>
                          <item.icon size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-brand-smoke leading-tight mb-1">{item.title}</h4>
                          <p className="text-[10px] text-brand-steel leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => triggerPrompt(item.prompt)}
                        className="mt-3 w-full bg-brand-charcoal/50 hover:bg-brand-gold hover:text-brand-black text-[10px] font-black uppercase tracking-widest text-brand-smoke py-2 rounded-lg border border-brand-charcoal hover:border-transparent transition-all flex items-center justify-center gap-1.5"
                      >
                        {item.actionLabel} <ArrowRight size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card border-brand-charcoal bg-brand-wine/5 border-brand-wine/10">
              <h4 className="text-xs font-black text-brand-gold uppercase tracking-widest mb-2 flex items-center gap-2">
                <HelpCircle size={14} /> ¿Cómo funciona la IA?
              </h4>
              <p className="text-[10px] text-brand-steel leading-relaxed">
                Esta herramienta ejecuta un motor de análisis inteligente directamente sobre tu base de datos local de ventas, clientes y stock.
                <br/><br/>
                Para proteger tu **cuota de API** de consumo durante el desarrollo y pruebas, el copiloto procesa de manera híbrida: extrae información estructurada de tu estado actual de manera determinista, evitando llamadas innecesarias al servidor, brindándote respuestas inmediatas de valor real a costo cero.
              </p>
            </div>
          </div>

        </div>
      ) : (
        /* Invoice Digitizer Section */
        <div className="glass-card border-brand-charcoal">
          
          <div className="max-w-3xl mx-auto mb-8 text-center">
            <h2 className="text-2xl font-display font-bold text-brand-smoke uppercase mb-2">Digitalizador de Facturas de Proveedores</h2>
            <p className="text-brand-steel text-sm leading-relaxed">
              Subí el PDF de la factura electrónica o remito que te entrega tu proveedor (ej: Quilmes, Coca-Cola). 
              La IA leerá los ítems, cantidades y nuevos costos, mapeará con tu stock y lo cargará en un solo click.
            </p>
          </div>

          {uploadState === 'idle' && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "max-w-lg mx-auto border-2 border-dashed rounded-3xl p-12 text-center transition-all bg-brand-graphite/10 relative group cursor-pointer",
                isDragging 
                  ? "border-brand-gold bg-brand-gold/5 scale-[1.02]" 
                  : "border-brand-charcoal hover:border-brand-gold/50"
              )}
            >
              <input 
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,image/*"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 bg-brand-charcoal rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-steel/20 group-hover:scale-110 transition-transform">
                <Upload className="text-brand-steel group-hover:text-brand-gold transition-colors" size={28} />
              </div>
              <p className="text-sm font-bold text-brand-smoke mb-1">Arrastra tu factura aquí (PDF, PNG, JPG)</p>
              <p className="text-xs text-brand-steel mb-6">Tamaño máximo de archivo: 10MB</p>
              
              <div className="flex justify-center gap-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadExample();
                  }}
                  className="btn-gold px-6 py-3 font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                >
                  <Play size={14} /> Probar con Ejemplo de Factura
                </button>
              </div>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="max-w-md mx-auto p-8 border border-brand-charcoal bg-brand-charcoal/20 rounded-2xl text-center space-y-4">
              <Loader2 size={32} className="animate-spin text-brand-gold mx-auto" />
              <div>
                <p className="text-sm font-bold text-brand-smoke">Subiendo factura...</p>
                <p className="text-xs text-brand-steel mt-1">{fileName}</p>
              </div>
              <div className="w-full bg-brand-black rounded-full h-2 overflow-hidden border border-brand-charcoal">
                <div className="bg-brand-gold h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-[10px] font-mono text-brand-gold font-bold">{uploadProgress}%</p>
            </div>
          )}

          {uploadState === 'processing' && (
            <div className="max-w-md mx-auto p-8 border border-brand-charcoal bg-brand-charcoal/20 rounded-2xl text-center space-y-4 animate-pulse">
              <Bot size={36} className="text-brand-gold mx-auto animate-bounce" />
              <div>
                <p className="text-sm font-bold text-brand-smoke">La IA está procesando el archivo...</p>
                <p className="text-xs text-brand-steel mt-1.5">Leyendo textos mediante OCR, estructurando la tabla y cotejando SKU's...</p>
              </div>
            </div>
          )}

          {uploadState === 'done' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-xs font-bold justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} /> ¡Factura procesada con éxito por la IA! Mapeamos el 100% de los productos encontrados.
                </span>
                <span className="font-mono text-[10px] text-brand-steel">{fileName}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left: Metadata */}
                <div className="lg:col-span-2 glass-card border-brand-charcoal space-y-6">
                  <h3 className="text-sm font-black text-brand-gold uppercase tracking-widest border-b border-brand-charcoal pb-2 flex items-center gap-2">
                    <FileText size={16} /> Datos de la Factura
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] uppercase font-black text-brand-steel tracking-widest">Proveedor</p>
                      <p className="text-sm font-bold text-brand-smoke">{invoiceMetadata.providerName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-black text-brand-steel tracking-widest">Nro de Factura</p>
                      <p className="text-sm font-mono font-bold text-brand-smoke">{invoiceMetadata.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-black text-brand-steel tracking-widest">Fecha Emisión</p>
                      <p className="text-sm font-bold text-brand-smoke">{invoiceMetadata.date}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-black text-brand-steel tracking-widest">CUIT Proveedor</p>
                      <p className="text-sm font-mono font-bold text-brand-smoke">{invoiceMetadata.cuit}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-brand-charcoal/50">
                      <p className="text-[9px] uppercase font-black text-brand-gold tracking-widest">Total Facturado</p>
                      <p className="text-2xl font-display font-black text-brand-smoke">${invoiceMetadata.total.toLocaleString()}</p>
                      <p className="text-[9px] text-brand-steel italic mt-1">
                        (Suma de costos netos de los ítems: ${mappedInvoiceProducts.reduce((acc, curr) => acc + (curr.newCost * curr.qty), 0).toLocaleString()})
                      </p>
                    </div>
                    <div className="col-span-2 pt-4 border-t border-brand-charcoal/50 space-y-2">
                      <label className="text-[10px] font-black text-brand-gold uppercase tracking-wider block">📥 Depósito de Destino (Stock)</label>
                      <select 
                        value={selectedWarehouse}
                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                        className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-xs text-brand-smoke focus:border-brand-gold outline-none font-bold"
                      >
                        {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right: Product Mapping & Cost Audit */}
                <div className="lg:col-span-3 glass-card border-brand-charcoal space-y-6">
                  <h3 className="text-sm font-black text-brand-gold uppercase tracking-widest border-b border-brand-charcoal pb-2">
                    Mapeo de Productos y Auditoría de Costos
                  </h3>

                  <div className="space-y-4">
                    {mappedInvoiceProducts.map((prod, idx) => {
                      const costDiff = prod.newCost - prod.oldCost;
                      const hasIncrease = costDiff > 0 && prod.oldCost > 0;
                      const isSelected = selectedRows[idx] ?? true;

                      return (
                        <div key={idx} className={cn(
                          "p-4 bg-brand-charcoal/30 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 relative",
                          isSelected ? "border-brand-charcoal/80" : "border-brand-charcoal/10 opacity-40 bg-brand-black/10"
                        )}>
                          
                          {/* Checkbox de confirmación parcial */}
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => setSelectedRows(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              className="w-5 h-5 rounded border border-brand-charcoal bg-brand-black text-brand-gold focus:ring-0 cursor-pointer"
                              title={isSelected ? "Excluir de la carga de stock" : "Incluir en la carga de stock"}
                            />
                            
                            {/* Miniatura de Imagen del Producto con Overlay de Edición */}
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-brand-charcoal bg-brand-black/40 group flex-shrink-0">
                              <ProductImage imageUrl={prod.image_url} category={prod.category} className="w-full h-full object-cover" disableZoom />
                              <button 
                                type="button" 
                                onClick={() => { setActiveImageSearchIdx(idx); }} 
                                className="absolute inset-0 bg-brand-black/85 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-bold text-brand-gold cursor-pointer"
                              >
                                <ImageIcon size={14} /> Cambiar
                              </button>
                            </div>

                            {/* Datos Básicos (Editables en línea) */}
                            <div className="flex-1 min-w-[200px]">
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                prod.exists 
                                  ? 'text-brand-gold bg-brand-gold/5 border-brand-gold/20' 
                                  : 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20'
                              }`}>
                                {prod.exists ? 'Coincidencia IA' : '🆕 Producto Nuevo'}
                              </span>
                              
                              <input 
                                type="text"
                                value={prod.name}
                                onChange={(e) => handleEditItem(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-brand-charcoal/80 focus:border-brand-gold text-xs font-bold text-brand-smoke outline-none py-0.5 mt-1 transition-all"
                                title="Editar nombre técnico"
                              />
                              
                              <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                                <div className="flex items-center gap-1 bg-brand-black/35 px-2 py-0.5 rounded border border-brand-charcoal/30">
                                  <span className="text-[8px] text-brand-steel font-bold uppercase">SKU:</span>
                                  <input 
                                    type="text" 
                                    value={prod.sku} 
                                    onChange={(e) => handleEditItem(idx, 'sku', e.target.value)} 
                                    className="bg-transparent text-[10px] font-mono font-bold text-brand-smoke outline-none w-20 py-0" 
                                    title="Editar SKU"
                                  />
                                </div>
                                <div className="flex items-center gap-1 bg-brand-black/35 px-2 py-0.5 rounded border border-brand-charcoal/30">
                                  <span className="text-[8px] text-brand-steel font-bold uppercase">Barras:</span>
                                  <input 
                                    type="text" 
                                    value={prod.barcode} 
                                    onChange={(e) => handleEditItem(idx, 'barcode', e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                    className="bg-transparent text-[10px] font-mono font-bold text-brand-smoke outline-none w-24 py-0" 
                                    placeholder="Sin código"
                                    title="Editar código de barras"
                                  />
                                </div>
                                <div className="flex items-center gap-1 bg-brand-black/35 px-2 py-0.5 rounded border border-brand-charcoal/30">
                                  <span className="text-[8px] text-brand-steel font-bold uppercase">Cat:</span>
                                  <select 
                                    value={prod.category} 
                                    onChange={(e) => handleEditItem(idx, 'category', e.target.value)} 
                                    className="bg-transparent text-[9px] font-bold text-brand-gold outline-none py-0 cursor-pointer"
                                  >
                                    <option value="Cervezas">Cervezas</option>
                                    <option value="Cervezas Artesanales">Cervezas Artesanales</option>
                                    <option value="Bebidas">Bebidas</option>
                                    <option value="Librería">Librería</option>
                                    <option value="Limpieza">Limpieza</option>
                                    <option value="Almacén">Almacén</option>
                                    <option value="Varios">Varios</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Modificadores de Cantidad, Bultos y Costos */}
                          <div className="flex flex-wrap items-center gap-6 justify-end w-full md:w-auto">
                            {prod.units_per_box > 1 && (
                              <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black text-brand-steel uppercase tracking-wider mb-1">Cargar como</span>
                                <div className="flex bg-brand-black p-0.5 rounded-lg border border-brand-charcoal text-[9px] font-black uppercase">
                                  <button
                                    type="button"
                                    onClick={() => setQtyInPacks(prev => ({ ...prev, [idx]: true }))}
                                    className={cn(
                                      "px-2 py-0.5 rounded-[4px] transition-all duration-200 cursor-pointer",
                                      (qtyInPacks[idx] ?? true) ? "bg-brand-gold text-brand-black font-bold" : "text-brand-steel hover:text-white"
                                    )}
                                  >
                                    Pack (x{prod.units_per_box})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQtyInPacks(prev => ({ ...prev, [idx]: false }))}
                                    className={cn(
                                      "px-2 py-0.5 rounded-[4px] transition-all duration-200 cursor-pointer",
                                      (qtyInPacks[idx] === false) ? "bg-brand-wine text-white font-bold" : "text-brand-steel hover:text-white"
                                    )}
                                  >
                                    Unid
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Cantidad Facturada (Editable) */}
                            <div className="text-right min-w-[80px]">
                              <p className="text-[8px] uppercase font-black text-brand-steel tracking-widest">Cant (Factura)</p>
                              <input 
                                type="number" 
                                min="1"
                                value={prod.qty}
                                onChange={(e) => handleEditItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 bg-brand-black/40 border border-brand-charcoal rounded px-2 py-0.5 text-xs font-mono font-bold text-brand-smoke outline-none text-center mt-1 focus:border-brand-gold transition-all"
                              />
                              <p className="text-[9px] text-brand-steel italic mt-0.5">
                                = {((qtyInPacks[idx] ?? (prod.units_per_box > 1)) ? prod.qty * prod.units_per_box : prod.qty)} uni
                              </p>
                            </div>

                            {/* Costo Facturado (Editable) */}
                            <div className="text-right min-w-[90px]">
                              <p className="text-[8px] uppercase font-black text-brand-steel tracking-widest">Costo Unit</p>
                              <input 
                                type="number" 
                                step="0.01"
                                value={prod.newCost}
                                onChange={(e) => handleEditItem(idx, 'cost', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-20 bg-brand-black/40 border border-brand-charcoal rounded px-2 py-0.5 text-xs font-mono font-bold text-brand-smoke outline-none text-center mt-1 focus:border-brand-gold transition-all"
                              />
                              {prod.exists ? (
                                hasIncrease ? (
                                  <p className="text-[9px] text-rose-400 font-bold flex items-center gap-0.5 justify-end mt-0.5">
                                    <AlertTriangle size={8} /> +{prod.costChangePct}%
                                  </p>
                                ) : (
                                  <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Sin cambios</p>
                                )
                              ) : (
                                <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Costo Inicial</p>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-brand-charcoal flex gap-4">
                    <button 
                      onClick={handleResetDigitizer}
                      className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleConfirmInvoice}
                      className="flex-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      Confirmar Carga de Stock y Costos <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {uploadState === 'confirmed' && (
            <div className="max-w-md mx-auto p-10 border border-emerald-500/30 bg-emerald-500/5 rounded-3xl text-center space-y-6 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle size={32} className="text-white" />
              </div>
              
              <div>
                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">¡Stock y Costos Cargados!</h3>
                <p className="text-xs text-brand-steel mt-2 leading-relaxed">
                  Los productos de la factura se importaron con éxito al depósito **{selectedWarehouse}**. Se sumaron las unidades al stock físico actual, se actualizaron los costos de compra netos y se registró el comprobante de compra en la cuenta corriente del proveedor **{invoiceMetadata.providerName}**.
                </p>
              </div>

              <div className="p-3 bg-brand-black/40 rounded-xl border border-brand-charcoal text-left space-y-1.5">
                <p className="text-[10px] text-brand-steel uppercase font-bold tracking-widest">Resumen de Importación:</p>
                {mappedInvoiceProducts.map((prod, idx) => {
                  const isLoaded = selectedRows[idx] ?? true;
                  if (!isLoaded) {
                    return (
                      <p key={idx} className="text-xs text-rose-400/70 font-semibold line-through">
                        • {prod.name}: [EXCLUIDO DE STOCK / DEVOLUCIÓN]
                      </p>
                    );
                  }
                  const isInPacks = qtyInPacks[idx] ?? (prod.units_per_box > 1);
                  const unitsToLoad = isInPacks ? prod.qty * prod.units_per_box : prod.qty;
                  return (
                    <p key={idx} className="text-xs text-brand-smoke font-bold">
                      • {prod.name}: +{unitsToLoad} uni {prod.units_per_box > 1 && `(${prod.qty} ${isInPacks ? 'Pack' : 'Unidades'})`} (Costo: ${prod.newCost.toLocaleString()}) {prod.exists ? '' : ' [NUEVO]'}
                    </p>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleResetDigitizer}
                  className="flex-1 bg-brand-charcoal hover:bg-brand-charcoal/50 text-brand-smoke py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-brand-charcoal"
                >
                  Cargar Otra Factura
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 bg-brand-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-brand-black border border-brand-charcoal rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-brand-charcoal bg-brand-wine/10 flex items-center gap-3">
              <Sparkles className="text-brand-gold animate-pulse" size={24} />
              <div>
                <h3 className="text-lg font-bold text-brand-smoke uppercase tracking-wide">Configurar Gemini API Key</h3>
                <p className="text-[10px] text-brand-steel font-medium">Habilita consultas reales y análisis inteligente completo</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-brand-smoke leading-relaxed">
                El Copiloto Real se conecta directamente con los servidores de Google utilizando tu propia API Key. Las consultas tienen costo cero o mínimo dentro del plan gratuito de Google AI Studio.
              </p>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-steel uppercase tracking-widest">Gemini API Key</label>
                <input 
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-brand-charcoal/40 border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:outline-none focus:border-brand-gold/40 transition-colors"
                />
              </div>
              
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] text-brand-gold hover:underline flex items-center gap-1 font-bold uppercase tracking-wider"
              >
                ¿No tienes una clave? Consigue una gratis aquí <ArrowRight size={12} />
              </a>
            </div>
            
            <div className="p-6 bg-brand-charcoal/20 border-t border-brand-charcoal flex gap-3 justify-end">
              <button 
                onClick={() => {
                  setIsKeyModalOpen(false);
                  if (!apiKey) {
                    setIsRealMode(false);
                    localStorage.setItem('copilot_mode', 'local');
                  }
                }}
                className="px-4 py-2 border border-brand-charcoal hover:border-brand-smoke/30 text-brand-smoke rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  localStorage.setItem('gemini_api_key', apiKey.trim());
                  setIsKeyModalOpen(false);
                  alert('Gemini API Key guardada con éxito.');
                }}
                className="px-5 py-2 bg-brand-gold text-brand-black hover:bg-brand-gold/80 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Búsqueda de Imagen para Copiloto */}
      {activeImageSearchIdx !== null && invoiceItemsToProcess[activeImageSearchIdx] && (
        <ImageSearchModal
          isOpen={activeImageSearchIdx !== null}
          onClose={() => setActiveImageSearchIdx(null)}
          onSelectImage={(url) => handleEditItem(activeImageSearchIdx, 'image_url', url)}
          productName={invoiceItemsToProcess[activeImageSearchIdx].name}
          currentImageUrl={invoiceItemsToProcess[activeImageSearchIdx].image_url}
        />
      )}

    </div>
  );
};
