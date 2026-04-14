'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';
import { 
  updateProfileMetadata, 
  updateUserPassword,
  manualGraduateStudent
} from '@/app/actions/admin_actions';
import { generatePDFReport, generateExcelReport } from '@/utils/reportGenerators';

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
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('');
  const [isGraduating, setIsGraduating] = useState(false);
  
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
      .select(`
        id, 
        full_name, 
        created_at, 
        role_id, 
        student_type, 
        status, 
        whatsapp,
        coordinator:coordinator_id(full_name)
      `)
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

  const handleManualGraduate = async (studentId) => {
    if (!confirm('¿Estás seguro de graduar oficialmente a este estudiante? Esta acción no se puede deshacer.')) return;
    
    setIsGraduating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await manualGraduateStudent(studentId, session.user.user_metadata.role_id || 2);
      
      if (res.success) {
        alert('🎓 Estudiante graduado con éxito.');
        setSelectedStudentDetail(prev => ({ ...prev, status: 'graduado' }));
        fetchData();
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGraduating(false);
    }
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
      'graduado': 'bg-indigo-50 text-indigo-600 ring-indigo-500/10',
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
                  <option value="graduado">Graduado</option>
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
                          <button 
                            onClick={() => setSelectedStudentDetail(s)}
                            className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-[14px] hover:bg-slate-50 transition-all shadow-sm" 
                            title="Ver Expediente"
                          >📑</button>
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
          <section className="space-y-6">
             <div className="flex justify-between items-center px-2">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Reportes Elite</h4>
                <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const url = generatePDFReport(myStudents, 'Mentoría Total', 'Coordinador', true);
                        setPdfPreviewUrl(url);
                        setPdfPreviewTitle('Mentoría Total');
                      }}
                      className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center text-xs hover:bg-indigo-500 hover:text-white transition-all" 
                      title="Previsualizar PDF"
                    >👁️</button>
                    <button onClick={() => generateExcelReport(myStudents, 'Mentoría Total')} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs hover:bg-emerald-500 hover:text-white transition-all" title="Excel Total">📊</button>
                    <button onClick={() => generatePDFReport(myStudents, 'Mentoría Total', 'Coordinador')} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition-all" title="PDF Total">📑</button>
                </div>
             </div>
             
             {/* TARJETA ACTIVOS (MESH AZUL) */}
             <div className="group relative bg-primary-color p-8 rounded-[42px] text-white shadow-2xl overflow-hidden border border-white/5 transition-all hover:scale-[1.02]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] rounded-full animate-glow-pulse"></div>
                <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Matrícula Vigente</span>
                        <h5 className="text-4xl font-black font-display leading-none">{myStudents.filter(s=>s.status==='activo').length}</h5>
                        <p className="text-[10px] font-bold text-blue-200">Alumnos Activos</p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                          onClick={() => {
                            const url = generatePDFReport(myStudents.filter(s=>s.status==='activo'), 'Estudiantes Activos', 'Coordinador', true);
                            setPdfPreviewUrl(url);
                            setPdfPreviewTitle('Estudiantes Activos');
                          }}
                          className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-white hover:text-primary-color transition-all shadow-xl"
                       >👁️</button>
                       <button 
                          onClick={() => generatePDFReport(myStudents.filter(s=>s.status==='activo'), 'Estudiantes Activos', 'Coordinador')}
                          className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-white hover:text-primary-color transition-all shadow-xl"
                       >📥</button>
                    </div>
                </div>
             </div>

             {/* TARJETA GRADUADOS (MESH VERDE) */}
             <div className="group relative bg-secondary-color p-8 rounded-[42px] text-primary-color shadow-2xl overflow-hidden border border-white/10 transition-all hover:scale-[1.02]">
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary-color/5 blur-[40px] rounded-full"></div>
                <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Casos de Éxito</span>
                        <h5 className="text-4xl font-black font-display leading-none text-primary-color">{myStudents.filter(s=>s.status==='graduado').length}</h5>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Graduados</p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                          onClick={() => {
                            const url = generatePDFReport(myStudents.filter(s=>s.status==='graduado'), 'Estudiantes Graduados', 'Coordinador', true);
                            setPdfPreviewUrl(url);
                            setPdfPreviewTitle('Estudiantes Graduados');
                          }}
                          className="w-12 h-12 bg-primary-color/5 text-primary-color rounded-2xl flex items-center justify-center hover:bg-primary-color hover:text-white transition-all shadow-xl font-bold"
                       >👁️</button>
                       <button 
                          onClick={() => generatePDFReport(myStudents.filter(s=>s.status==='graduado'), 'Estudiantes Graduados', 'Coordinador')}
                          className="w-12 h-12 bg-primary-color text-white rounded-2xl flex items-center justify-center hover:rotate-6 transition-all shadow-xl"
                       >🎓</button>
                    </div>
                </div>
             </div>

             {/* DESGLOSE POR MODALIDAD */}
             <div className="bg-white p-8 rounded-[42px] border border-gray-100 shadow-sm space-y-6">
                <header className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest italic">Por Modalidad</span>
                    <span className="text-[10px] font-bold px-3 py-1 bg-slate-100 rounded-full text-gray-500">{myStudents.length} TOTAL</span>
                </header>
                <div className="space-y-3">
                    {['validación', 'técnico', 'diplomado', 'ies'].map(type => {
                        const count = myStudents.filter(s => s.student_type === type).length;
                        if (count === 0) return null;
                        return (
                            <div key={type} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-gray-100 transition-all group">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{type}</span>
                                    <span className="text-sm font-black text-primary-color">{count} Alumnos</span>
                                </div>
                                <button 
                                    onClick={() => generateExcelReport(myStudents.filter(s => s.student_type === type), `Programa_${type}`)}
                                    className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >📁</button>
                            </div>
                        );
                    })}
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
                    <option value="graduado">Graduado</option>
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

      {/* MODAL EXPEDIENTE DETALLADO ELITE */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 md:p-10">
           <div 
             className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-3xl animate-fade-in" 
             onClick={() => setSelectedStudentDetail(null)}
           ></div>
           
           <div className="relative w-full max-w-4xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop flex flex-col md:flex-row h-full max-h-[85vh]">
              {/* Lateral Visual / Cover */}
              <div className="md:w-1/3 bg-primary-color relative overflow-hidden flex flex-col justify-center items-center p-12 text-center border-r border-white/5">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-color/20 blur-[80px] rounded-full -mr-20 -mt-20"></div>
                 
                 <div className="relative z-10 space-y-6">
                    <div className="w-40 h-40 rounded-[56px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-6xl font-black text-white shadow-2xl">
                       {selectedStudentDetail.full_name?.charAt(0)}
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-2xl font-black text-white leading-tight">{selectedStudentDetail.full_name}</h3>
                       <div className="inline-block px-4 py-1.5 bg-secondary-color text-primary-color rounded-full text-[9px] font-black uppercase tracking-widest">
                          {selectedStudentDetail.student_type}
                       </div>
                    </div>
                 </div>
                 
                 <div className="absolute bottom-10 left-0 right-0 px-12 opacity-40">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-2">ID Sistema Fundetec</p>
                    <p className="text-[8px] font-mono whitespace-nowrap overflow-hidden text-ellipsis">{selectedStudentDetail.id}</p>
                 </div>
              </div>

              {/* Contenido de Ficha */}
              <div className="flex-1 p-8 md:p-16 overflow-y-auto space-y-12">
                 <header className="flex justify-between items-start">
                    <div className="space-y-1">
                       <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.4em]">Ficha Técnica</span>
                       <h2 className="text-3xl font-black text-primary-color font-display">Expediente Académico</h2>
                    </div>
                    <button 
                      onClick={() => setSelectedStudentDetail(null)}
                      className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >✕</button>
                 </header>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Sección Contacto */}
                    <div className="space-y-6">
                       <h4 className="text-[11px] font-black uppercase text-gray-300 tracking-[0.2em] border-b border-gray-100 pb-2">Información de Contacto</h4>
                       <div className="space-y-4">
                          <div className="flex items-center gap-4 group">
                             <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📧</div>
                             <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Correo Institucional</p>
                                <p className="text-sm font-black text-primary-color">{selectedStudentDetail.email || 'No registrado'}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4 group">
                             <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📱</div>
                             <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp</p>
                                <p className="text-sm font-black text-primary-color">{selectedStudentDetail.whatsapp || 'Sin número'}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Sección Académica */}
                    <div className="space-y-6">
                       <h4 className="text-[11px] font-black uppercase text-gray-300 tracking-[0.2em] border-b border-gray-100 pb-2">Trayectoria Académica</h4>
                       <div className="space-y-4">
                          <div className="flex items-center gap-4 group">
                             <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📅</div>
                             <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Fecha de Ingreso</p>
                                <p className="text-sm font-black text-primary-color">{new Date(selectedStudentDetail.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4 group">
                             <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">👤</div>
                             <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Mentor Asignado</p>
                                <p className="text-sm font-black text-primary-color">{selectedStudentDetail.coordinator?.full_name || 'Sin asignar'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Botones de Acción */}
                 <div className="pt-10 flex flex-wrap gap-4">
                    {selectedStudentDetail.whatsapp && (
                       <a 
                         href={`https://wa.me/57${selectedStudentDetail.whatsapp}`} 
                         target="_blank" 
                         className="flex-1 min-w-[200px] bg-emerald-500 text-white py-5 rounded-[28px] font-black text-[11px] uppercase tracking-widest text-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3"
                       >
                          <span>💬</span> Contactar por WhatsApp
                       </a>
                    )}
                    <button 
                      onClick={() => generatePDFReport([selectedStudentDetail], `Expediente_${selectedStudentDetail.full_name}`, 'Coordinador')}
                      className="flex-1 min-w-[200px] bg-slate-100 text-primary-color py-5 rounded-[28px] font-black text-[11px] uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all shadow-lg flex items-center justify-center gap-3"
                    >
                       <span>📑</span> Descargar Ficha PDF
                    </button>
                    {selectedStudentDetail.status !== 'graduado' && (
                       <button 
                         onClick={() => handleManualGraduate(selectedStudentDetail.id)}
                         disabled={isGraduating}
                         className="flex-1 min-w-[200px] bg-primary-color text-white py-5 rounded-[28px] font-black text-[11px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl disabled:opacity-50"
                       >
                          <span>🎓</span> {isGraduating ? 'Procesando grado...' : 'Autorizar Graduación'}
                       </button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA PDF ELITE */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 md:p-10 animate-fade-in">
           <div className="absolute inset-0 bg-primary-color/40 backdrop-blur-2xl" onClick={() => setPdfPreviewUrl(null)}></div>
           <div className="relative w-full max-w-5xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop flex flex-col h-full max-h-[90vh]">
              <header className="p-10 flex justify-between items-center border-b border-gray-100 bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-color text-white flex items-center justify-center text-xl shadow-lg shadow-primary-color/20">👁️</div>
                    <div className="space-y-1">
                       <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.4em]">Vista Previa Institucional</span>
                       <h2 className="text-2xl font-black text-primary-color font-display uppercase tracking-tight">{pdfPreviewTitle}</h2>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = pdfPreviewUrl;
                        link.download = `Reporte_${pdfPreviewTitle.replace(/\s+/g, '_')}.pdf`;
                        link.click();
                      }}
                      className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2"
                    >
                       <span>📥</span> Descargar Ahora
                    </button>
                    <button 
                      onClick={() => setPdfPreviewUrl(null)} 
                      className="w-14 h-14 rounded-full bg-white border border-gray-100 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >✕</button>
                 </div>
              </header>
              <div className="flex-1 bg-slate-200 relative">
                 <iframe 
                   src={`${pdfPreviewUrl}#toolbar=0`} 
                   className="w-full h-full border-none"
                   title="PDF Preview"
                 ></iframe>
              </div>
              <footer className="p-6 bg-slate-50 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                 Fundetec Academy - Generador de Reportes Oficial
              </footer>
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
