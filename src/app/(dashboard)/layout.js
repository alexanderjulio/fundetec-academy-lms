'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/dashboard/Sidebar';
import CoordinatorChat from '@/components/dashboard/CoordinatorChat';
import ChatbotWidget from '@/components/dashboard/ChatbotWidget';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useNotification } from '@/context/NotificationContext';
import '@/app/dashboard.css';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('Usuario Fundetec');
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { showNotification } = useNotification();
  const userRole = profile?.role_id === 1 ? 'admin' : (profile?.role_id === 2 ? 'coordinator' : 'student');

  useEffect(() => {
    async function getProfileAndNotifs() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error.message);
          }

          if (profileData) {
            setProfile(profileData);
            setDisplayName(profileData.full_name || user.user_metadata?.full_name || 'Usuario Fundetec');
            fetchNotifications(user.id, profileData);
          } else {
            // Fallback al nombre de la sesión si no hay perfil
            setDisplayName(user.user_metadata?.full_name || 'Usuario Fundetec');
          }
        } else {
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    getProfileAndNotifs();

    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-menu-wrapper')) setShowUserMenu(false);
      if (!e.target.closest('.notif-wrapper')) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = profile?.role_id === 1;
  const isCoordinator = profile?.role_id === 2;

  // Redirect if accessing a route they don't have permission for
  useEffect(() => {
    if (!loading && profile) {
      if (pathname.includes('/profile')) return;

      if (pathname.startsWith('/admin') && !isAdmin) router.push('/dashboard');
      if (pathname.startsWith('/coordinador') && !isAdmin && !isCoordinator) router.push('/dashboard');
      if (pathname === '/dashboard' && isAdmin) router.push('/admin');
      if (pathname === '/dashboard' && isCoordinator) router.push('/coordinador');
    }
  }, [profile, loading, isAdmin, isCoordinator, router, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`notifs-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_notifications' },
        (payload) => {
          const n = payload.new;
          const roleId = profile.role_id;

          // Filtrar por rol: mismo criterio que la carga inicial
          let isTargeted = false;
          if (roleId === 1) {
            // Admin: recibe todas las notificaciones
            isTargeted = true;
          } else if (roleId === 2) {
            // Coordinador: solo su grupo + individuales para él
            isTargeted =
              (n.target_type === 'coordinator_group' && n.coordinator_id === profile.coordinator_id) ||
              (n.target_type === 'individual' && n.coordinator_id === profile.id);
          } else {
            // Estudiante: solo individuales para él
            isTargeted = n.target_type === 'individual' && n.coordinator_id === profile.id;
          }

          if (isTargeted) {
            showNotification(n.title, 'success');
            setNotifications(prev => [n, ...prev].slice(0, 10));
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin, isCoordinator, showNotification]);

  const fetchNotifications = async (userId, userProfile) => {
    // Construir filtro según rol
    let query = supabase
      .from('global_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (userProfile.role_id === 1) {
      // Admin: ve absolutamente todas las notificaciones
      // (sin filtro adicional)
    } else if (userProfile.role_id === 2) {
      // Coordinador: solo notificaciones de su grupo + individuales para él
      query = query.or(
        `and(target_type.eq.coordinator_group,coordinator_id.eq.${userProfile.coordinator_id}),and(target_type.eq.individual,coordinator_id.eq.${userId})`
      );
    } else {
      // Estudiante: solo notificaciones individuales dirigidas a él
      query = query.eq('target_type', 'individual').eq('coordinator_id', userId);
    }

    const { data: notifs } = await query;

    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', userId);

    const readIds = reads?.map(r => r.notification_id) || [];
    const unread = notifs?.filter(n => !readIds.includes(n.id)) || [];
    
    setNotifications(notifs || []);
    setUnreadCount(unread.length);
  };

  const markAsRead = async (notifId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('notification_reads').upsert({
      notification_id: notifId,
      user_id: user.id
    });

    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar 
        userRole={userRole} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      <main className={`dashboard-content transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]'} ml-0`}>
        <header className="dashboard-header">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-3 bg-primary-color text-white rounded-xl shadow-lg shadow-primary-color/20 z-[110]"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div className="flex items-center gap-2 mr-2">
              <button 
                onClick={() => router.back()} 
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-primary-color hover:border-primary-color/20 hover:shadow-lg transition-all active:scale-90"
                title="Atrás"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button 
                onClick={() => router.forward()} 
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-primary-color hover:border-primary-color/20 hover:shadow-lg transition-all active:scale-90"
                title="Adelante"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            <div className="search-bar">
              <span>🔍 Buscar cursos o materiales...</span>
            </div>
          </div>

          <div className="header-right">
            <div className="notif-wrapper">
              <button className="notif-bell" onClick={() => setShowNotifs(!showNotifs)}>
                <span className="icon">🔔</span>
                {unreadCount > 0 && <span className="count">{unreadCount}</span>}
              </button>

              {showNotifs && (
                <div className="notif-dropdown glass-card animate-pop-dashboard">
                  <div className="dropdown-header">
                    <h4>Notificaciones</h4>
                    <Link
                      href={isAdmin ? '/admin/notifications' : '/dashboard/notifications'}
                      onClick={() => setShowNotifs(false)}
                    >Ver todas</Link>
                  </div>
                  <div className="dropdown-body">
                    {notifications.length === 0 ? (
                      <p className="empty">No hay mensajes nuevos.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="dropdown-item" onClick={() => { markAsRead(n.id); setShowNotifs(false); }}>
                          <div className="item-icon">📢</div>
                          <div className="item-content">
                            <h5>{n.title}</h5>
                            <p>{n.message.substring(0, 45)}...</p>
                            <span className="time">{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-menu-wrapper relative">
              <div 
                className={`user-profile group ${showUserMenu ? 'active' : ''}`}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="user-name group-hover:text-secondary-color transition-colors">{displayName}</span>
                <div className="user-avatar group-hover:scale-110 transition-transform">{displayName.charAt(0)}</div>
              </div>

              {showUserMenu && (
                <div className="user-dropdown glass-card animate-pop-dashboard">
                   <div className="dropdown-info">
                      <p className="email">{profile?.email}</p>
                      <span className="role-tag">{userRole === 'admin' ? 'Administrador' : (userRole === 'coordinator' ? 'Coordinador' : 'Estudiante')}</span>
                   </div>
                   <div className="dropdown-links">
                      <button 
                        onClick={() => {
                          setShowUserMenu(false);
                          const p = isAdmin ? '/admin/profile' : (isCoordinator ? '/coordinador/profile' : '/dashboard/profile');
                          router.push(p);
                        }} 
                        className="dropdown-link w-full text-left border-none bg-transparent cursor-pointer"
                      >
                        <span className="icon text-primary-color">👤</span> 
                        <div className="link-text">
                           <span className="title">Mi Perfil</span>
                           <span className="sub">Ajustes y cuenta</span>
                        </div>
                      </button>
                      <button className="dropdown-link logout" onClick={handleLogout}>
                        <span className="icon text-red-500">🚪</span> 
                        <div className="link-text text-left">
                           <span className="title">Cerrar Sesión</span>
                           <span className="sub">Finalizar jornada</span>
                        </div>
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-main">
          {children}
        </div>
      </main>

      {/* Floating Coordinator Chat for Students */}
      <CoordinatorChat studentProfile={profile} />

      {/* Profesor Virtual — solo para estudiantes */}
      {userRole === 'student' && <ChatbotWidget />}

    </div>
  );
}
