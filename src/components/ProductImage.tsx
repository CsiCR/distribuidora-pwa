import React, { useState } from 'react';
import { 
  Beer, 
  BookOpen, 
  Sparkles, 
  Package, 
  ShoppingBag, 
  GlassWater,
  X
} from 'lucide-react';

interface ProductImageProps {
  imageUrl?: string;
  category?: string;
  className?: string;
  disableZoom?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({ 
  imageUrl, 
  category = 'Varios', 
  className = 'w-12 h-12 rounded-xl',
  disableZoom = false
}) => {
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Normalize category name for mapping
  const normCategory = category.toLowerCase().trim();

  // Get matching icon and gradient for category
  const getCategoryStyle = () => {
    if (normCategory.includes('cerveza')) {
      return {
        icon: Beer,
        gradient: 'from-amber-500/20 to-orange-600/20 text-amber-400 border-amber-500/30'
      };
    }
    if (normCategory.includes('bebida') || normCategory.includes('gaseosa') || normCategory.includes('jugo')) {
      return {
        icon: GlassWater,
        gradient: 'from-purple-500/20 to-indigo-600/20 text-purple-400 border-purple-500/30'
      };
    }
    if (normCategory.includes('librería') || normCategory.includes('libreria') || normCategory.includes('papel')) {
      return {
        icon: BookOpen,
        gradient: 'from-sky-500/20 to-blue-600/20 text-sky-400 border-sky-500/30'
      };
    }
    if (normCategory.includes('limpieza')) {
      return {
        icon: Sparkles,
        gradient: 'from-teal-500/20 to-emerald-600/20 text-teal-400 border-teal-500/30'
      };
    }
    if (normCategory.includes('almacén') || normCategory.includes('almacen') || normCategory.includes('comida')) {
      return {
        icon: ShoppingBag,
        gradient: 'from-emerald-500/20 to-green-600/20 text-emerald-400 border-emerald-500/30'
      };
    }
    
    // Default fallback style
    return {
      icon: Package,
      gradient: 'from-rose-500/10 to-brand-charcoal/40 text-brand-steel border-brand-charcoal/50'
    };
  };

  const style = getCategoryStyle();
  const IconComponent = style.icon;

  if (imageUrl && !hasError) {
    const handleImageClick = (e: React.MouseEvent) => {
      if (disableZoom) return;
      e.stopPropagation();
      setIsZoomed(true);
    };

    return (
      <>
        <div 
          onClick={handleImageClick}
          className={`overflow-hidden border border-brand-charcoal bg-brand-black/40 flex items-center justify-center group/img relative ${
            disableZoom ? '' : 'cursor-zoom-in'
          } ${className}`}
        >
          <img 
            src={imageUrl} 
            alt={category} 
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              disableZoom ? '' : 'group-hover/img:scale-105'
            }`}
          />
        </div>

        {isZoomed && !disableZoom && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-black/90 backdrop-blur-md p-4 cursor-zoom-out animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(false);
            }}
          >
            <button 
              type="button"
              className="absolute top-4 right-4 text-brand-smoke hover:text-brand-gold p-2 bg-brand-charcoal/50 rounded-full transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
              }}
            >
              <X size={24} />
            </button>
            <div 
              className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-brand-charcoal/80 bg-brand-charcoal/30 shadow-2xl flex flex-col justify-center animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={imageUrl} 
                alt={category} 
                className="max-w-full max-h-[75vh] object-contain rounded-t-2xl"
              />
              <div className="bg-brand-black/60 px-6 py-4 border-t border-brand-charcoal/50 flex justify-between items-center backdrop-blur-md">
                <div>
                  <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest">{category}</p>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomed(false);
                  }}
                  className="px-4 py-1.5 bg-brand-wine text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-rose-900 active:scale-95 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render highly aesthetic gradient icon placeholder (dark mode glassmorphism feel)
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${style.gradient} border backdrop-blur-sm shadow-inner transition-all duration-300 ${className}`} title={category}>
      <IconComponent size={Math.max(16, Math.floor(parseInt(className.match(/\d+/)?.[0] || '12') * 0.45))} />
    </div>
  );
};
