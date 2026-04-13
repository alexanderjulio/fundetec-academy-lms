'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/dashboard/Sidebar';
import CoordinatorChat from '@/components/dashboard/CoordinatorChat';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRole = profile?.role_id === 1 ? 'admin' : (profile?.role_id === 2 ? 'coordinator' : 'student');

  useEffect(() => {
    async function getProfileAndNotifs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
            fetchNotifications(session.user.id, profileData);
          }
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
                <div className="notif-dropdown glass-card animate-pop">
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
                <span className="user-name group-hover:text-secondary-color transition-colors">{profile?.full_name || 'Usuario Fundetec'}</span>
                <div className="user-avatar group-hover:scale-110 transition-transform">{profile?.full_name?.charAt(0) || '👤'}</div>
              </div>

              {showUserMenu && (
                <div className="user-dropdown glass-card animate-pop">
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

      <style jsx>{`
        .dashboard-container { 
          display: flex; 
          min-height: 100vh; 
          background: #f8fafc; 
          background-image: 
            radial-gradient(at 0% 0%, rgba(12, 30, 69, 0.03) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(22, 163, 74, 0.03) 0px, transparent 50%);
        }
        .dashboard-content { flex: 1; margin-left: 280px; display: flex; flex-direction: column; }
        
        .dashboard-header {
          height: 80px; 
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          border-bottom: 1px solid rgba(12, 30, 69, 0.08);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 3rem; position: sticky; top: 0; z-index: 100;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
        }
        
        .header-right { display: flex; align-items: center; gap: 2.5rem; }
        
        .notif-wrapper { position: relative; }
        .notif-bell { 
          background: white; 
          border: 1px solid var(--gray-100); 
          font-size: 1.4rem; 
          cursor: pointer; 
          position: relative; 
          padding: 0.6rem; 
          border-radius: 12px; 
          transition: all 0.3s; 
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
        }
        .notif-bell:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(0, 0, 0, 0.05); }
        
        .notif-bell .count { 
          position: absolute; 
          top: -5px; 
          right: -5px; 
          background: #ef4444; 
          color: white; 
          font-size: 0.7rem; 
          font-weight: 900; 
          padding: 0.15rem 0.5rem; 
          border-radius: 20px; 
          border: 2.5px solid white;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        
        .notif-dropdown { 
          position: absolute; top: 70px; right: 0; width: 340px; padding: 0; z-index: 1000; 
          border-radius: 24px; overflow: hidden; border: 1px solid rgba(12, 30, 69, 0.1);
        }
        .dropdown-header { padding: 1.2rem 1.8rem; background: var(--gray-50); border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center; }
        .dropdown-header h4 { font-family: 'Outfit', sans-serif; font-size: 1rem; color: var(--primary-color); font-weight: 800; }
        .dropdown-header a { font-size: 0.8rem; color: var(--secondary-color); text-decoration: none; font-weight: 700; }
        
        .dropdown-body { max-height: 400px; overflow-y: auto; }
        .dropdown-item { padding: 1.4rem 1.8rem; display: flex; gap: 1.2rem; border-bottom: 1px solid var(--gray-50); transition: background 0.2s; cursor: pointer; }
        .dropdown-item:hover { background: #f8fafc; }
        .item-icon { font-size: 1.4rem; }
        .item-content h5 { font-family: 'Outfit', sans-serif; font-size: 0.95rem; color: var(--primary-color); font-weight: 700; margin-bottom: 0.3rem; }
        .item-content p { font-size: 0.8rem; color: var(--gray-500); line-height: 1.5; }
        .item-content .time { font-size: 0.7rem; color: var(--gray-400); margin-top: 0.5rem; display: block; font-weight: 600; }

        .search-bar { 
          color: var(--gray-600); background: var(--gray-50); padding: 0.8rem 1.8rem; 
          border-radius: 100px; width: 400px; border: 1.5px solid var(--gray-100); 
          font-size: 0.9rem; transition: all 0.3s;
        }
        .search-bar:hover { border-color: var(--gray-200); background: white; box-shadow: 0 5px 15px rgba(0,0,0,0.02); }

        .user-menu-wrapper { position: relative; }
        .user-profile { display: flex; align-items: center; gap: 1.2rem; padding: 0.5rem 1rem; border-radius: 100px; transition: all 0.3s; cursor: pointer; border: 1.5px solid transparent; }
        .user-profile:hover, .user-profile.active { background: white; border-color: rgba(12, 30, 69, 0.05); box-shadow: 0 5px 15px rgba(0,0,0,0.03); }
        .user-name { font-family: 'Outfit', sans-serif; font-weight: 800; color: var(--primary-color); font-size: 1rem; }
        .user-avatar { width: 44px; height: 44px; background: var(--secondary-color); color: white; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; box-shadow: 0 8px 15px rgba(22, 163, 74, 0.2); }
        
        .user-dropdown { 
          position: absolute; top: 70px; right: 0; width: 280px; z-index: 1000; 
          background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px);
          border-radius: 28px; border: 1px solid rgba(12, 30, 69, 0.1);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1); padding: 1.5rem;
        }

        .dropdown-info { padding-bottom: 1.2rem; border-bottom: 1px solid rgba(12, 30, 69, 0.05); margin-bottom: 1rem; }
        .dropdown-info .email { font-size: 0.8rem; color: var(--gray-500); font-weight: 600; margin-bottom: 0.5rem; truncate: true; overflow: hidden; text-overflow: ellipsis; }
        .role-tag { 
          display: inline-block; padding: 0.2rem 0.8rem; background: var(--primary-color); 
          color: white; font-size: 0.65rem; font-weight: 900; border-radius: 100px; 
          text-transform: uppercase; letter-spacing: 0.05em; 
        }

        .dropdown-links { display: flex; flex-direction: column; gap: 0.5rem; }
        .dropdown-link { 
          display: flex; align-items: center; gap: 1rem; padding: 0.8rem 1rem; 
          border-radius: 18px; transition: all 0.2s; text-decoration: none;
          background: transparent; border: none; width: 100%; cursor: pointer;
        }
        .dropdown-link:hover { background: var(--gray-50); }
        .dropdown-link .icon { font-size: 1.2rem; }
        .dropdown-link .link-text { display: flex; flex-direction: column; }
        .dropdown-link .title { font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 800; color: var(--primary-color); }
        .dropdown-link .sub { font-size: 0.7rem; color: var(--gray-400); font-weight: 600; }
        
        .dropdown-link.logout:hover { background: #fee2e2; }
        .dropdown-link.logout:hover .title { color: #dc2626; }

        .dashboard-main { padding: 3rem; max-width: 1400px; width: 100%; margin: 0 auto; animation: slideUp 0.6s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        @keyframes pop { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-pop { animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        @media (max-width: 1024px) {
          .dashboard-content { margin-left: 0; }
          .search-bar { display: none; }
          .dashboard-header { padding: 0 1.5rem; }
        }
      `}</style>
    </div>
  );
}
