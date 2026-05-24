import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Calendar, 
  Award,
  Save,
  CheckCircle2
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

const SettingsManagement: React.FC = () => {
  const store = useSettingsStore();
  
  // Local state for form fields
  const [distributorName, setDistributorName] = useState(store.distributorName);
  const [cuit, setCuit] = useState(store.cuit);
  const [address, setAddress] = useState(store.address);
  const [phone, setPhone] = useState(store.phone);
  const [email, setEmail] = useState(store.email);
  const [ingresosBrutos, setIngresosBrutos] = useState(store.ingresosBrutos);
  const [initActivity, setInitActivity] = useState(store.initActivity);
  const [taxCondition, setTaxCondition] = useState(store.taxCondition);
  
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to Zustand store
    store.setDistributorName(distributorName);
    store.setCuit(cuit);
    store.setAddress(address);
    store.setPhone(phone);
    store.setEmail(email);
    store.setIngresosBrutos(ingresosBrutos);
    store.setInitActivity(initActivity);
    store.setTaxCondition(taxCondition);
    
    // Trigger success notification
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      {/* Title Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <span className="text-[9px] font-black uppercase text-brand-gold tracking-[0.2em] bg-brand-gold/10 px-2 py-1 rounded">
            Panel de Control
          </span>
          <h1 className="text-3xl font-display font-black text-brand-smoke uppercase tracking-tight mt-2">
            CONFIGURACIÓN FISCAL
          </h1>
          <p className="text-[10px] text-brand-steel font-black uppercase tracking-widest mt-1">
            Datos impositivos y membrete del emisor de remitos y facturas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visual Preview of Header */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card border-brand-charcoal p-6 space-y-4 bg-brand-charcoal/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/5 rounded-full blur-2xl" />
            <h3 className="text-[10px] font-black uppercase text-brand-steel tracking-[0.2em] mb-2">Vista Previa Membrete</h3>
            
            <div className="border border-brand-charcoal/50 rounded-xl p-4 bg-brand-black/40 space-y-4">
              <div className="flex justify-between items-start border-b border-brand-charcoal/40 pb-3">
                <div>
                  <h4 className="font-display font-black text-xs text-white uppercase truncate max-w-[120px]">{distributorName || 'SIN NOMBRE'}</h4>
                  <p className="text-[8px] text-brand-steel mt-0.5">{address || 'Sin dirección'}</p>
                  <p className="text-[8px] text-brand-steel">{phone || 'Sin tel'}</p>
                </div>
                <div className="border border-brand-charcoal p-1.5 rounded bg-brand-charcoal/20 text-center flex flex-col items-center justify-center min-w-[32px]">
                  <span className="text-sm font-black text-brand-gold">
                    {taxCondition === 'Responsable Inscripto' ? 'A' : 
                     (taxCondition === 'Monotributista' || taxCondition === 'Exento') ? 'C' : 'B'}
                  </span>
                  <span className="text-[5px] font-bold text-brand-steel leading-[1.2] mt-0.5">Comp.Int.</span>
                </div>
              </div>
              
              <div className="space-y-1 text-[8px] text-brand-steel">
                <p><strong className="text-brand-gold font-bold">CUIT:</strong> {cuit || '00-00000000-0'}</p>
                <p><strong className="text-brand-gold font-bold">IIBB:</strong> {ingresosBrutos || '00-00000000-0'}</p>
                <p><strong className="text-brand-gold font-bold">Inicio Act.:</strong> {initActivity || '00/00/0000'}</p>
                <p><strong className="text-brand-gold font-bold">Cond. IVA:</strong> {taxCondition}</p>
              </div>
            </div>
            
            <p className="text-[10px] text-brand-steel leading-relaxed">
              Los cambios guardados aquí se aplicarán instantáneamente a todos los comprobantes (Facturas Oficiales y Remitos) emitidos en el sistema.
            </p>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="glass-card border-brand-charcoal p-6 space-y-6">
            
            {showSuccess && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold animate-in fade-in duration-200">
                <CheckCircle2 size={16} />
                <span>Configuración fiscal guardada y persistida exitosamente.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Razón Social / Nombre */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <Building2 size={12} className="text-brand-gold" /> Razón Social / Marca
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  value={distributorName}
                  onChange={e => setDistributorName(e.target.value)}
                  placeholder="Ej: DISTRIBUIDORA SUR"
                  required
                />
              </div>

              {/* CUIT */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <FileText size={12} className="text-brand-gold" /> CUIT
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke font-mono focus:border-brand-gold outline-none transition-all" 
                  value={cuit}
                  onChange={e => setCuit(e.target.value)}
                  placeholder="Ej: 30-71122334-9"
                  required
                />
              </div>

              {/* Dirección */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <MapPin size={12} className="text-brand-gold" /> Domicilio Comercial
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Ej: Av. Principal 100, CABA"
                  required
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <Phone size={12} className="text-brand-gold" /> Teléfono
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ej: 11 2222-3333"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <Mail size={12} className="text-brand-gold" /> Email Comercial
                </label>
                <input 
                  type="email" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Ej: info@distribuidora.com"
                  required
                />
              </div>

              {/* Ingresos Brutos */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <FileText size={12} className="text-brand-gold" /> Ingresos Brutos
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke font-mono focus:border-brand-gold outline-none transition-all" 
                  value={ingresosBrutos}
                  onChange={e => setIngresosBrutos(e.target.value)}
                  placeholder="Ej: 30-71122334-9"
                  required
                />
              </div>

              {/* Inicio de Actividades */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-brand-gold" /> Fecha Inicio Actividades
                </label>
                <input 
                  type="text" 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-brand-smoke focus:border-brand-gold outline-none transition-all" 
                  value={initActivity}
                  onChange={e => setInitActivity(e.target.value)}
                  placeholder="Ej: 01/01/2020"
                  required
                />
              </div>

              {/* Condición frente al IVA */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-brand-steel tracking-widest flex items-center gap-1.5 mb-1">
                  <Award size={12} className="text-brand-gold" /> Condición Frente al IVA
                </label>
                <select 
                  className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-gold outline-none font-bold cursor-pointer" 
                  value={taxCondition}
                  onChange={e => setTaxCondition(e.target.value)}
                >
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                  <option value="Exento">Exento</option>
                  <option value="Consumidor Final">Consumidor Final</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 border-t border-brand-charcoal pt-6">
              <button 
                type="submit" 
                className="w-full btn-gold py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-gold/10"
              >
                <Save size={16} /> Guardar Cambios
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsManagement;
