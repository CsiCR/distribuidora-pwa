import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Image as ImageIcon, 
  Globe, 
  Upload, 
  Trash2, 
  Settings, 
  AlertCircle, 
  Check, 
  Loader2 
} from 'lucide-react';

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  productName: string;
  category: string;
  currentImageUrl?: string;
}

interface SearchResult {
  url: string;
  title?: string;
  source: 'Wikimedia' | 'Openverse' | 'Unsplash';
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  productName,
  currentImageUrl
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [unsplashKey, setUnsplashKey] = useState(() => localStorage.getItem('unsplash_access_key') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'url'>('search');
  const [uploadProgress, setUploadProgress] = useState(false);

  // Clean product name to remove sizes, units, barcodes, etc. for better search accuracy
  const cleanProductName = (name: string): string => {
    let cleaned = name.toUpperCase();
    
    // Remove typical packaging descriptions, capacities, quantities, measures
    cleaned = cleaned.replace(/\b\d+\s*(MM|ML|GRS|GR|G|CM|M|KG|L|UNIDADES|UNIDAD|U|PACK|PK|UN|X|VCS|V)\b/g, '');
    cleaned = cleaned.replace(/\b(A4|OFICIO|CARTA|PULGADAS|HUSARES|KLIP)\b/g, '');
    cleaned = cleaned.replace(/X\s*\d+/g, '');
    cleaned = cleaned.replace(/[0-9]+%/g, ''); // percentages
    cleaned = cleaned.replace(/[\(\)\[\]\+\-\*\/]/g, ' '); // math symbols
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Fallback if cleaning removed too much
    if (cleaned.length < 3) {
      cleaned = name.split(' ').slice(0, 3).join(' ');
    }
    
    return cleaned.toLowerCase();
  };

  // Perform search against Wikimedia Commons, Openverse and optionally Unsplash APIs
  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const results: SearchResult[] = [];
      const queryEncoded = encodeURIComponent(queryText.trim());

      // 1. Wikimedia Commons API
      const wikimediaPromise = fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${queryEncoded}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`
      )
        .then(res => res.json())
        .then(data => {
          if (data.query?.pages) {
            Object.values(data.query.pages).forEach((page: any) => {
              const url = page.imageinfo?.[0]?.url;
              if (url) {
                const lowerUrl = url.toLowerCase();
                // Filter out non-image files like PDFs
                if (
                  lowerUrl.endsWith('.jpg') || 
                  lowerUrl.endsWith('.jpeg') || 
                  lowerUrl.endsWith('.png') || 
                  lowerUrl.endsWith('.webp') || 
                  lowerUrl.endsWith('.gif') ||
                  lowerUrl.endsWith('.svg')
                ) {
                  results.push({
                    url,
                    title: page.title?.replace(/^File:/i, ''),
                    source: 'Wikimedia'
                  });
                }
              }
            });
          }
        })
        .catch(err => console.error('Wikimedia fetch error:', err));

      // 2. Openverse API
      const openversePromise = fetch(
        `https://api.openverse.org/v1/images/?q=${queryEncoded}`
      )
        .then(res => res.json())
        .then(data => {
          if (data.results) {
            data.results.slice(0, 15).forEach((item: any) => {
              if (item.url) {
                results.push({
                  url: item.url,
                  title: item.title,
                  source: 'Openverse'
                });
              }
            });
          }
        })
        .catch(err => console.error('Openverse fetch error:', err));

      // 3. Unsplash API (Optional with User API Key)
      let unsplashPromise = Promise.resolve();
      const currentUnsplashKey = localStorage.getItem('unsplash_access_key');
      if (currentUnsplashKey) {
        unsplashPromise = fetch(
          `https://api.unsplash.com/search/photos?query=${queryEncoded}&client_id=${currentUnsplashKey}&per_page=15`
        )
          .then(res => {
            if (!res.ok) throw new Error('Unauthorized or rate limit reached');
            return res.json();
          })
          .then(data => {
            if (data.results) {
              data.results.forEach((item: any) => {
                if (item.urls?.regular) {
                  results.push({
                    url: item.urls.regular,
                    title: item.alt_description || item.description,
                    source: 'Unsplash'
                  });
                }
              });
            }
          })
          .catch(err => {
            console.error('Unsplash fetch error:', err);
            // Don't fail the whole search if only Unsplash fails
          });
      }

      // Execute all fetches in parallel
      await Promise.all([wikimediaPromise, openversePromise, unsplashPromise]);

