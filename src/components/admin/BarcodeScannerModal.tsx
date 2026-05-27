import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    setIsInitializing(true);
    setErrorMsg(null);

    // Give the DOM a tiny frame to ensure the div exists
    const timer = setTimeout(() => {
      const html5QrCode = new Html5Qrcode('scanner-container', {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      });
      qrCodeRef.current = html5QrCode;

      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            
            // Try to find the main back/rear camera
            const backCam = devices.find((device) => {
              const label = device.label.toLowerCase();
              return label.includes('back') || 
                     label.includes('trasera') || 
                     label.includes('environment') || 
                     label.includes('rear') ||
                     label.includes('dir2') || 
                     label.includes('0'); // Often camera index 0 is rear
            });

            const defaultCamId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(defaultCamId);
            startScanner(html5QrCode, defaultCamId);
          } else {
            setErrorMsg('No se encontraron cámaras en este dispositivo.');
            setIsInitializing(false);
          }
        })
        .catch((err) => {
          console.error('Error getting cameras', err);
          setErrorMsg('Error al acceder a las cámaras. Asegúrate de dar permisos de cámara al navegador.');
          setIsInitializing(false);
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = (html5QrCode: Html5Qrcode, cameraId: string) => {
    setErrorMsg(null);
    setIsInitializing(true);
    
    html5QrCode
      .start(
        cameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            // Wider box tailored for barcodes
            const boxWidth = Math.min(width * 0.85, 320);
            const boxHeight = Math.min(height * 0.35, 120);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333 // 4:3 is more compatible than 16:9 on older devices
        },
        (decodedText) => {
          // Play a small beep using browser Web Audio API
          playBeep();
          onScanSuccess(decodedText);
          onClose();
        },
        () => {
          // Silent ignore scanning failures in real-time
        }
      )
      .then(() => {
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('Error starting scanner', err);
        setErrorMsg('No se pudo iniciar la cámara seleccionada. Prueba con otra de la lista.');
        setIsInitializing(false);
      });
  };

  const stopScanner = () => {
    if (qrCodeRef.current) {
      if (qrCodeRef.current.isScanning) {
        qrCodeRef.current
          .stop()
          .then(() => {
            console.log('Scanner stopped');
          })
          .catch((err) => {
            console.error('Error stopping scanner', err);
          });
      }
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cameraId = e.target.value;
    setSelectedCameraId(cameraId);
    if (qrCodeRef.current) {
      if (qrCodeRef.current.isScanning) {
        qrCodeRef.current.stop()
          .then(() => {
            startScanner(qrCodeRef.current!, cameraId);
          })
          .catch(() => {
            startScanner(qrCodeRef.current!, cameraId);
          });
      } else {
        startScanner(qrCodeRef.current!, cameraId);
      }
    }
  };

  // Browser Audio API to play a scanner "beep"
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz beep
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Low volume
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // 150ms duration
    } catch (e) {
      console.warn('Could not play scan beep', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="glass-card w-full max-w-md p-0 relative z-10 border-brand-gold/30 overflow-hidden shadow-2xl animate-scale-up flex flex-col">
        {/* Header */}
        <div className="bg-brand-gold/10 px-6 py-4 border-b border-brand-gold/20 flex justify-between items-center shrink-0">
          <h3 className="text-sm font-display font-black flex items-center gap-2 text-white uppercase tracking-wider">
            <Camera size={18} className="text-brand-gold" /> Escanear Código
          </h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-brand-gold/20 rounded-full text-brand-steel hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="w-full relative aspect-[4/3] bg-black rounded-2xl border border-brand-charcoal overflow-hidden flex items-center justify-center">
            {/* The html5-qrcode target container */}
            <div id="scanner-container" className="w-full h-full object-cover" />

            {/* Scanning Laser Animation and Guidelines Overlay */}
            {!isInitializing && !errorMsg && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Visual guideline box */}
                <div className="w-[85%] h-[35%] max-w-[320px] max-h-[120px] border-2 border-brand-gold/70 rounded-lg relative shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                  {/* Top-left corner mark */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-brand-gold rounded-tl" />
                  {/* Top-right corner mark */}
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-brand-gold rounded-tr" />
                  {/* Bottom-left corner mark */}
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-brand-gold rounded-bl" />
                  {/* Bottom-right corner mark */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-brand-gold rounded-br" />
                  
                  {/* Red animated laser line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500/80 shadow-[0_0_8px_#f43f5e] animate-scanner-laser" />
                </div>
                <span className="text-[10px] text-brand-steel font-black uppercase tracking-widest mt-4 bg-brand-black/80 px-3 py-1 rounded-full border border-brand-charcoal/50">
                  Alinea el código de barras aquí
                </span>
              </div>
            )}

            {/* Spinner while starting camera */}
            {isInitializing && !errorMsg && (
              <div className="absolute inset-0 bg-brand-black/95 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full border-2 border-brand-gold border-t-transparent w-8 h-8" />
                <span className="text-xs text-brand-steel font-bold uppercase tracking-wider">Iniciando cámara...</span>
              </div>
            )}

            {/* Error Message display */}
            {errorMsg && (
              <div className="absolute inset-0 bg-brand-black/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                <AlertCircle size={32} className="text-rose-400 animate-bounce" />
                <p className="text-xs font-bold text-rose-300 leading-normal max-w-[80%]">{errorMsg}</p>
                <button 
                  onClick={() => {
                    if (qrCodeRef.current) startScanner(qrCodeRef.current, selectedCameraId);
                  }}
                  className="btn-secondary py-1.5 px-4 text-[10px] uppercase font-black tracking-widest mt-2"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>

          {/* Camera Picker */}
          {cameras.length > 1 && (
            <div className="w-full space-y-1.5">
              <label className="text-[8px] font-black uppercase text-brand-steel tracking-widest block">Seleccionar Cámara</label>
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                className="w-full bg-brand-black border border-brand-charcoal rounded-xl px-4 py-2.5 text-xs text-white focus:border-brand-gold outline-none transition-all cursor-pointer font-medium"
              >
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Cámara ${cameras.indexOf(camera) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="text-[10px] text-brand-steel leading-relaxed text-center px-4 max-w-sm">
            Para mejores resultados, sostén el dispositivo firme a unos 10-15 cm del código y asegúrate de que haya buena iluminación.
          </div>
        </div>
      </div>
    </div>
  );
};
