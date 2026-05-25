import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Image as ImageIcon, 
  Globe, 
  Upload, 
  Trash2, 
  AlertCircle, 
  Check, 
  Loader2,
  Sparkles
} from 'lucide-react';

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  productName: string;
  currentImageUrl?: string;
}

interface SearchResult {
  url: string;
  thumbnail: string;
  title?: string;
  source: 'Web';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'url' | 'ia'>('search');
  const [iaPrompt, setIaPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isRealMode, setIsRealMode] = useState(() => localStorage.getItem('copilot_mode') === 'real');

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
  // Perform search with multi-level fallbacks to guarantee results even under Vercel blocks
  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    let data: any = null;
    let searchSuccess = false;
    let errors: string[] = [];

    // Attempt 1: Backend proxy endpoint (Vercel serverless / local dev server)
    try {
      const res = await fetch(`/api/search-images?q=${encodeURIComponent(queryText.trim())}`);
      if (res.ok) {
        data = await res.json();
        searchSuccess = true;
      } else {
        errors.push(`API local retornó código ${res.status}`);
      }
    } catch (err: any) {
      errors.push(`API local falló: ${err.message}`);
    }

    // Attempt 2: MercadoLibre API client-side (completely open with CORS, returns high-quality regional product images)
    if (!searchSuccess) {
      try {
        console.log('API local bloqueada o fallida. Intentando búsqueda en MercadoLibre...');
        const meliUrl = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(queryText.trim())}`;
        const meliRes = await fetch(meliUrl);
        if (meliRes.ok) {
          const meliData = await meliRes.json();
          const items = meliData.results || [];
          if (items.length > 0) {
            data = items.map((item: any) => ({
              // Convert to secure HTTPS and upgrade thumbnail to original high-resolution image (-O.jpg)
              image: item.thumbnail.replace("http://", "https://").replace("-I.jpg", "-O.jpg"),
              thumbnail: item.thumbnail.replace("http://", "https://"),
              title: item.title
            }));
            searchSuccess = true;
            console.log('Búsqueda en MercadoLibre exitosa, resultados:', items.length);
          } else {
            errors.push('MercadoLibre no retornó resultados para esta búsqueda');
          }
        } else {
          errors.push(`MercadoLibre API retornó código ${meliRes.status}`);
        }
      } catch (err: any) {
        errors.push(`MercadoLibre API falló: ${err.message}`);
      }
    }

    // Attempt 3: Client-side fetch via corsproxy.io (works in client browser)
    if (!searchSuccess) {
      try {
        console.log('API local y MercadoLibre fallidas. Intentando proxy alternativo (CORSProxy.io)...');
        const targetHtmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryText.trim())}`;
        const corsHtmlUrl = `https://corsproxy.io/?${encodeURIComponent(targetHtmlUrl)}`;
        const tokenRes = await fetch(corsHtmlUrl);
        if (tokenRes.ok) {
          const tokenHtml = await tokenRes.text();
          const match = tokenHtml.match(/name="vqd"\s+value="([^"]+)"/);
          const vqd = match ? match[1] : '';
          
          if (vqd) {
            const targetImagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(queryText.trim())}&o=json&vqd=${vqd}`;
            const corsImagesUrl = `https://corsproxy.io/?${encodeURIComponent(targetImagesUrl)}`;
            const imagesRes = await fetch(corsImagesUrl);
            if (imagesRes.ok) {
              const imagesData = await imagesRes.json();
              data = imagesData.results || [];
              searchSuccess = true;
            } else {
              errors.push(`corsproxy.io i.js retornó código ${imagesRes.status}`);
            }
          } else {
            errors.push('corsproxy.io no pudo extraer el token VQD');
          }
        } else {
          errors.push(`corsproxy.io html retornó código ${tokenRes.status}`);
        }
      } catch (err: any) {
        errors.push(`CORSProxy.io falló: ${err.message}`);
      }
    }

    // Attempt 4: Client-side fetch via allorigins.win (backup CORS proxy)
    if (!searchSuccess) {
      try {
        console.log('Intentando proxy de respaldo (AllOrigins.win)...');
        const targetHtmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryText.trim())}`;
        const corsHtmlUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetHtmlUrl)}`;
        const tokenRes = await fetch(corsHtmlUrl);
        if (tokenRes.ok) {
          const resData = await tokenRes.json();
          const tokenHtml = resData.contents;
          const match = tokenHtml ? tokenHtml.match(/name="vqd"\s+value="([^"]+)"/) : null;
          const vqd = match ? match[1] : '';
          
          if (vqd) {
            const targetImagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(queryText.trim())}&o=json&vqd=${vqd}`;
            const corsImagesUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetImagesUrl)}`;
            const imagesRes = await fetch(corsImagesUrl);
            if (imagesRes.ok) {
              const imagesData = await imagesRes.json();
              const parsedContents = JSON.parse(imagesData.contents);
              data = parsedContents.results || [];
              searchSuccess = true;
            } else {
              errors.push(`allorigins.win i.js retornó código ${imagesRes.status}`);
            }
          } else {
            errors.push('allorigins.win no pudo extraer el token VQD');
          }
        } else {
          errors.push(`allorigins.win html retornó código ${tokenRes.status}`);
        }
      } catch (err: any) {
        errors.push(`AllOrigins.win falló: ${err.message}`);
      }
    }

    // Final result handling
    if (searchSuccess && data) {
      const results: SearchResult[] = (data || []).map((item: any) => ({
        url: item.image,
        thumbnail: item.thumbnail,
        title: item.title,
        source: 'Web'
      }));

      setSearchResults(results);
      if (results.length === 0) {
        setError(`No se encontraron imágenes comerciales en la web para "${queryText}".`);
      }
    } else {
      console.error('All image search attempts failed:', errors);
      setError(`No se pudo buscar automáticamente (el motor bloqueó el servidor). Por favor, usa el botón "Buscar en Google" abajo para copiar la URL de la imagen y pegarla en "Pegar URL Directa".`);
    }

    setIsLoading(false);
  };

  // Load API config and prefill prompt when opening
  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('gemini_api_key') || '');
      setIsRealMode(localStorage.getItem('copilot_mode') === 'real');
      
      if (productName) {
        const cleaned = cleanProductName(productName);
        setSearchQuery(cleaned);
        performSearch(cleaned);
        
        // A commercial professional studio style product image prompt
        setIaPrompt(`Fotografía profesional de estudio comercial de ${productName}, iluminación de estudio, fondo blanco limpio de catálogo, enfoque nítido, alta resolución, centrado.`);
      }
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

  // Download external image via our proxy and convert it to compressed WebP Base64
  const processImageAndConvertToWebp = async (imageUrl: string) => {
    setIsProcessing(true);
    setProcessingStatus('Descargando y convirtiendo imagen a WebP...');
    setError(null);
    
    try {
      // 1. Fetch image bytes via proxy to bypass CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Error al descargar la imagen a través del proxy del servidor.');
      
      const blob = await res.blob();
      
      // 2. Convert blob to WebP using Canvas
      await new Promise<void>((resolve, reject) => {
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
            URL.revokeObjectURL(img.src);
            resolve();
          } else {
            reject(new Error('No se pudo inicializar el contexto del canvas en 2D.'));
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          reject(new Error('La imagen descargada no tiene un formato válido para procesar.'));
        };

        img.src = URL.createObjectURL(blob);
      });
      
      onClose();
    } catch (err: any) {
      console.error('Error converting image to WebP:', err);
      setError(`No se pudo procesar la imagen en WebP: ${err.message || 'Error de CORS o conexión'}. Asignando URL original como respaldo.`);
      
      // Fallback: assign original URL if proxy/canvas fails
      onSelectImage(imageUrl);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle local file load, canvas WebP conversion, and assign
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Procesando y convirtiendo foto local a WebP...');
    setError(null);
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
          setIsProcessing(false);
          onClose();
        } else {
          setError('Error al procesar la imagen con el Canvas.');
          setIsProcessing(false);
        }
      };

      img.onerror = () => {
        setError('El archivo seleccionado no es una imagen válida.');
        setIsProcessing(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setError('Error al leer el archivo local.');
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  // Helper to convert base64 image data to optimized WebP base64 via Canvas
  const convertBase64ToWebp = (base64Data: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

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
          const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
          resolve(webpDataUrl);
        } else {
          reject(new Error('No se pudo inicializar el contexto del canvas en 2D.'));
        }
      };

      img.onerror = () => {
        reject(new Error('La imagen generada no tiene un formato válido para procesar.'));
      };

      img.src = base64Data;
    });
  };

  // Call the Imagen API using the user's Gemini key with auto-detection and fallbacks
  const handleGenerateAI = async () => {
    if (!iaPrompt.trim()) return;
    if (!apiKey) {
      setError('Clave de API de Gemini no configurada.');
      return;
    }

    setIsGenerating(true);
    setProcessingStatus('Detectando modelos disponibles y generando imagen con IA...');
    setIsProcessing(true);
    setError(null);

    let targetModel = 'imagen-3.0-generate-002'; // default fallback
    let allAvailableModels: string[] = [];
    let detectedImagenModels: string[] = [];

    // Step 1: Detect available models
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const models = listData.models || [];
        allAvailableModels = models.map((m: any) => m.name.replace('models/', ''));
        
        const predictImagenModels = models.filter((m: any) => 
          m.name.includes('imagen') && 
          m.supportedGenerationMethods?.includes('predict')
        );

        detectedImagenModels = models.filter((m: any) => m.name.includes('imagen')).map((m: any) => m.name.replace('models/', ''));

        if (predictImagenModels.length > 0) {
          targetModel = predictImagenModels[0].name.replace('models/', '');
          console.log('Modelo Imagen auto-detectado con éxito:', targetModel);
        } else {
          // Check for any model with 'imagen'
          const anyImagenModel = models.find((m: any) => m.name.includes('imagen'));
          if (anyImagenModel) {
            targetModel = anyImagenModel.name.replace('models/', '');
            console.log('Modelo Imagen alternativo auto-detectado:', targetModel);
          } else {
            console.warn('No se encontraron modelos con "imagen" en los metadatos de la API.');
          }
        }
      } else {
        console.warn(`No se pudo listar modelos (status ${listRes.status}). Usando fallback por defecto.`);
      }
    } catch (listErr) {
      console.error('Error al detectar modelos de la API:', listErr);
    }

    setProcessingStatus(`Generando imagen con IA usando ${targetModel}...`);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:predict?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: iaPrompt
            }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            outputMimeType: 'image/jpeg'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini Imagen API Error:', errorText);

        // Parse API error message to show a user-friendly response
        let apiMessage = '';
        try {
          const apiErrorJson = JSON.parse(errorText);
          apiMessage = apiErrorJson.error?.message || '';
        } catch (e) {}

        if (response.status === 404 || apiMessage.toLowerCase().includes('not found') || apiMessage.toLowerCase().includes('not supported')) {
          if (detectedImagenModels.length > 0) {
            throw new Error(`El modelo ${targetModel} no es soportado. Modelos Imagen disponibles en tu clave: ${detectedImagenModels.join(', ')}`);
          } else if (allAvailableModels.length > 0) {
            throw new Error(`Tu clave de API no tiene acceso a ningún modelo Imagen de generación. Modelos disponibles: ${allAvailableModels.slice(0, 10).join(', ')}...`);
          } else {
            throw new Error(`Modelo ${targetModel} no encontrado o no soportado. Por favor, verifica los permisos y región de tu API Key.`);
          }
        }

        throw new Error(apiMessage || `Error de API (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      const base64Bytes = data.predictions?.[0]?.bytesBase64Encoded;
      const mimeType = data.predictions?.[0]?.mimeType || 'image/jpeg';

      if (!base64Bytes) {
        throw new Error('La respuesta de la API no contiene la imagen generada.');
      }

      const dataUrl = `data:${mimeType};base64,${base64Bytes}`;
      setProcessingStatus('Optimizando y convirtiendo imagen generada a WebP...');
      const webpUrl = await convertBase64ToWebp(dataUrl);

      onSelectImage(webpUrl);
      onClose();
    } catch (err: any) {
      console.error('Error generating AI image:', err);
      setError(`Error al generar con IA: ${err.message || 'Error de conexión con la API.'}`);
    } finally {
      setIsGenerating(false);
      setIsProcessing(false);
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
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 bg-brand-charcoal/20 border border-brand-charcoal hover:border-brand-steel/30 rounded-xl text-brand-steel hover:text-brand-smoke transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-brand-charcoal bg-brand-charcoal/10 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 min-w-[80px] py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            <Search size={12} className="sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Buscar Web</span>
            <span className="xs:hidden">Buscar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 min-w-[80px] py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            <Upload size={12} className="sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Foto Local</span>
            <span className="xs:hidden">Subir</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 min-w-[80px] py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'url'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            <Globe size={12} className="sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Pegar URL</span>
            <span className="xs:hidden">URL</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ia')}
            className={`flex-1 min-w-[90px] py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ia'
                ? 'border-brand-gold text-brand-gold bg-brand-gold/5'
                : 'border-transparent text-brand-steel hover:text-brand-smoke'
            }`}
          >
            <Sparkles size={12} className="sm:w-3.5 sm:h-3.5 text-brand-gold/80" />
            <span>Generar con IA</span>
          </button>
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="bg-brand-gold/10 border-b border-brand-gold/20 px-6 py-4 flex items-center justify-center gap-3 text-xs text-brand-gold font-bold uppercase tracking-wider animate-pulse">
            <Loader2 className="animate-spin" size={16} />
            <span>{processingStatus}</span>
          </div>
        )}

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
                    disabled={isProcessing}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || isProcessing}
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
                    Abre Google Imágenes para el producto actual, copia la dirección de la foto que quieras, y pégala en la pestaña <strong>"Pegar URL Directa"</strong> para descargarla como WebP.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleImagesSearch}
                  className="bg-brand-wine hover:bg-brand-wine/90 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  disabled={isProcessing}
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
                        if (!isProcessing) {
                          processImageAndConvertToWebp(result.url);
                        }
                      }}
                      className={`group relative aspect-square rounded-2xl overflow-hidden border border-brand-charcoal hover:border-brand-gold cursor-pointer bg-brand-charcoal/10 transition-all duration-300 transform hover:scale-102 flex items-center justify-center ${
                        isProcessing ? 'pointer-events-none opacity-55' : ''
                      }`}
                    >
                      <img src={result.thumbnail} alt={result.title || 'Product'} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-brand-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-2 text-center transition-all">
                        <span className="text-[10px] font-black text-brand-gold uppercase tracking-wider mb-1">
                          Guardar WebP
                        </span>
                        <span className="text-[8px] text-brand-steel uppercase font-mono bg-brand-black/80 px-1.5 py-0.5 rounded border border-brand-charcoal">
                          DDG / Google
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
                  disabled={isProcessing}
                />
                <label
                  htmlFor="image-file-upload"
                  className={`border-2 border-dashed border-brand-charcoal hover:border-brand-gold/50 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-brand-charcoal/10 flex flex-col items-center justify-center ${
                    isProcessing ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mx-auto text-brand-gold mb-3 animate-spin" size={32} />
                      <p className="text-xs text-brand-gold font-black uppercase tracking-wider">{processingStatus}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto text-brand-steel mb-3" size={32} />
                      <p className="text-xs text-brand-smoke font-bold">Haz clic aquí para seleccionar una foto</p>
                      <p className="text-[10px] text-brand-steel mt-1.5 leading-relaxed">
                        Soporta JPG, JPEG, PNG, WEBP, GIF. <br />
                        <span className="text-brand-gold/80 font-semibold">La foto se convertirá localmente a formato WebP optimizado antes de guardarse en base de datos.</span>
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
                    disabled={isProcessing}
                  />
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (customImageUrl.trim()) {
                        processImageAndConvertToWebp(customImageUrl.trim());
                      } else {
                        alert('Por favor ingresa una URL de imagen válida.');
                      }
                    }}
                    className="bg-brand-gold text-brand-black hover:bg-brand-gold/90 font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Asignar como WebP
                  </button>
                </div>
                <p className="text-[10px] text-brand-steel leading-normal mt-2">
                  Pega cualquier dirección URL directa de imagen web. El servidor proxy la descargará y convertirá en WebP Base64 para guardarla de manera segura y definitiva.
                </p>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
                  <AlertCircle size={16} />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Active Tab: AI Image Generation */}
          {activeTab === 'ia' && (
            <div className="space-y-6 py-2">
              {!isRealMode || !apiKey ? (
                <div className="bg-brand-charcoal/20 border border-brand-gold/20 p-6 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-brand-gold mt-0.5 flex-shrink-0" size={18} />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-brand-smoke uppercase tracking-wider">
                        API de Gemini / Modo Real no configurado
                      </h4>
                      <p className="text-[10px] text-brand-steel leading-relaxed">
                        Para generar imágenes realistas de tus productos utilizando la inteligencia artificial de Google (Imagen 3), debes configurar la API Key de Gemini y activar el switch de <strong>"API Real"</strong> en el panel de control del Copiloto.
                      </p>
                    </div>
                  </div>
                  <div className="bg-brand-black/40 border border-brand-charcoal p-3.5 rounded-xl space-y-2">
                    <p className="text-[10px] text-brand-smoke font-bold uppercase tracking-wide">¿Cómo configurarlo?</p>
                    <ol className="list-decimal list-inside text-[9px] text-brand-steel space-y-1">
                      <li>Cierra este modal temporalmente.</li>
                      <li>Haz clic en el switch de <strong className="text-brand-gold">Modo Simulado / Real</strong> en la barra de control superior del Copiloto.</li>
                      <li>Introduce tu API Key de Gemini (puedes crear una gratis en Google AI Studio).</li>
                      <li>Regresa aquí y verás habilitada la generación por IA de inmediato.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-steel uppercase tracking-widest block">
                      Descripción para la Generación de Imagen (Prompt)
                    </label>
                    <textarea
                      value={iaPrompt}
                      onChange={(e) => setIaPrompt(e.target.value)}
                      placeholder="Ej. Resma de papel A4 marca Boreal 75gr, empaque color azul, fondo de estudio fotográfico..."
                      rows={4}
                      className="w-full bg-brand-charcoal/20 border border-brand-charcoal focus:border-brand-gold rounded-xl px-4 py-3 text-xs text-brand-smoke focus:outline-none transition-all resize-none leading-relaxed"
                      disabled={isGenerating}
                    />
                    <p className="text-[10px] text-brand-steel leading-normal">
                      Consejo: Cuanto más detallado sea el prompt, más precisa será la imagen. Describe el empaque, colores principales y el estilo del fondo.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isGenerating || !iaPrompt.trim()}
                      onClick={handleGenerateAI}
                      className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-black uppercase text-xs tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Generando con Gemini...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Generar Foto de Producto con IA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-brand-charcoal/10 border-t border-brand-charcoal flex justify-between items-center">
          {currentImageUrl ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                onSelectImage('');
                onClose();
              }}
              className="text-xs text-rose-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} /> Quitar imagen y usar placeholder
            </button>
          ) : (
            <div />
          )}
          <button 
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-5 py-2.5 border border-brand-charcoal hover:border-brand-smoke/30 text-brand-smoke rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
