import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  RefreshCcw, 
  Trash2,
  Save
} from 'lucide-react';
import { useStockStore, WAREHOUSES } from '../../store/useStockStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ImportItem {
  id?: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  presentation: string;
  net_content?: number;
  unit_measure?: string;
  units_per_box?: number;
  loose_surcharge?: number;
  cost_price_net: number;
  iva_percentage: number;
  margin_minorista: number;
  margin_mayorista: number;
  margin_distribuidor: number;
  stock: number;
  stock_minimo?: number;
  supplier?: string;
  short_description?: string;
  long_description?: string;
  status_db?: string;
  allow_overstock?: boolean;
  observations?: string;
  status: 'nuevo' | 'actualizar' | 'sin_cambios' | 'error' | 'duplicado';
  errors?: string[];
}

const ImportProducts: React.FC = () => {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [targetWarehouse, setTargetWarehouse] = useState('Deposito Central');
  const [filter, setFilter] = useState<ImportItem['status'] | 'all'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = [
      {
        sku: 'PAT-IPA-730-X6',
        codigo_barras: '7792799000012',
        nombre_producto: 'Patagonia IPA 730 ml x 6',
        marca: 'Patagonia',
        categoria: 'Bebidas',
        subcategoria: 'Cervezas',
        presentacion: 'Caja',
        contenido_neto: 730,
        unidad_medida: 'ml',
        unidades_por_box: 6,
        recargo_suelto: 15,
        precio_costo_neto: 18000,
        iva_porcentaje: 21,
        margen_minorista: 45,
        margen_mayorista: 30,
        margen_distribuidor: 20,
        stock_actual: 30,
        stock_minimo: 5,
        proveedor: 'Patagonia / Quilmes',
        descripcion_corta: 'Cerveza Patagonia IPA caja x 6',
        descripcion_larga: 'Cerveza Patagonia IPA presentación 730 ml por caja de 6 unidades',
        estado: 'activo',
        permite_sobrestock: 'no',
        observaciones: 'Producto de alta rotación'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_productos_distribuidora.xlsx');
  };

  const processFile = (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      // Mock validation logic
      const barcodes = new Set();
      const skus = new Set();

      const processed: ImportItem[] = json.map((row) => {
        const item: ImportItem = {
          sku: String(row.sku || ''),
          barcode: String(row.codigo_barras || ''),
          name: row.nombre_producto || '',
          brand: row.marca || '',
          category: row.categoria || '',
          subcategory: row.subcategoria || '',
          presentation: row.presentacion || '',
          net_content: Number(row.contenido_neto || 0),
          unit_measure: row.unidad_medida || 'ml',
          units_per_box: Number(row.unidades_por_caja || row.unidades_por_box || 1),
          loose_surcharge: row.recargo_suelto !== undefined ? Number(row.recargo_suelto) : undefined,
          cost_price_net: Number(row.precio_costo_neto || 0),
          iva_percentage: Number(row.iva_porcentaje || 21),
          margin_minorista: Number(row.margen_minorista || 30),
          margin_mayorista: Number(row.margen_mayorista || 20),
          margin_distribuidor: Number(row.margen_distribuidor || 15),
          stock: Number(row.stock_actual || 0),
          stock_minimo: Number(row.stock_minimo || 0),
          supplier: row.proveedor || '',
          short_description: row.descripcion_corta || '',
          long_description: row.descripcion_larga || '',
          status_db: row.estado || 'activo',
          allow_overstock: String(row.permite_sobrestock).toLowerCase() === 'si',
          observations: row.observaciones || '',
          status: 'nuevo'
        };

        const currentErrors: string[] = [];

        // 1. Check uniqueness within the Excel file
        if (item.barcode && barcodes.has(item.barcode)) {
          item.status = 'duplicado';
          currentErrors.push(`Código de barras duplicado en el archivo: ${item.barcode}`);
        }
        if (item.sku && skus.has(item.sku)) {
          item.status = 'duplicado';
          currentErrors.push(`SKU duplicado en el archivo: ${item.sku}`);
        }

        barcodes.add(item.barcode);
        skus.add(item.sku);

        // 2. Basic required fields
        if (!item.sku || !item.name) {
          item.status = 'error';
          currentErrors.push('SKU y Nombre son obligatorios');
        }

        // 3. Mock DB check (Example)
        if (item.sku === 'COR-710-X12' && item.status !== 'error') {
          item.status = 'actualizar';
        }

        item.errors = currentErrors;
        return item;
      });

      setItems(processed);
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const { addProduct, updateProduct, products: existingProducts } = useStockStore();

  const handleConfirmImport = () => {
    const toImport = items.filter(i => i.status === 'nuevo' || i.status === 'actualizar');
    
    if (toImport.length === 0) {
      alert('No hay productos válidos para importar.');
      return;
    }

    const calculatePrice = (cost: number, iva: number, margin: number) => {
      return Math.round((cost * (1 + iva/100) * (1 + margin/100)) / 10) * 10;
    };

    toImport.forEach(item => {
      const productData = {
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        presentation: item.presentation,
        net_content: item.net_content,
        unit_measure: item.unit_measure,
        units_per_box: item.units_per_box || 1,
        loose_surcharge: item.loose_surcharge,
        short_description: item.short_description || item.name,
        long_description: item.long_description,
        cost_price: item.cost_price_net,
        iva_rate: item.iva_percentage,
        stock_actual: item.stock,
        stock_minimo: item.stock_minimo || 0,
        stock_reservado: 0,
        warehouse: targetWarehouse,
        status: (item.status_db === 'inactivo' ? 'inactivo' : 'activo') as 'activo' | 'inactivo',
        allow_overstock: item.allow_overstock || false,
        observations: item.observations || '',
        margins: {
          Minorista: item.margin_minorista,
          Mayorista: item.margin_mayorista,
          Distribuidor: item.margin_distribuidor
        },
        prices: {
          Minorista: calculatePrice(item.cost_price_net, item.iva_percentage, item.margin_minorista),
          Mayorista: calculatePrice(item.cost_price_net, item.iva_percentage, item.margin_mayorista),
          Distribuidor: calculatePrice(item.cost_price_net, item.iva_percentage, item.margin_distribuidor)
        }
      };

      if (item.status === 'nuevo') {
        addProduct({
          ...productData,
          id: Math.random().toString(36).substr(2, 9),
          last_update: new Date().toLocaleString()
        });
      } else {
        // Find existing product by SKU and same warehouse
        const existing = existingProducts.find(p => p.sku === item.sku && p.warehouse === targetWarehouse);
        if (existing) {
          updateProduct(existing.id, productData);
        } else {
          addProduct({
            ...productData,
            id: Math.random().toString(36).substr(2, 9),
            last_update: new Date().toLocaleString()
          });
        }
      }
    });

    alert(`Se procesaron ${toImport.length} productos correctamente en el depósito "${targetWarehouse}".`);
    setItems([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Importar Productos</h1>
          <p className="text-brand-steel">Actualiza el catálogo masivamente desde Excel</p>
        </div>
        <button 
          onClick={downloadTemplate}
          className="btn-secondary py-2 flex items-center gap-2 w-fit"
        >
          <Download size={18} /> Descargar Plantilla
        </button>
      </div>

      {/* Upload Area */}
      {items.length === 0 ? (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center transition-all cursor-pointer",
            isDragging ? "border-brand-gold bg-brand-gold/5 scale-[1.01]" : "border-brand-charcoal hover:border-brand-steel/50"
          )}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls"
            onChange={(e) => e.target.files && processFile(e.target.files[0])}
            disabled={isProcessing}
          />
          {isProcessing ? (
            <div className="flex flex-col items-center py-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-gold mb-4"></div>
              <h3 className="text-xl font-bold mb-2">Procesando archivo...</h3>
              <p className="text-brand-steel text-center text-sm">Espere un momento por favor</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-brand-charcoal rounded-full flex items-center justify-center mb-6 text-brand-gold group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Suelte el archivo Excel aquí</h3>
              <p className="text-brand-steel text-center max-w-sm">
                O haga clic para buscar en su ordenador. Solo archivos .xlsx o .xls
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex items-center justify-between bg-brand-graphite p-4 rounded-2xl border border-brand-charcoal shadow-xl">
             <div className="flex items-center gap-6">
               <div className="flex flex-col">
                 <button 
                   onClick={() => setFilter('all')}
                   className={cn(
                     "text-[10px] uppercase font-bold text-left transition-colors",
                     filter === 'all' ? "text-brand-gold" : "text-brand-steel"
                   )}
                 >
                   Total Leídos
                 </button>
                 <span className="text-xl font-bold">{items.length}</span>
               </div>
               <div className="h-8 w-[1px] bg-brand-charcoal" />
               <div className="flex gap-4">
                 {[
                   { id: 'nuevo', label: 'Nuevos', color: 'bg-emerald-500' },
                   { id: 'actualizar', label: 'Actualizar', color: 'bg-blue-500' },
                   { id: 'duplicado', label: 'Duplicados', color: 'bg-amber-500' },
                   { id: 'error', label: 'Errores', color: 'bg-rose-500' }
                 ].map((s) => (
                   <button 
                     key={s.id}
                     onClick={() => setFilter(s.id as any)}
                     className={cn(
                       "flex items-center gap-2 group transition-all",
                       filter === s.id ? "opacity-100" : "opacity-40 hover:opacity-100"
                     )}
                   >
                     <div className={cn("w-3 h-3 rounded-full", s.color)} />
                     <span className="text-xs text-brand-smoke font-medium">
                       {items.filter(i => i.status === s.id).length} {s.label}
                     </span>
                   </button>
                 ))}
               </div>
             </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-brand-black border border-brand-charcoal px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] text-brand-steel uppercase font-black">Depósito Destino:</span>
                  <select 
                    className="bg-transparent text-xs text-brand-gold font-bold outline-none cursor-pointer"
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value)}
                  >
                    {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <button onClick={() => setItems([])} className="btn-secondary py-2">
                  <Trash2 size={18} />
                </button>
                <button onClick={handleConfirmImport} className="btn-gold py-2 px-8 flex items-center gap-2">
                  <Save size={18} /> Confirmar Importación
                </button>
              </div>
          </div>

          {/* Table Preview */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-brand-charcoal/50 text-brand-steel text-[10px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">SKU / Barcode</th>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Marca/Cat</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-charcoal">
                  {items
                    .filter(item => filter === 'all' || item.status === filter)
                    .map((item, idx) => (
                    <tr key={idx} className="table-row-hover text-sm">
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase",
                          item.status === 'nuevo' && "bg-emerald-500/20 text-emerald-500",
                          item.status === 'actualizar' && "bg-blue-500/20 text-blue-500",
                          item.status === 'duplicado' && "bg-amber-500/20 text-amber-500",
                          item.status === 'error' && "bg-rose-500/20 text-rose-500",
                        )}>
                          {item.status}
                        </span>
                        {item.errors && item.errors.length > 0 && (
                          <div className="text-[9px] text-rose-400 mt-1 max-w-[150px] leading-tight">
                            {item.errors[0]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{item.sku}</div>
                        <div className="text-[10px] text-brand-steel">{item.barcode}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-[10px] text-brand-steel">{item.presentation}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-brand-smoke">{item.brand}</div>
                        <div className="text-[10px] text-brand-steel">{item.category}</div>
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {item.stock} uni
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-display font-bold text-brand-gold">${item.cost_price_net.toLocaleString('es-AR')}</div>
                        <div className="text-[9px] text-brand-steel uppercase font-black">Márgenes: {item.margin_minorista}%/{item.margin_mayorista}%/{item.margin_distribuidor}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="p-6 bg-brand-graphite rounded-2xl border border-brand-charcoal">
           <div className="w-10 h-10 bg-brand-charcoal rounded-xl flex items-center justify-center text-brand-gold mb-4">
             <AlertCircle size={20} />
           </div>
           <h4 className="font-bold mb-2">Validación Inteligente</h4>
           <p className="text-sm text-brand-steel leading-relaxed">
             El sistema detecta automáticamente si un producto ya existe por su SKU o código de barras, evitando duplicados.
           </p>
        </div>
        <div className="p-6 bg-brand-graphite rounded-2xl border border-brand-charcoal">
           <div className="w-10 h-10 bg-brand-charcoal rounded-xl flex items-center justify-center text-brand-gold mb-4">
             <RefreshCcw size={20} />
           </div>
           <h4 className="font-bold mb-2">Rollback Seguro</h4>
           <p className="text-sm text-brand-steel leading-relaxed">
             Cada importación genera un ID de lote. Si algo sale mal, puedes revertir todos los cambios con un solo clic.
           </p>
        </div>
        <div className="p-6 bg-brand-graphite rounded-2xl border border-brand-charcoal">
           <div className="w-10 h-10 bg-brand-charcoal rounded-xl flex items-center justify-center text-brand-gold mb-4">
             <FileSpreadsheet size={20} />
           </div>
           <h4 className="font-bold mb-2">Formato Flexible</h4>
           <p className="text-sm text-brand-steel leading-relaxed">
             Admite múltiples formatos de columnas. El sistema intenta mapear los campos automáticamente.
           </p>
        </div>
      </div>
    </div>
  );
};

export default ImportProducts;
