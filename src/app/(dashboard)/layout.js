'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/dashboard/Sidebar';
import CoordinatorChat from '@/components/dashboard/CoordinatorChat';
import Link from 'next/link';
import '@/app/dashboard.css';

export default function DashboardLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('Usuario Fundetec');
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRole = profile?.role_id === 1 ? 'admin' : (profile?.role_id === 2 ? 'coordinator' : 'student');

  useEffect(() => {
    async function getProfileAndNotifs() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error.message);
          }

          if (profileData) {
            setProfile(profileData);
            setDisplayName(profileData.full_name || session.user.user_metadata?.full_name || 'Usuario Fundetec');
            fetchNotifications(session.user.id, profileData);

            // SEGURIDAD ESTRICTA: Redirigir al panel correcto si está en la ruta equivocada
            const roleId = profileData.role_id;
            const pathname = window.location.pathname;

            if (roleId === 1 && !pathname.startsWith('/admin')) {
              window.location.href = '/admin';
            } else if (roleId === 2 && !pathname.startsWith('/coordinador')) {
              window.location.href = '/coordinador';
            } else if ((roleId === 3 || !roleId) && !pathname.startsWith('/dashboard')) {
              window.location.href = '/dashboard';
            }
          } else {
            // Fallback al nombre de la sesión si no hay perfil
            setDisplayName(session.user.user_metadata?.full_name || 'Usuario Fundetec');
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
          const isTargeted = n.target_type === 'all' || n.coordinator_id === profile.coordinator_id || n.coordinator_id === profile.id;
          
          if (isTargeted) {
            setNotifications(prev => [n, ...prev].slice(0, 10));
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchNotifications = async (userId, userProfile) => {
    const { data: notifs } = await supabase
      .from('global_notifications')
      .select('*')
      .or(`target_type.eq.all,coordinator_id.eq.${userProfile.coordinator_id || userId}`)
      .order('created_at', { ascending: false })
      .limit(10);

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('notification_reads').upsert({
      notification_id: notifId,
      user_id: session.user.id
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
      />
      <main className={`dashboard-content transition-all duration-300 ${isSidebarCollapsed ? 'ml-[80px]' : 'ml-[280px]'}`}>
        <header className="dashboard-header">
          <div className="search-bar">
            <span>🔍 Buscar cursos o materiales...</span>
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
                    <Link href="/dashboard/notifications" onClick={() => setShowNotifs(false)}>Ver todas</Link>
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
                      <Link href="/dashboard/profile" className="dropdown-link" onClick={() => setShowUserMenu(false)}>
                        <span className="icon text-primary-color">👤</span> 
                        <div className="link-text">
                           <span className="title">Mi Perfil</span>
                           <span className="sub">Ajustes y cuenta</span>
                        </div>
                      </Link>
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

    </div>
  );
}
