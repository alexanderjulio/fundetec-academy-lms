'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const Icons = {
  Dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
  ),
  Cursos: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 1 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
  ),
  Progreso: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  ),
  Examenes: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
  ),
  Notifications: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
  ),
  Users: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Logout: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
  ),
  Collapse: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  ),
  Expand: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  ),
  Leads: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
  ),
  Billing: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
  ),
  Ledger: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>
  ),
  Reportes: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
  ),
  Landing: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  )
};

export default function Sidebar({ userRole, isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    }
  };

  const menuItems = {
    admin: [
      { name: 'Dashboard', href: '/admin', icon: <Icons.Dashboard /> },
      { name: 'Cursos', href: '/admin/courses', icon: <Icons.Cursos /> },
      { name: 'Comunidad', href: '/admin/users', icon: <Icons.Users /> },
      { name: 'Prospectos', href: '/admin/leads', icon: <Icons.Leads /> },
      { name: 'Facturación', href: '/admin/billing', icon: <Icons.Billing /> },
      { name: 'Libro Mayor', href: '/admin/ledger', icon: <Icons.Ledger /> },
      { name: 'Reportes', href: '/admin/reportes', icon: <Icons.Reportes /> },
      { name: 'Landing', href: '/admin/landing', icon: <Icons.Landing /> },
      { name: 'Notificaciones', href: '/admin/notifications', icon: <Icons.Notifications /> },
      { name: 'Mi Perfil', href: '/admin/profile', icon: <Icons.Settings /> },
    ],
    coordinator: [
      { name: 'Dashboard', href: '/coordinador', icon: <Icons.Dashboard /> },
      { name: 'Mis Estudiantes', href: '/coordinador/students', icon: <Icons.Users /> },
      { name: 'Pagos', href: '/coordinador/pagos', icon: <Icons.Examenes /> },
      { name: 'Notificaciones', href: '/coordinador/notifications', icon: <Icons.Notifications /> },
      { name: 'Mi Perfil', href: '/coordinador/profile', icon: <Icons.Settings /> },
    ],
    student: [
      { name: 'Mis Cursos', href: '/dashboard/courses', icon: <Icons.Cursos /> },
      { name: 'Mi Progreso', href: '/dashboard/progress', icon: <Icons.Progreso /> },
      { name: 'Exámenes', href: '/dashboard/exams', icon: <Icons.Examenes /> },
      { name: 'Notificaciones', href: '/dashboard/notifications', icon: <Icons.Notifications /> },
      { name: 'Mi Perfil', href: '/dashboard/profile', icon: <Icons.Settings /> },
    ],
  };

  const navLinks = menuItems[userRole] || [];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside 
        className={`fixed left-0 top-0 h-screen bg-[#0F172A] text-white transition-all duration-300 z-[200] flex flex-col shadow-2xl 
          ${isCollapsed ? 'w-[80px]' : 'w-[280px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
      {/* Header / Logo */}
      <div className={`p-8 mb-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <Link href="/" className="flex flex-col group">
            <span className="text-xl font-black font-display tracking-tight leading-none group-hover:text-secondary-color transition-colors">
              FUNDETEC
            </span>
            <span className="text-sm font-bold text-secondary-color tracking-widest mt-0.5">
              ACADEMY
            </span>
          </Link>
        ) : (
          <Link href="/" className="w-10 h-10 bg-secondary-color rounded-xl flex items-center justify-center font-black text-xl text-primary-color shadow-lg shadow-secondary-color/20 hover:scale-110 transition-all">
            F
          </Link>
        )}

        {/* Close button for mobile */}
        <button 
          className="lg:hidden w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-white"
          onClick={() => setIsMobileOpen(false)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      {/* Collapse Toggle Button - Only visible on Desktop */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute -right-3 top-24 w-6 h-6 bg-secondary-color text-primary-color rounded-full hidden lg:flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95 z-[210]`}
      >
        {isCollapsed ? <Icons.Expand /> : <Icons.Collapse />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-8">
        <ul className="space-y-3">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden group ${
                    isActive 
                      ? 'bg-secondary-color text-primary-color shadow-lg shadow-secondary-color/10' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className={`flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${isCollapsed ? 'w-full' : ''}`}>
                    {item.icon}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[15px] font-bold font-display leading-none whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-primary-color"></div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Footer */}
      <div className="p-4 mt-auto border-t border-white/5 space-y-4">
        {!isCollapsed && profile && (
          <div className="p-4 rounded-2xl bg-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-color flex items-center justify-center font-black text-primary-color">
              {profile.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-black truncate">{profile.full_name}</span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                {userRole === 'admin' ? 'Administrador' : (userRole === 'coordinator' ? 'Coordinador' : 'Estudiante')}
              </span>
            </div>
          </div>
        )}
        
        <button 
          onClick={handleLogout}
          className={`flex items-center gap-4 p-4 rounded-2xl w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group ${isCollapsed ? 'justify-center' : ''}`}
        >
          <div className="group-hover:translate-x-1 transition-transform">
            <Icons.Logout />
          </div>
          {!isCollapsed && <span className="text-[14px] font-bold uppercase tracking-widest">Salir</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
