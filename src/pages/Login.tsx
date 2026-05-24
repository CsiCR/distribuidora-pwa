import React from 'react';
import { LogIn, User } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

const Login: React.FC = () => {
  const distributorName = useSettingsStore(state => state.distributorName);

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-wine/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-gold/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-wine rounded-full flex items-center justify-center border-2 border-brand-gold/30 mx-auto mb-6 shadow-2xl shadow-brand-wine/20">
            <span className="text-brand-gold font-bold text-4xl">{distributorName.charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tighter mb-2">
            {distributorName.toUpperCase()} <span className="text-brand-gold">DISTRIBUIDORA</span>
          </h1>
          <p className="text-brand-steel">Portal mayorista exclusivo para clientes registrados</p>
        </div>

        <div className="glass-card p-8 shadow-2xl">
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-brand-steel mb-2">Email</label>
              <input 
                type="email" 
                placeholder="usuario@ejemplo.com" 
                className="w-full input-field"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-brand-steel">Contraseña</label>
                <a href="#" className="text-xs text-brand-gold hover:underline">¿Olvidaste tu contraseña?</a>
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full input-field"
              />
            </div>

            <button className="w-full btn-primary py-3 font-bold text-lg flex items-center justify-center gap-2">
              <LogIn size={20} /> Entrar
            </button>
          </form>

          <div className="mt-8">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-charcoal"></div>
              </div>
              <span className="relative px-4 bg-brand-graphite text-xs text-brand-steel uppercase tracking-widest">O continuar con</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="btn-secondary py-2.5 flex items-center justify-center gap-2 text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button className="btn-secondary py-2.5 flex items-center justify-center gap-2 text-sm">
                <User size={20} /> Invitado
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-brand-steel text-sm">
          ¿No tienes cuenta? <a href="#" className="text-brand-gold font-bold hover:underline">Solicitar Alta Cliente</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
