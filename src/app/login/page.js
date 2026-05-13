'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

function LoginContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [mode, setMode] = useState('auth'); // 'auth' or 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralId = searchParams.get('ref');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login/reset`,
        });
        if (error) throw error;
        setStatus({ type: 'success', msg: '📩 Enlace de recuperación enviado. Revisa tu correo.' });
        return;
      }

      if (isLogin) {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setStatus({ type: 'success', msg: '✅ ¡Bienvenido! Redirigiendo...' });

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', user.id)
          .single();
        
        const roleId = profile?.role_id;
        
        setTimeout(() => {
          if (roleId === 1) window.location.href = '/admin';
          else if (roleId === 2) window.location.href = '/coordinador';
          else window.location.href = '/dashboard';
        }, 1500);
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { 
              full_name: fullName,
              coordinator_id: referralId
            } 
          }
        });
        if (error) throw error;
        setStatus({ type: 'info', msg: '✨ Registro exitoso. Revisa tu correo para confirmar cuenta.' });
        setIsLogin(true);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-secondary-color/30">
      <Navbar />
      
      <main className="flex-1 flex pt-20">
        {/* LADO IZQUIERDO: FORMULARIO */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16 lg:p-24 bg-slate-50/50">
          <div className="w-full max-w-md space-y-12 animate-fade-in">
            <header className="space-y-4 text-center lg:text-left">
              <div className="inline-block lg:hidden mb-6">
                <span className="text-2xl font-black font-display tracking-tighter text-primary-color uppercase">
                  Fundetec <span className="text-secondary-color">Academy</span>
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter font-display leading-none">
                {mode === 'forgot' ? 'Recuperar Acceso' : (isLogin ? '¡Bienvenido de nuevo!' : 'Únete a la Academia')}
              </h1>
              <p className="text-gray-400 font-medium text-lg italic">
                {mode === 'forgot' ? 'Ingresa tu correo institucional.' : (isLogin ? 'Ingresa tus credenciales para continuar tu formación.' : 'Crea tu cuenta institucional hoy mismo.')}
              </p>
            </header>

            {status.msg && (
              <div className={`p-4 rounded-2xl text-sm font-bold text-center animate-pop border ${
                status.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 
                status.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 
                'bg-blue-50 text-blue-600 border-blue-100'
              }`}>
                {status.msg}
              </div>
            )}

            <form onSubmit={handleAuth} className="grid grid-cols-1 gap-8">
              {mode !== 'forgot' && !isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Ej: Juan Pérez" 
                    className="w-full bg-white border border-gray-100 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all font-bold text-primary-color placeholder:text-gray-300"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="alumno@fundetec.co" 
                  className="w-full bg-white border border-gray-100 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all font-bold text-primary-color placeholder:text-gray-300"
                />
              </div>

              {mode === 'auth' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contraseña</label>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required={mode === 'auth'} 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full bg-white border border-gray-100 p-5 pr-14 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all font-bold text-primary-color placeholder:text-gray-300 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary-color transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                  {isLogin && (
                    <div className="flex justify-end px-1">
                      <button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-black text-secondary-color uppercase tracking-widest hover:underline">
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-primary-color text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : (mode === 'forgot' ? 'Enviar Enlace de Recuperación' : (isLogin ? 'Acceder al Aula Virtual' : 'Registrar Cuenta'))}
              </button>
            </form>

            <footer className="pt-10 border-t border-gray-100 text-center lg:text-left">
              {mode === 'forgot' ? (
                <button onClick={() => setMode('auth')} className="text-xs font-black text-primary-color/60 uppercase tracking-widest hover:text-secondary-color transition-colors">
                  ← Volver al inicio de sesión
                </button>
              ) : (
                <p className="text-sm font-bold text-gray-400">
                  {isLogin ? '¿Aún no tienes una cuenta?' : '¿Ya eres parte de la academia?'}
                  <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-secondary-color hover:underline">
                    {isLogin ? 'Crea una aquí' : 'Inicia sesión ahora'}
                  </button>
                </p>
              )}
            </footer>
          </div>
        </div>

        {/* LADO DERECHO: VISUAL */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-color">
          <div className="absolute inset-0 z-0">
             <img 
               src="/hero.png" 
               className="w-full h-full object-cover opacity-30 grayscale saturate-0 animate-scale-slow"
               alt="Fundetec Academy"
             />
             <div className="absolute inset-0 bg-gradient-to-tr from-primary-color via-primary-color/80 to-transparent"></div>
          </div>

          <div className="relative z-10 w-full flex items-center justify-center p-20">
            <div className="max-w-xl space-y-8 animate-fade-in-right">
              <div className="w-20 h-1 bg-secondary-color"></div>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none font-display">
                La educación que <span className="text-secondary-color italic">transforma</span> tu futuro profesional.
              </h2>
              <p className="text-xl text-white/50 font-medium leading-relaxed italic">
                "La inversión en conocimiento siempre paga el mejor interés."
              </p>
              <div className="flex items-center gap-6 pt-10">
                <div className="flex -space-x-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-full border-4 border-primary-color bg-gray-200 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} alt="Estudiante" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Únete a más de <span className="text-white">1,500 estudiantes</span> activos.</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-10 right-10 text-[8px] font-black uppercase text-white/20 tracking-[0.5em] font-sans">
            Fundetec Academy • Experiencia de Aprendizaje Premium
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center font-black animate-pulse">CARGANDO ACCESO...</div>}>
      <LoginContent />
    </Suspense>
  );
}
