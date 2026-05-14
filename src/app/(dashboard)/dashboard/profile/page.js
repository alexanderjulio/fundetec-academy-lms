'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { QRCodeSVG } from 'qrcode.react';

const Icons = {
  Personal: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Security: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Stats: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  WhatsApp: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Save: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
};

export default function ProfilePage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ users: 0, courses: 0, messages: 0 });
  const [formData, setFormData] = useState({ full_name: '', whatsapp: '' });
  const [passwordData, setPasswordData] = useState({ new_password: '', confirm_password: '' });

  const isAdmin = profile?.role_id === 1;
  const isCoordinator = profile?.role_id === 2;
  const isStudent = profile?.role_id === 3;

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles').select('*, roles(name)').eq('id', user.id).single();
      if (profileData) {
        setProfile(profileData);
        setFormData({ full_name: profileData.full_name || '', whatsapp: profileData.whatsapp || '' });
        
        if (profileData.role_id === 1) fetchAdminStats(user.id);
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
      showNotification('Error al cargar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminStats = async (userId) => {
    try {
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: coursesCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
      const { count: msgsCount } = await supabase.from('global_notifications').select('*', { count: 'exact', head: true }).eq('sender_id', userId);
      
      setStats({ users: usersCount || 0, courses: coursesCount || 0, messages: msgsCount || 0 });
    } catch (e) {
      console.error('Error fetching admin stats:', e);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update({ full_name: formData.full_name, whatsapp: formData.whatsapp }).eq('id', user.id);
      if (error) throw error;
      showNotification('Identidad actualizada.', 'success');
      await supabase.auth.updateUser({ data: { full_name: formData.full_name } });
    } catch (error) {
      showNotification('Error al guardar cambios.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      return showNotification('Las contraseñas no coinciden.', 'warning');
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;
      showNotification('Seguridad actualizada con éxito.', 'success');
      setPasswordData({ new_password: '', confirm_password: '' });
    } catch (error) {
      showNotification('Error de seguridad: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 animate-pulse space-y-4">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-3xl">👤</div>
      <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Consultando Identidad Elite...</p>
    </div>
  );

  const getRoleLabel = () => {
    if (isAdmin) return 'Nivel de Acceso: Elite';
    if (isCoordinator) return 'Área de Gestión Institucional';
    return 'Área de Estudiante';
  };

  const getRoleHeader = () => {
    if (isAdmin) return 'Master Identity';
    if (isCoordinator) return 'Perfil de Coordinador';
    return 'Mi Perfil';
  };

  const getBadgeColor = () => {
    if (isAdmin) return 'bg-primary-color text-white';
    if (isCoordinator) return 'bg-indigo-600 text-white shadow-indigo-500/20';
    return 'bg-secondary-color text-primary-color';
  };

  const getBadgeText = () => {
    if (isAdmin) return '🛡️ Administrador General';
    if (isCoordinator) return '💼 Coordinador Académico';
    return '🎓 Estudiante Activo';
  };

  return (
    <div className="profile-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in relative">
      
      {/* HEADER BENTO */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-8 space-y-1">
          <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.3em]">{getRoleLabel()}</span>
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            {getRoleHeader()}
          </h1>
          <p className="text-gray-400 font-medium italic">Gestiona tu identidad digital y configuración de seguridad.</p>
        </div>
        <div className="lg:col-span-4 flex justify-end">
           <div className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${getBadgeColor()}`}>
             {getBadgeText()}
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* IDENTIDAD VISUAL (IZQUIERDA) */}
        <aside className="lg:col-span-4 space-y-8">
          <div className={`p-1 rounded-[48px] shadow-2xl overflow-hidden transition-all duration-700 ${isAdmin ? 'bg-[#0A1128] text-white shadow-primary-color/20' : 'bg-white border border-gray-100'}`}>
            <div className="p-10 text-center space-y-6 relative">
              {isAdmin && <div className="absolute inset-0 bg-gradient-to-br from-primary-color/10 to-transparent"></div>}
              
              <div className={`w-24 h-24 mx-auto rounded-[32px] flex items-center justify-center text-4xl font-black shadow-lg relative z-10 ${isAdmin ? 'bg-secondary-color text-primary-color' : 'bg-slate-100 text-primary-color'}`}>
                {formData.full_name?.charAt(0) || 'U'}
              </div>

              <div className="relative z-10">
                <h2 className="text-2xl font-black font-display tracking-tight leading-none mb-1 lowercase first-letter:uppercase">{formData.full_name}</h2>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{profile?.email}</p>
              </div>

              {isAdmin ? (
                <div className="grid grid-cols-3 gap-2 relative z-10 pt-4 border-t border-white/5">
                  <div className="p-3 bg-white/5 rounded-2xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-secondary-color uppercase mb-1">Users</span>
                    <span className="text-lg font-black">{stats.users}</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-secondary-color uppercase mb-1">Cursos</span>
                    <span className="text-lg font-black">{stats.courses}</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl flex flex-col items-center">
                    <span className="text-[8px] font-black text-secondary-color uppercase mb-1">Msgs</span>
                    <span className="text-lg font-black">{stats.messages}</span>
                  </div>
                </div>
              ) : (
                <div className="pt-6 border-t border-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Fundetec ID: #{profile?.id.substring(0, 8)}
                </div>
              )}
            </div>
          </div>

          {!isAdmin && isStudent && (
             <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-100 text-center space-y-4">
                <span className="text-2xl">📱</span>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-relaxed">
                  ¿Necesitas apoyo técnico? <br/> Tu coordinador está en línea.
                </p>
                <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">Contactar Soporte</button>
             </div>
          )}

          {(isAdmin || isCoordinator) && (
            <div className="p-8 bg-indigo-50 rounded-[40px] border border-indigo-100 space-y-6">
              <div className="text-center space-y-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Célula de Captación</span>
                <h4 className="text-xl font-black text-primary-color tracking-tight">Referido Elite</h4>
              </div>

              <div className="bg-white p-6 rounded-3xl flex justify-center shadow-inner">
                <QRCodeSVG 
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${profile?.id}`}
                  size={150}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    const link = `${window.location.origin}/login?ref=${profile.id}`;
                    navigator.clipboard.writeText(link);
                    showNotification('Enlace copiado al portapapeles', 'success');
                  }}
                  className="w-full py-4 bg-primary-color text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all flex items-center justify-center gap-2"
                >
                  <span>🔗</span> Copiar Enlace
                </button>
                <p className="text-[9px] text-gray-400 text-center font-medium italic">
                  Usa este enlace o QR para registrar nuevos prospectos directamente en tu red.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* GESTIÓN Y SEGURIDAD (DERECHA) */}
        <main className="lg:col-span-8 space-y-10">
          
          {/* INFORMACIÓN PERSONAL */}
          <section className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-color"><Icons.Personal /></div>
              <h3 className="text-xl font-black text-primary-color font-display uppercase tracking-tight">Datos Maestros</h3>
            </div>

            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">Nombre de Identidad</label>
                <input 
                  type="text" required value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">Celular / WhatsApp</label>
                <input 
                  type="text" value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                  placeholder="+57..."
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-10 py-5 bg-primary-color text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center gap-3">
                  <Icons.Save /> {saving ? 'Sincronizando...' : 'Guardar Identidad'}
                </button>
              </div>
            </form>
          </section>

          {/* SEGURIDAD Y ACCESO */}
          <section className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary-color"><Icons.Security /></div>
              <h3 className="text-xl font-black text-primary-color font-display uppercase tracking-tight">Seguridad y Acceso</h3>
            </div>

            <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">Nueva Contraseña</label>
                <input 
                  type="password" required value={passwordData.new_password}
                  onChange={e => setPasswordData({...passwordData, new_password: e.target.value})}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                  placeholder="Min. 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2">Confirmar Contraseña</label>
                <input 
                  type="password" required value={passwordData.confirm_password}
                  onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                  placeholder="Confirmar"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-black/10">
                  Actualizar Llaves de Acceso
                </button>
              </div>
            </form>
          </section>

        </main>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