      // Deduplicate results by URL
      const uniqueResults = results.filter((item, idx, self) => 
        self.findIndex(t => t.url === item.url) === idx
      );

      setSearchResults(uniqueResults);
      if (uniqueResults.length === 0) {
        setError(`No se encontraron imágenes en la web para "${queryText}".`);
      }
    } catch (err) {
      console.error('Error during image search:', err);
      setError('Error al conectar con los motores de búsqueda web.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize query on open
  useEffect(() => {
    if (isOpen && productName) {
      const cleaned = cleanProductName(productName);
      setSearchQuery(cleaned);
      performSearch(cleaned);
      setCustomImageUrl(currentImageUrl || '');
    }
  }, [isOpen, productName, currentImageUrl]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  // Open Google Images in a new tab
  const handleGoogleImagesSearch = () => {
    const q = encodeURIComponent(searchQuery || productName);
    window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank');
  };

  // Handle local file load, canvas WebP conversion, and assign
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize image to max 800px width/height maintaining aspect ratio
        const MAX_SIZE = 800;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to WebP format with 0.8 quality
          const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
          
          onSelectImage(webpDataUrl);
          setUploadProgress(false);
          onClose();
        } else {
          setError('Error al procesar la imagen con el Canvas.');
          setUploadProgress(false);
        }
      };

      img.onerror = () => {
        setError('El archivo seleccionado no es una imagen válida.');
        setUploadProgress(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setError('Error al leer el archivo local.');
      setUploadProgress(false);
    };

    reader.readAsDataURL(file);
  };

  const handleSaveUnsplashKey = () => {
    localStorage.setItem('unsplash_access_key', unsplashKey.trim());
    setShowConfig(false);
    alert('API Key de Unsplash guardada correctamente.');
    if (searchQuery) {
      performSearch(searchQuery);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-black/95 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
      <div className="bg-brand-black border border-brand-charcoal rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-brand-charcoal bg-brand-wine/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ImageIcon className="text-brand-gold" size={24} />
            <div>
              <h3 className="text-lg font-bold text-brand-smoke uppercase tracking-wide">Buscar Imagen de Producto</h3>
              <p className="text-[10px] text-brand-steel font-medium">Asignar una foto para el catálogo y la terminal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showConfig 
                  ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' 
                  : 'bg-brand-charcoal/20 border-brand-charcoal hover:border-brand-steel/30 text-brand-steel hover:text-brand-smoke'
              }`}
              title="Configurar Unsplash API Key"
            >
              <Settings size={16} />
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="p-2 bg-brand-charcoal/20 border border-brand-charcoal hover:border-brand-steel/30 rounded-xl text-brand-steel hover:text-brand-smoke transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Unsplash Settings Panel */}
        {showConfig && (
          <div className="bg-brand-wine/5 border-b border-brand-charcoal p-6 space-y-4 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2 text-brand-gold text-xs font-black uppercase tracking-wider">
              <Settings size={14} /> Configurar API de Unsplash (Opcional)
            </div>
            <p className="text-[11px] text-brand-steel leading-relaxed">
              Para obtener mejores fotos comerciales de stock en tiempo real, puedes crear una cuenta gratuita en{' '}
              <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer" className="text-brand-gold underline hover:text-brand-gold/80">
                unsplash.com/developers
              </a>{' '}
              e ingresar tu <strong>Access Key</strong> aquí. Si no lo deseas, el sistema utilizará Wikimedia y Openverse.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={unsplashKey}
                onChange={(e) => setUnsplashKey(e.target.value)}
                placeholder="Pegar tu Unsplash Access Key aquí..."
                className="flex-1 bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-xs text-brand-smoke focus:outline-none focus:border-brand-gold/50 font-mono"
              />
              <button
                type="button"
                onClick={handleSaveUnsplashKey}
                className="bg-brand-gold text-brand-black hover:bg-brand-gold/90 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-brand-charcoal bg-brand-charcoal/10">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            Buscar en la Web
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            Cargar Foto Local
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            Pegar URL Directa
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar min-h-[300px]">
          
          {/* Active Tab: Web Search */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-steel" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribir palabras clave del producto..."
                    className="w-full bg-brand-charcoal/20 border border-brand-charcoal focus:border-brand-gold rounded-xl pl-10 pr-4 py-2.5 text-xs text-brand-smoke focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={14} /> : 'Buscar'}
                </button>
              </form>

              {/* Google Images Helper */}
              <div className="bg-brand-charcoal/10 border border-brand-charcoal/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black text-brand-smoke flex items-center gap-1.5 uppercase tracking-wide">
                    <Globe size={14} className="text-brand-gold" /> ¿No encuentras la foto ideal?
                  </p>
                  <p className="text-[10px] text-brand-steel max-w-md leading-relaxed">
                    Abre Google Imágenes para el producto actual, copia la dirección de la foto que quieras, y pégala en la pestaña <strong>"Pegar URL Directa"</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleImagesSearch}
                  className="bg-brand-wine hover:bg-brand-wine/90 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Globe size={14} /> Buscar en Google
                </button>
              </div>

              {/* Error messages */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Results Grid */}
              {isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="aspect-square rounded-2xl border border-brand-charcoal bg-brand-charcoal/10 animate-pulse flex items-center justify-center">
                      <Loader2 className="animate-spin text-brand-steel" size={18} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        onSelectImage(result.url);
                        onClose();
                      }}
                      className="group relative aspect-square rounded-2xl overflow-hidden border border-brand-charcoal hover:border-brand-gold cursor-pointer bg-brand-charcoal/10 transition-all duration-300 transform hover:scale-102 flex items-center justify-center"
                    >
                      <img src={result.url} alt={result.title || 'Product'} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-brand-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-2 text-center transition-all">
                        <span className="text-[10px] font-black text-brand-gold uppercase tracking-wider mb-1">
                          Seleccionar
                        </span>
                        <span className="text-[8px] text-brand-steel uppercase font-mono bg-brand-black/80 px-1.5 py-0.5 rounded border border-brand-charcoal">
                          {result.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Tab: Local Upload with WebP Canvas conversion */}
          {activeTab === 'upload' && (
            <div className="space-y-4 py-4">
              <div className="relative">
                <input
                  type="file"
                  id="image-file-upload"
                  accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
                  onChange={handleLocalFileChange}
                  className="hidden"
                  disabled={uploadProgress}
                />
                <label
                  htmlFor="image-file-upload"
                  className={`border-2 border-dashed border-brand-charcoal hover:border-brand-gold/50 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-brand-charcoal/10 flex flex-col items-center justify-center ${
                    uploadProgress ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {uploadProgress ? (
                    <>
                      <Loader2 className="mx-auto text-brand-gold mb-3 animate-spin" size={32} />
                      <p className="text-xs text-brand-gold font-black uppercase tracking-wider">Procesando y Convirtiendo a WebP...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto text-brand-steel mb-3" size={32} />
                      <p className="text-xs text-brand-smoke font-bold">Haz clic aquí para seleccionar una foto</p>
                      <p className="text-[10px] text-brand-steel mt-1.5 leading-relaxed">
                        Soporta JPG, JPEG, PNG, WEBP, GIF. <br />
                        <span className="text-brand-gold/80 font-semibold">La imagen se redimensionará a máx. 800px y se convertirá a formato WebP optimizado para no ocupar espacio.</span>
                      </p>
                    </>
                  )}
                </label>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
                  <AlertCircle size={16} />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Active Tab: Paste URL */}
          {activeTab === 'url' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-steel uppercase tracking-widest block">URL Directa de Imagen</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://ejemplo.com/imagen-del-producto.jpg"
                    className="flex-1 bg-brand-charcoal/20 border border-brand-charcoal focus:border-brand-gold rounded-xl px-4 py-2.5 text-xs text-brand-smoke focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customImageUrl.trim()) {
                        onSelectImage(customImageUrl.trim());
                        onClose();
                      } else {
                        alert('Por favor ingresa una URL de imagen válida.');
                      }
                    }}
                    className="bg-brand-gold text-brand-black hover:bg-brand-gold/90 font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={14} /> Asignar
                  </button>
                </div>
                <p className="text-[10px] text-brand-steel leading-normal mt-2">
                  Pega cualquier dirección URL directa de imagen web (debe iniciar con http:// o https:// y usualmente terminar en .jpg, .png o .webp).
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-brand-charcoal/10 border-t border-brand-charcoal flex justify-between items-center">
          {currentImageUrl ? (
            <button
              type="button"
              onClick={() => {
                onSelectImage('');
                onClose();
              }}
              className="text-xs text-rose-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={14} /> Quitar imagen y usar placeholder
            </button>
          ) : (
            <div />
          )}
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-brand-charcoal hover:border-brand-smoke/30 text-brand-smoke rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
