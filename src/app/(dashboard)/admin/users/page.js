'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { 
  updateUserPassword, 
  registerNewUser, 
  updateProfileMetadata, 
  removeUserById,
  updateUserRoleById,
  confirmEmailManual
} from '@/app/actions/admin_actions';
import { generatePDFReport, generateExcelReport } from '@/utils/reportGenerators';

const Icons = {
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x2="14" y1="11" x1="14" y2="17"></line></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
};

export default function AdminUsersPage() {
  const { showNotification } = useNotification();
  const [users, setUsers] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Modales
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Formulario Creación
  const [formData, setFormData] = useState({
    full_name: '', email: '', password: '', whatsapp: '', 
    role_id: 3, student_type: 'validación', status: 'activo'
  });
  const [newPassword, setNewPassword] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Obtener perfil del usuario actual para saber su rol
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role_id')
      .eq('id', session.user.id)
      .single();
    
    setCurrentUser(profile);

    let usersQuery = supabase
      .from('profiles')
      .select('id, full_name, email, role_id, coordinator_id, created_at, whatsapp, phone, student_type, status, roles(name), coordinator:coordinator_id(full_name)')
      .order('created_at', { ascending: false });

    // Regla de Visibilidad: El coordinador solo ve a sus estudiantes asignados
    if (profile.role_id === 2) {
      usersQuery = usersQuery.eq('coordinator_id', profile.id);
    }

    const coordsReq = supabase
      .from('profiles')
      .select('id, full_name')
      .in('role_id', [1, 2]);

    const [usersRes, coordsRes] = await Promise.all([usersQuery, coordsReq]);

    if (!usersRes.error) setUsers(usersRes.data);
    if (!coordsRes.error) setCoordinators(coordsRes.data);
    
    setLoading(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || 
                        (roleFilter === 'admin' && user.role_id === 1) ||
                        (roleFilter === 'coordinator' && user.role_id === 2) ||
                        (roleFilter === 'student' && user.role_id === 3);
    const matchesType = typeFilter === 'all' || user.student_type === typeFilter;
    return matchesSearch && matchesRole && matchesType;
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Si el creador es coordinador, forzar rol de estudiante
    const payload = { ...formData };
    if (currentUser.role_id === 2) payload.role_id = 3;

    const res = await registerNewUser(payload, currentUser.id, currentUser.role_id);
    
    if (res.success) {
      showNotification('✅ Nuevo perfil activo en Fundetec.', 'success');
      setIsCreateModalOpen(false);
      setFormData({ full_name: '', email: '', password: '', whatsapp: '', role_id: 3, student_type: 'validación', status: 'activo' });
      fetchData();
    } else {
      showNotification('Error: ' + res.error, 'error');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente esta cuenta? Esta acción no se puede deshacer.')) return;
    
    setLoading(true);
    const res = await removeUserById(id, currentUser.role_id);
    if (res.success) {
      showNotification('Cuenta eliminada del ecosistema.', 'success');
      setUsers(users.filter(u => u.id !== id));
    } else {
      showNotification(res.error, 'error');
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    const res = await updateUserRoleById(userId, newRole, currentUser.role_id);
    if (res.success) {
      showNotification('Rango jerárquico actualizado.', 'success');
      // Refrescar para actualizar lista de coordinadores si alguien subió a ese rango
      fetchData();
    } else {
      showNotification(res.error, 'error');
    }
    setUpdatingId(null);
  };

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'activo' ? 'inactivo' : 'activo';
    setUpdatingId(user.id);
    const res = await updateProfileMetadata(user.id, { status: newStatus });
    
    if (res.success) {
      setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showNotification(`Estado de ${user.full_name} actualizado.`, 'success');
    }
    setUpdatingId(null);
  };

  const handleManualActivate = async (userId) => {
    setUpdatingId(userId);
    const res = await confirmEmailManual(userId);
    if (res.success) {
      showNotification('✅ Correo validado y cuenta activada.', 'success');
    } else {
      showNotification('Error: ' + res.error, 'error');
    }
    setUpdatingId(null);
  };

  const changeStudentType = async (userId, type) => {
    setUpdatingId(userId);
    const res = await updateProfileMetadata(userId, { student_type: type });
    if (res.success) {
      setUsers(users.map(u => u.id === userId ? { ...u, student_type: type } : u));
      showNotification('Categoría académica actualizada.', 'success');
    }
    setUpdatingId(null);
  };

  const assignCoordinator = async (userId, coordinatorId) => {
    setUpdatingId(userId);
    const res = await updateProfileMetadata(userId, { coordinator_id: coordinatorId || null });

    if (!res.success) {
      showNotification('Error: ' + res.error, 'error');
    } else {
      const coordName = coordinators.find(c => c.id === coordinatorId)?.full_name || null;
      setUsers(users.map(u => u.id === userId ? { ...u, coordinator_id: coordinatorId, coordinator: { full_name: coordName } } : u));
      showNotification('Mentor asignado correctamente.', 'success');
    }
    setUpdatingId(null);
  };

  const handleOpenPasswordModal = (user) => {
    setSelectedUser(user);
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let pass = "";
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pass);
    setIsPasswordModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let pass = "";
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pass);
  };

  const handleResetPassword = async () => {
    if (!newPassword) return showNotification('Escribe una contraseña válida.', 'error');
    setLoading(true);
    const res = await updateUserPassword(selectedUser.id, newPassword, currentUser.role_id);
    if (res.success) {
      showNotification(`✅ Clave de ${selectedUser.full_name} actualizada correctamente.`, 'success');
      setIsPasswordModalOpen(false);
      setNewPassword('');
    } else {
      showNotification('Error: ' + res.error, 'error');
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const isActive = status === 'activo';
    return (
      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'}`}>
        {status || 'activo'}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const types = {
      'validación': 'bg-green-50 text-green-500',
      'técnico': 'bg-blue-50 text-blue-500',
      'diplomado': 'bg-purple-50 text-purple-600',
      'ies': 'bg-orange-50 text-orange-600',
      'otro': 'bg-slate-50 text-slate-400'
    };
    return (
      <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${types[type] || types['otro']}`}>
        {type || 'Estudiante'}
      </span>
    );
  };

  return (
    <div className="admin-users max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in relative">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            Gestión de <span className="text-secondary-color">Comunidad</span>
          </h1>
          <p className="text-gray-400 font-medium italic">
            {currentUser?.role_id === 2 ? 'Directorio de tus estudiantes asignados.' : 'Control total de accesos, roles y tipificación.'}
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-none px-8 py-4 bg-primary-color text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center justify-center gap-3"
          >
            <Icons.Plus /> {currentUser?.role_id === 2 ? 'Nuevo Alumno' : 'Registrar Usuario'}
          </button>
        </div>
      </header>

      {/* PANEL DE REPORTES ELITE */}
      <section className="bg-gradient-to-r from-primary-color to-indigo-900 p-10 rounded-[48px] shadow-2xl shadow-primary-color/20 text-white space-y-8 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8 text-center lg:text-left">
          <div className="space-y-2">
            <h2 className="text-2xl font-black font-display tracking-tight">Reportes de Comunidad</h2>
            <p className="text-indigo-200 text-sm font-medium">Exporta analíticas de tus estudiantes de forma instantánea.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex bg-white/10 p-2 rounded-[24px] backdrop-blur-md border border-white/10">
              <button 
                onClick={() => {
                  const data = users.filter(u => u.status === 'activo');
                  generatePDFReport(data, 'Estudiantes Activos', currentUser?.full_name);
                }}
                className="px-6 py-3 hover:bg-white hover:text-primary-color rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all"
              >Activos (PDF)</button>
              <button 
                onClick={() => {
                  const data = users.filter(u => u.status === 'graduado');
                  generatePDFReport(data, 'Estudiantes Graduados', currentUser?.full_name);
                }}
                className="px-6 py-3 hover:bg-white hover:text-primary-color rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all"
              >Graduados (PDF)</button>
              <button 
                onClick={() => generateExcelReport(users, 'Matrícula Total')}
                className="px-6 py-3 bg-secondary-color text-primary-color rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg"
              >Excel Total</button>
            </div>
            
            <div className="flex flex-col justify-center items-center px-6">
                <span className="text-[10px] font-black uppercase text-secondary-color tracking-widest">Total Alumnos</span>
                <span className="text-3xl font-black font-display leading-tight">{users.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FILTROS INTEGRADOS */}
      <section className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-6 relative">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-20 text-primary-color">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o ID de usuario..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none p-6 pl-16 rounded-[28px] outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all placeholder:text-gray-300"
          />
        </div>
        <div className="lg:col-span-3">
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-50 border-none p-6 rounded-[28px] outline-none font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer appearance-none shadow-sm"
          >
            <option value="all">Todas las Modalidades</option>
            <option value="validación">Validación</option>
            <option value="técnico">Técnico</option>
            <option value="diplomado">Diplomado</option>
            <option value="ies">IES</option>
          </select>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
             <Icons.Chevron />
          </div>
        </div>
        <div className="lg:col-span-3 relative group">
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-50 border-none p-6 rounded-[28px] outline-none font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer appearance-none shadow-sm transition-all focus:ring-4 focus:ring-secondary-color/10"
          >
            <option value="all">Todos los Roles</option>
            <option value="student">Estudiantes</option>
            <option value="coordinator">Coordinadores</option>
            {currentUser?.role_id === 1 && <option value="admin">Administradores</option>}
          </select>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
             <Icons.Chevron />
          </div>
        </div>
      </section>

      {/* TABLA DE COMUNIDAD BOUTIQUE */}
      <section className="overflow-x-auto bg-white rounded-[64px] border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
        {loading && users.length === 0 ? 
          <div className="p-40 text-center animate-pulse">
            <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl">👥</div>
            <p className="text-gray-400 font-black uppercase tracking-[0.4em] text-[10px]">Consultando Comunidad Fundetec...</p>
          </div>
        : 
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-10 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estudiante/Usuario</th>
                <th className="p-10 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Modalidad Académica</th>
                <th className="p-10 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Mentoría</th>
                <th className="p-10 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estado de Cuenta</th>
                <th className="p-10 text-right text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Compromiso</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-slate-50/30 transition-all">
                  <td className="p-10 border-b border-gray-50">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-[22px] bg-primary-color text-white flex items-center justify-center font-black text-xs shadow-lg shadow-primary-color/10 group-hover:bg-secondary-color group-hover:text-primary-color transition-all duration-500">
                        {user.full_name?.substring(0,2).toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h3 className="text-sm font-black text-primary-color leading-tight">{user.full_name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">{user.email}</p>
                        <span className={`w-fit px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          user.role_id === 1 ? 'bg-indigo-50 text-indigo-500 ring-2 ring-indigo-500/10' :
                          user.role_id === 2 ? 'bg-amber-50 text-amber-500 ring-2 ring-amber-500/10' : 'bg-slate-50 text-gray-500'
                        }`}>
                          {user.roles?.name === 'admin' ? 'Administrador' : 
                           user.roles?.name === 'coordinator' ? 'Méntor' : 'Estudiante'}
                        </span>
                        
                        {currentUser?.role_id === 1 && user.id !== currentUser.id && (
                          <div className="relative group/sel max-w-[140px]">
                             <select 
                              value={user.role_id}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={updatingId === user.id}
                              className="w-full appearance-none bg-slate-50 border border-transparent hover:border-indigo-200 p-2 px-3 rounded-xl text-[8px] font-black uppercase tracking-widest text-indigo-400 cursor-pointer outline-none transition-all"
                             >
                              <option value={3}>Hacer Estudiante</option>
                              <option value={2}>Hacer Coordinador</option>
                              <option value={1}>Hacer Administrador</option>
                             </select>
                             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                 <Icons.Chevron />
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-10 border-b border-gray-50">
                    <div className="flex flex-col gap-3">
                      {getTypeBadge(user.student_type)}
                      {currentUser?.role_id === 1 && user.role_id === 3 && (
                        <div className="relative group/sel max-w-[140px]">
                            <select 
                              value={user.student_type || 'otro'}
                              onChange={(e) => changeStudentType(user.id, e.target.value)}
                              className="w-full appearance-none bg-slate-50/50 border border-transparent hover:border-secondary-color p-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 cursor-pointer outline-none transition-all"
                            >
                              <option value="validación">Validación</option>
                              <option value="técnico">Técnico</option>
                              <option value="diplomado">Diplomado</option>
                              <option value="ies">IES</option>
                              <option value="otro">Otro</option>
                              <option value="graduado">Graduado</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                <Icons.Chevron />
                            </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-10 border-b border-gray-50">
                    {user.role_id === 3 ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-primary-color">{user.coordinator?.full_name || 'Sin Mentor'}</span>
                        {currentUser?.role_id === 1 && (
                          <div className="relative group/sel max-w-[140px]">
                            <select 
                              value={user.coordinator_id || ''} 
                              onChange={(e) => assignCoordinator(user.id, e.target.value)}
                              className="w-full appearance-none bg-slate-50/50 border border-transparent hover:border-secondary-color p-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 cursor-pointer outline-none transition-all"
                            >
                              <option value="">Cambiar Mentor</option>
                              {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                <Icons.Chevron />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : <span className="text-[10px] font-black text-slate-300 italic">No aplicable</span>}
                  </td>
                  <td className="p-10 border-b border-gray-50">
                    <button 
                      onClick={() => toggleStatus(user)}
                      className="group/btn flex items-center gap-2 hover:scale-105 transition-transform"
                      disabled={updatingId === user.id}
                    >
                      {getStatusBadge(user.status)}
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity">
                         <Icons.Check />
                      </span>
                    </button>
                  </td>
                  <td className="p-10 border-b border-gray-50 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                      <button 
                         onClick={() => handleOpenPasswordModal(user)}
                         className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-lg hover:shadow-xl hover:bg-slate-50 transition-all"
                         title="Seguridad"
                      >🔑</button>
                      
                      <button 
                         onClick={() => handleManualActivate(user.id)}
                         disabled={updatingId === user.id}
                         className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center text-lg hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                         title="Validar Correo Manualmente"
                      >🛡️</button>
                      
                      {currentUser?.role_id === 1 && (
                        <button 
                           onClick={() => handleDeleteUser(user.id)}
                           className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                           title="Eliminar Permanente"
                        ><Icons.Trash /></button>
                      )}
                      
                      {user.whatsapp && (
                        <a 
                          href={`https://wa.me/57${user.whatsapp}`} 
                          target="_blank"
                          className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        >📞</a>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="p-32 text-center text-gray-300 font-medium italic">
                    No hay miembros registrados bajo estos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        }
      </section>

        {/* MODAL DE REGISTRO INTEGRAL PREMIUM */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop border border-white/20">
            <header className="p-12 pb-0 flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Módulo de Admisiones</span>
                <h2 className="text-4xl font-black text-primary-color font-display leading-none tracking-tighter">Registrar Perfil</h2>
                <p className="text-gray-400 text-sm font-medium pt-2">Alta de nuevos integrantes en el ecosistema Fundetec.</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >✕</button>
            </header>

            <form onSubmit={handleCreateUser} className="p-12 pt-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Nombre Completo</label>
                  <input 
                    type="text" required
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                    placeholder="Ej: Julian Alandete"
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Correo Institucional</label>
                  <input 
                    type="email" required
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                    placeholder="ejemplo@fundetec.edu.co"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">WhatsApp Directo</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                    placeholder="300 000 0000"
                    value={formData.whatsapp}
                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  />
                </div>
                <div className="space-y-2 relative">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Contraseña Temporal</label>
                   <input 
                    type="text" required
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                        const chars = "abcdefghijklmnopqrstuvwxyz789!@#$%^&*";
                        let pass = "";
                        for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
                        setFormData({...formData, password: pass});
                    }}
                    className="absolute right-3 bottom-2.5 p-2 bg-white rounded-xl text-[10px] font-bold border border-gray-100 hover:bg-slate-50 shadow-sm transition-all"
                  >🎲</button>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Modalidad Académica</label>
                  <select 
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer appearance-none shadow-inner"
                    value={formData.student_type}
                    onChange={e => setFormData({...formData, student_type: e.target.value})}
                  >
                    <option value="validación">Validación</option>
                    <option value="técnico">Técnico</option>
                    <option value="diplomado">Diplomado</option>
                    <option value="ies">IES</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Estado de Cuenta</label>
                  <select 
                    className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer appearance-none shadow-inner"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="graduado">Graduado</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                   type="button" 
                   onClick={() => setIsCreateModalOpen(false)}
                   className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 transition-all"
                >Descartar</button>
                <button 
                   type="submit" 
                   disabled={loading}
                   className="flex-1 bg-primary-color text-white py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20"
                >{loading ? 'Procesando...' : 'Validar y Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE SEGURIDAD PREMIUM */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsPasswordModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop p-12 space-y-8 border border-white/20">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Protocolo de Seguridad</span>
              <h2 className="text-3xl font-black text-primary-color font-display tracking-tighter">Resetear Clave</h2>
            </div>
            
            <div className="space-y-6">
              <div className="relative">
                 <input 
                    type="text" 
                    className="w-full bg-slate-50 border-none p-6 rounded-[28px] outline-none font-bold text-primary-color shadow-inner text-xl" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nueva clave..."
                 />
                 <button onClick={generateRandomPassword} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-all">🎲</button>
              </div>
              <p className="text-[10px] text-gray-400 font-medium italic text-center px-4">Asegúrate de comunicar la nueva contraseña al usuario inmediatamente después del cambio.</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleResetPassword}
                className="w-full bg-primary-color text-white py-6 rounded-[28px] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-primary-color/20 hover:bg-secondary-color hover:text-primary-color transition-all"
              >Confirmar Cambio</button>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-primary-color transition-all"
              >Cancelar Protocolo</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
