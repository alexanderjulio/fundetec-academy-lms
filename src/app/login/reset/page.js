'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
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
    <div className="login-page">
      <div className="login-card glass-card">
        <header className="login-header">
          <span className="logo-text">FUNDETEC <span className="accent">ACADEMY</span></span>
          <h1>Nueva Contraseña</h1>
          <p>Define tu nueva clave de acceso segura.</p>
        </header>

        {status.msg && (
          <div className={`status-box ${status.type}`}>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleReset} className="modern-form">
          <div className="form-group">
            <label>Nueva Contraseña</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
            />
          </div>
          <div className="form-group">
            <label>Confirmar Contraseña</label>
            <input 
              type="password" 
              required 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="••••••••" 
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #0c1e45; padding: 2rem;
        }
        .login-card { width: 100%; max-width: 480px; padding: 4rem 3.5rem; border-radius: 40px; color: white; }
        .login-header { text-align: center; margin-bottom: 3rem; }
        .logo-text { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; }
        .logo-text .accent { color: #16a34a; }
        .status-box { padding: 1.25rem; border-radius: 20px; margin-bottom: 2rem; text-align: center; font-size: 0.9rem; }
        .status-box.error { background: rgba(239, 68, 68, 0.1); color: #fca5a5; }
        .status-box.success { background: rgba(34, 197, 94, 0.1); color: #86efac; }
        .modern-form { display: flex; flex-direction: column; gap: 2rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.8rem; }
        label { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; }
        input { background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 255, 255, 0.1); padding: 1.25rem; border-radius: 20px; color: white; outline: none; }
        .btn-full { width: 100%; padding: 1.25rem; border-radius: 100px; background: #16a34a; color: white; font-weight: 700; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
