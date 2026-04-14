'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';

function ResetContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const router = useRouter();

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus({ type: 'error', msg: '❌ Las contraseñas no coinciden.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setStatus({ type: 'success', msg: '✅ Contraseña actualizada con éxito. Redirigiendo...' });
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-secondary-color/30">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-6 pt-24">
        <div className="w-full max-w-md bg-white p-10 md:p-12 rounded-[40px] border border-gray-100 shadow-2xl shadow-primary-color/5 space-y-10 animate-fade-in">
          <header className="space-y-3 text-center">
            <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.3em] bg-secondary-color/10 px-4 py-1.5 rounded-full">Seguridad de Cuenta</span>
            <h1 className="text-3xl md:text-4xl font-black text-primary-color tracking-tighter font-display leading-none">
              Nueva Contraseña
            </h1>
            <p className="text-gray-400 font-medium italic text-sm">
              Define tu nueva clave de acceso institucional.
            </p>
          </header>

          {status.msg && (
            <div className={`p-4 rounded-2xl text-sm font-bold text-center animate-pop border ${
              status.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
            }`}>
              {status.msg}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nueva Contraseña</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full bg-slate-50 border border-gray-100 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all font-mono font-bold text-primary-color placeholder:text-gray-300"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Confirmar Contraseña</label>
              <input 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full bg-slate-50 border border-gray-100 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all font-mono font-bold text-primary-color placeholder:text-gray-300"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-primary-color text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        </div>
      </main>

      <footer className="p-10 text-center">
        <p className="text-[8px] font-black uppercase text-gray-300 tracking-[0.5em]">Fundetec Academy • Secure Protocol</p>
      </footer>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center font-black animate-pulse text-gray-300 text-[10px] tracking-widest">CARGANDO MÓDULO DE SEGURIDAD...</div>}>
      <ResetContent />
    </Suspense>
  );
}
