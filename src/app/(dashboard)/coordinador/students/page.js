'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';
import { 
  registerNewUser, 
  updateProfileMetadata, 
  updateUserPassword 
} from '@/app/actions/admin_actions';

const Icons = {
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
};

export default function StudentsPage() {
  const { showNotification } = useNotification();
  const [myStudents, setMyStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '', email: '', password: '', whatsapp: '', 
    role_id: 3, student_type: 'validación', status: 'activo'
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUserId(session.user.id);

    // 1. Fetch Mis Estudiantes
    const myReq = supabase
      .from('profiles')
      .select('id, full_name, created_at, role_id, student_type, status, whatsapp')
      .eq('coordinator_id', session.user.id)
      .eq('role_id', 3)
      .order('created_at', { ascending: false });

    // 2. Fetch Sin Asignar (Sugerencias)
    const unReq = supabase
      .from('profiles')
      .select('id, full_name, created_at, role_id')
      .is('coordinator_id', null)
      .eq('role_id', 3)
      .limit(6);

    const [myRes, unRes] = await Promise.all([myReq, unReq]);
    
    if (!myRes.error) setMyStudents(myRes.data);
    if (!unRes.error) setUnassignedStudents(unRes.data);
    setLoading(false);
  };

  const filteredStudents = myStudents.filter(s => {
    const matchesSearch = s.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || s.student_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formData, role_id: 3 };
    const res = await registerNewUser(payload, currentUserId, 2);
    
    if (res.success) {
      showNotification('✅ Nuevo estudiante registrado en tu grupo.', 'success');
      setIsCreateModalOpen(false);
      setFormData({ full_name: '', email: '', password: '', whatsapp: '', role_id: 3, student_type: 'validación', status: 'activo' });
      fetchData();
    } else {
      showNotification('Error: ' + res.error, 'error');
    }
    setLoading(false);
  };

  const toggleStatus = async (student) => {
    const newStatus = student.status === 'activo' ? 'inactivo' : 'activo';
    setUpdatingId(student.id);
    const res = await updateProfileMetadata(student.id, { status: newStatus });
    if (res.success) {
      setMyStudents(myStudents.map(s => s.id === student.id ? { ...s, status: newStatus } : s));
      showNotification('Estado actualizado.', 'success');
    }
    setUpdatingId(null);
  };

  const claimStudent = async (studentId) => {
    setUpdatingId(studentId);
    const { error } = await supabase
      .from('profiles')
      .update({ coordinator_id: currentUserId })
      .eq('id', studentId);
    
    if (!error) {
      showNotification('Alumno vinculado a tu gestión.', 'success');
      fetchData();
    } else {
      showNotification('Error al vincular: ' + error.message, 'error');
    }
    setUpdatingId(null);
  };

  const handleOpenPasswordModal = (student) => {
    setSelectedStudent(student);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await updateUserPassword(selectedStudent.id, newPassword);
    if (res.success) {
      showNotification('Clave de rescate asignada.', 'success');
      setIsPasswordModalOpen(false);
    } else {
      showNotification(res.error, 'error');
    }
    setLoading(false);
  };

  const getTypeBadge = (type) => {
    const types = {
      'validación': 'bg-green-50 text-green-500 ring-green-500/10',
      'técnico': 'bg-blue-50 text-blue-500 ring-blue-500/10',
      'diplomado': 'bg-purple-50 text-purple-600 ring-purple-500/10',
      'ies': 'bg-orange-50 text-orange-600 ring-orange-500/10',
      'otro': 'bg-slate-50 text-slate-400 ring-slate-500/10'
    };
    return (
      <span className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ring-2 ${types[type] || types['otro']}`}>
        {type || 'Estudiante'}
      </span>
    );
  };

  return (
    <div className="coordinator-students max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Gestión de <span className="text-secondary-color">Mentoría</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Administra tu grupo de estudiantes y vincula nuevos talentos.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="px-10 py-5 bg-primary-color text-white rounded-[32px] font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center gap-3"
        >
          <Icons.Plus /> Registrar Estudiante
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* TABLA PRINCIPAL */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[40px] border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1 w-full">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-20">🔍</span>
                <input 
                  type="text" 
                  placeholder="Buscar alumno por nombre..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-gray-100 p-4 pl-14 rounded-full outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all placeholder:text-gray-300"
                />
             </div>
             <div className="relative min-w-[200px] w-full md:w-auto">
                <select 
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border-none p-4 px-8 rounded-full outline-none font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer shadow-sm"
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
          </div>

          <div className="bg-white rounded-[56px] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
            {loading ? (
              <div className="p-40 text-center animate-pulse text-gray-300 font-black uppercase tracking-widest text-[10px]">Sincronizando Mentoría...</div>
            ) : (
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estudiante</th>
                    <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Modalidad</th>
                    <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estado</th>
                    <th className="p-8 text-right text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? filteredStudents.map(s => (
                    <tr key={s.id} className="group hover:bg-slate-50/30 transition-all">
                      <td className="p-8 border-b border-gray-50">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-primary-color text-white flex items-center justify-center font-black text-[10px] group-hover:bg-secondary-color group-hover:text-primary-color transition-all">
                             {s.full_name?.substring(0,2).toUpperCase()}
                           </div>
                           <div className="min-w-0">
                            <Link href={`/coordinador/students/${s.id}`}>
                               <h4 className="text-sm font-black text-primary-color truncate group-hover:text-secondary-color transition-colors hover:underline">{s.full_name}</h4>
                            </Link>
                            <p className="text-[9px] font-bold text-gray-300 uppercase">Matrícula: {new Date(s.created_at).toLocaleDateString()}</p>
                         </div>
                      </div>
                    </td>
                    <td className="p-8 border-b border-gray-50">
                      {getTypeBadge(s.student_type)}
                    </td>
                    <td className="p-8 border-b border-gray-50">
                       <button 
                          onClick={() => toggleStatus(s)}
                          className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${s.status === 'activo' ? 'bg-emerald-50 text-emerald-500 ring-2 ring-emerald-500/10' : 'bg-red-50 text-red-500 ring-2 ring-red-500/10'}`}
                       >
                          {s.status || 'activo'}
                       </button>
                    </td>
                    <td className="p-8 border-b border-gray-50 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                          <Link href={`/coordinador/students/${s.id}`} className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-[14px] hover:bg-slate-50 transition-all shadow-sm" title="Ver Expediente">📑</Link>
                          <Link href={`/coordinador/students/enroll?id=${s.id}`} className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-[14px] hover:bg-slate-50 transition-all shadow-sm" title="Matricular">📘</Link>
                          <button onClick={() => handleOpenPasswordModal(s)} className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center text-[14px] hover:bg-indigo-500 hover:text-white transition-all shadow-sm" title="Rescate">🔑</button>
                            {s.whatsapp && (
                              <a href={`https://wa.me/57${s.whatsapp}`} target="_blank" className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center text-[14px] hover:bg-emerald-500 hover:text-white transition-all shadow-sm">📞</a>
                            )}
                         </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="p-20 text-center text-gray-300 italic text-[11px] font-medium">No tienes estudiantes registrados en esta categoría.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* COLUMNA LATERAL BENTO */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-primary-color p-8 rounded-[48px] text-white space-y-6 shadow-2xl shadow-primary-color/20 relative overflow-hidden">
             <div className="relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Oportunidades</span>
                <h3 className="text-2xl font-black font-display leading-tight mt-2">Alumnos sin Mentor</h3>
                <p className="text-blue-100/60 text-xs mt-2 italic font-medium leading-relaxed">Hay talentos recién registrados que aún no tienen asignada una guía personalizada.</p>
                
                <div className="mt-8 space-y-3">
                   {unassignedStudents.map(s => (
                     <div key={s.id} className="bg-white/5 backdrop-blur-md p-4 rounded-[24px] border border-white/10 flex items-center justify-between group/item hover:bg-white transition-colors">
                        <div className="min-w-0">
                           <p className="text-[11px] font-black truncate group-hover/item:text-primary-color">{s.full_name}</p>
                           <p className="text-[9px] opacity-40 font-bold group-hover/item:text-primary-color/40">REG: {new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={() => claimStudent(s.id)}
                          disabled={updatingId === s.id}
                          className="w-10 h-10 bg-secondary-color text-primary-color rounded-2xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                        >
                          <Icons.Link />
                        </button>
                     </div>
                   ))}
                   {unassignedStudents.length === 0 && (
                     <p className="text-center py-8 opacity-30 italic text-[11px] font-medium">Todo el personal está bajo mentoría.</p>
                   )}
                </div>
             </div>
             {/* Decorativo */}
             <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-secondary-color rounded-full opacity-10 blur-3xl"></div>
          </section>

          <section className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-sm space-y-6">
             <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-2">Estadísticas de Grupo</h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-gray-100">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Activos</p>
                   <p className="text-3xl font-black text-emerald-500 mt-1">{myStudents.filter(s=>s.status==='activo').length}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-gray-100">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Total</p>
                   <p className="text-3xl font-black text-primary-color mt-1">{myStudents.length}</p>
                </div>
             </div>
          </section>
        </div>
      </div>

      {/* MODAL REGISTRO BOUTIQUE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/70 backdrop-blur-2xl animate-fade-in" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[72px] shadow-2xl overflow-hidden animate-pop">
            <header className="p-12 pb-0 flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-[11px] font-black text-secondary-color uppercase tracking-[0.4em]">Inscripción Directa</span>
                <h2 className="text-4xl font-black text-primary-color font-display leading-none tracking-tighter">Nuevo Estudiante</h2>
                <p className="text-gray-400 text-sm font-medium pt-2">Alta inmediata en tu grupo de mentoría personalizada en Fundetec.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all">✕</button>
            </header>

            <form onSubmit={handleCreateStudent} className="p-12 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Nombre Completo</label>
                  <input type="text" required className="w-full bg-slate-50 border-none p-5 rounded-[28px] outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10" placeholder="Ej: Julian Alandete" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Correo</label>
                  <input type="email" required className="w-full bg-slate-50 border-none p-5 rounded-[28px] outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10" placeholder="email@ejemplo.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">WhatsApp</label>
                  <input type="text" className="w-full bg-slate-50 border-none p-5 rounded-[28px] outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10" placeholder="300..." value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                </div>
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Modalidad</label>
                  <select className="w-full appearance-none bg-slate-50 border-none p-5 rounded-[28px] outline-none font-black text-[10px] uppercase text-primary-color cursor-pointer" value={formData.student_type} onChange={e => setFormData({...formData, student_type: e.target.value})}>
                    <option value="validación">Validación</option>
                    <option value="técnico">Técnico</option>
                    <option value="diplomado">Diplomado</option>
                    <option value="ies">IES</option>
                  </select>
                  <div className="absolute right-6 bottom-5 pointer-events-none opacity-40"><Icons.Chevron /></div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Contraseña Temporal</label>
                  <input type="text" required className="w-full bg-slate-50 border-none p-5 rounded-[28px] outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary-color text-white py-6 rounded-[32px] font-black text-[11px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/30">
                {loading ? 'Validando Inscripción...' : 'Confirmar Registro Institucional'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESCATE CLAVE */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/70 backdrop-blur-2xl animate-fade-in" onClick={() => setIsPasswordModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop p-14 space-y-10">
            <div className="text-center space-y-2">
                <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.4em]">Rescate de Acceso</span>
                <h2 className="text-3xl font-black text-primary-color font-display">Clave Manual</h2>
                <p className="text-gray-400 text-[11px] font-medium leading-relaxed">Asigna un acceso de emergencia para {selectedStudent?.full_name}.</p>
            </div>
            <input type="text" className="w-full bg-slate-50 border-none p-7 rounded-[28px] outline-none font-bold text-primary-color text-center tracking-widest text-lg" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Ej: Fundetec2024" />
            <button onClick={handleResetPassword} disabled={loading} className="w-full bg-primary-color text-white py-7 rounded-[32px] font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary-color/20 hover:bg-secondary-color hover:text-primary-color transition-all">Sincronizar Password</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .coordinator-students { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
