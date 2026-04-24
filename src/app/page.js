'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import ContactForm from '@/components/ContactForm';
import { supabase } from '@/lib/supabase';

// Imágenes dinámicas gestionadas desde /admin/landing
const DEFAULT_COURSE_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800";

export default function Home() {
  const [sections, setSections] = useState({});
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFaq, setActiveFaq] = useState(null);

  useEffect(() => {
    initLanding();
  }, []);

  const initLanding = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchSections(), fetchCourses()]);
    } catch (error) {
      console.error('Error in initLanding:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const { data } = await supabase.from('landing_sections').select('*');
      const sectionMap = {};
      data?.forEach(s => { sectionMap[s.slug] = s; });
      setSections(sectionMap);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      setCourses(data || []);
      setFilteredCourses(data || []);
    } catch (error) {
      console.error('Error loading public courses:', error);
    }
  };

  useEffect(() => {
    const results = courses.filter(course =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCourses(results);
  }, [searchTerm, courses]);

  const getSection = (slug) => sections[slug] || { title: '', subtitle: '', content: {}, is_visible: true };

  const faqs = [
    { q: "¿Los diplomados son certificados?", a: "Sí, todos nuestros programas cuentan con certificación institucional avalada, ideal para fortalecer tu perfil profesional y laboral." },
    { q: "¿Cómo es la metodología de estudio?", a: "Nuestra metodología es 100% flexible y virtual. Tendrás acceso 24/7 a nuestra aula premium, donde podrás avanzar a tu propio ritmo con materiales de alta calidad." },
    { q: "¿Cuáles son los medios de pago?", a: "Aceptamos transferencias bancarias, pagos con tarjeta de crédito/débito a través de plataformas seguras y convenios de recaudo presencial." },
    { q: "¿Ofrecen bachillerato para adultos?", a: "¡Claro que sí! Contamos con el programa CLEI que permite a jóvenes y adultos terminar su bachillerato de forma acelerada y legal." }
  ];

  if (loading && Object.keys(sections).length === 0) {
    return (
      <div className="min-h-screen bg-primary-color flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-secondary-color border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-black tracking-widest text-xs uppercase">Iniciando Fundetec...</p>
        </div>
      </div>
    );
  }

  const hero = getSection('hero');
  const stats = getSection('stats');
  const categories = getSection('categories');
  const bachillerato = getSection('bachillerato');
  const tecnicos = getSection('tecnicos');
  const contacto = getSection('contacto');
  const institucional = getSection('institucional');

  return (
    <div className="bg-white min-h-screen selection:bg-secondary-color selection:text-primary-color">
      <Navbar />

      <main className="overflow-hidden">
        {/* HERO SECTION */}
        {hero.is_visible && (
          <section id="inicio" className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
            {/* MESH GRADIENT BACKGROUND */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-color/10 blur-[120px] rounded-full animate-glow-pulse"></div>
              <div className="absolute top-[20%] right-[5%] w-[30%] h-[30%] bg-secondary-color/10 blur-[100px] rounded-full animate-mesh-float"></div>
              <div className="absolute bottom-[10%] left-[20%] w-[50%] h-[50%] bg-accent-color/5 blur-[150px] rounded-full opacity-50"></div>
              <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#0C1E45_1px,transparent_1px)] [background-size:32px_32px]"></div>
            </div>

            <div className="container mx-auto px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                <div className="lg:col-span-7 space-y-12 animate-fade-in">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-color/10 border border-secondary-color/20 rounded-full">
                       <span className="w-2 h-2 bg-secondary-color rounded-full animate-pulse"></span>
                       <span className="text-secondary-color text-[10px] font-black uppercase tracking-[0.3em]">
                        {hero.content.preTitle || "Academia de Excelencia"}
                       </span>
                    </div>
                    
                    <h1 
                      className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] font-display text-primary-color"
                      style={{ letterSpacing: '-0.04em' }}
                    >
                      <span className="block text-premium-gradient" dangerouslySetInnerHTML={{ __html: hero.title || "Tu Título Académico Más Cerca de Ti" }} />
                    </h1>

                    <p 
                      className="text-xl text-gray-500 font-medium max-w-xl leading-relaxed text-balance"
                      dangerouslySetInnerHTML={{ __html: hero.subtitle || "Educación 100% Virtual con validez oficial. Estudia a tu ritmo, obtén tu título CLEI o certifícate en los Técnicos Laborales de mayor demanda." }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <a href={hero.content.cta1_link || "#tecnicos"} className="group relative px-12 py-6 bg-primary-color text-white rounded-[28px] font-black text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-primary-color/40">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <span className="relative z-10">{hero.content.cta1_text || "Iniciar Matrícula 🚀"}</span>
                    </a>
                    <a href={hero.content.cta2_link || "#bachillerato"} className="px-12 py-6 glass-card text-primary-color rounded-[28px] font-black text-sm uppercase tracking-widest hover:bg-white transition-all active:scale-95 flex items-center gap-2">
                      {hero.content.cta2_text || "Explorar Programas"}
                    </a>
                  </div>

                  <div className="flex items-center gap-12 pt-10 border-t border-gray-100/50">
                    <div className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center group-hover:scale-110 transition-transform">🏅</div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Institución<br/>Certificada</span>
                    </div>
                    <div className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-xl bg-secondary-color/10 flex items-center justify-center group-hover:scale-110 transition-transform">🌍</div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Educación<br/>100% Virtual</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 relative">
                  {/* HERO IMAGE GLOW */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-primary-color to-secondary-color opacity-20 blur-[60px] animate-glow-pulse -z-10 rounded-full"></div>
                  
                  <div className="relative z-10 p-4 glass-card rounded-[70px]">
                    <div className="rounded-[60px] overflow-hidden shadow-2xl border-[4px] border-white ring-1 ring-gray-100">
                      <img src={hero.content.image_url || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80"} alt="Fundetec Academy" className="w-full h-auto" />
                    </div>
                  </div>
                  
                  {/* FLOATING DECOR */}
                  <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-secondary-color rounded-[40px] -z-10 rotate-12 shadow-2xl shadow-secondary-color/20 animate-bounce-slow"></div>
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-accent-color/20 rounded-[30px] -z-10 -rotate-12 blur-xl animate-pulse"></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* STATS RIBBON */}
        {stats.is_visible && (
          <section className="bg-primary-color py-20 relative z-20 shadow-2xl border-y border-white/5">
            <div className="container mx-auto px-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
                {[
                  { v: stats.content.stat1_val || '+15', l: stats.content.stat1_label || 'Años de Experiencia' },
                  { v: stats.content.stat2_val || '10K+', l: stats.content.stat2_label || 'Alumnos Graduados' },
                  { v: stats.content.stat3_val || '100%', l: stats.content.stat3_label || 'Certificación Legal' },
                  { v: stats.content.stat4_val || '24/7', l: stats.content.stat4_label || 'Aula Virtual Premium' }
                ].map((item, i) => (
                  <div key={i} className="space-y-2 group">
                    <h4 className="text-5xl md:text-6xl font-black text-secondary-color font-display tracking-tighter group-hover:scale-110 transition-transform duration-500">{item.v}</h4>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">{item.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CATEGORIES / VALUES */}
        {categories.is_visible && (
          <section className="py-32 bg-gray-50/50">
            <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {Array.isArray(categories.content.items) && categories.content.items.map((cat, i) => (
                  <div key={i} className="group bg-white p-12 rounded-[48px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-4">
                    <span className="text-6xl mb-8 block grayscale group-hover:grayscale-0 transition-all group-hover:scale-110 duration-500">
                      {cat.icon || "🎓"}
                    </span>
                    <h3 className="text-2xl font-black text-primary-color mb-4 leading-tight">{cat.title}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed mb-8">{cat.desc}</p>
                    <a href={cat.link || "#"} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary-color hover:gap-4 transition-all">
                      Saber más <span>→</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* BACHILLERATO SECTION */}
        {bachillerato.is_visible && (
          <section id="bachillerato" className="py-32 overflow-hidden">
            <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="relative">
                  <div className="rounded-[48px] overflow-hidden shadow-2xl relative z-10 border-[8px] border-white">
                    <img src={bachillerato.content.image_url || "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80"} alt="Bachillerato CLEI" className="w-full h-auto" />
                  </div>
                  <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary-color/5 blur-[80px] -z-10 rounded-full"></div>
                </div>

                <div className="space-y-8">
                  <span className="inline-block px-4 py-1.5 bg-primary-color text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                    {bachillerato.content.badge || "Programa CLEI"}
                  </span>
                  <h2 
                    className="text-5xl md:text-6xl font-black text-primary-color tracking-tighter leading-none font-display"
                    dangerouslySetInnerHTML={{ __html: bachillerato.title || "Termina tu Bachillerato" }}
                  />
                  <p 
                    className="text-lg text-gray-500 font-medium leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: bachillerato.subtitle || "Diseñado para jóvenes y adultos que desean certificar sus estudios de forma rápida y legal." }}
                  />

                  <ul className="space-y-4">
                    {Array.isArray(bachillerato.content.points) && bachillerato.content.points.map((p, i) => (
                      <li key={i} className="flex items-center gap-4 text-sm font-bold text-primary-color/70">
                        <span className="w-6 h-6 bg-secondary-color/20 text-secondary-color rounded-full flex items-center justify-center text-xs">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-6">
                    <a href="#contacto" className="inline-block px-12 py-5 bg-primary-color text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/20">
                      Matricularme Ahora 🚀
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ACADEMIC OFFER */}
        {tecnicos.is_visible && (
          <section id="tecnicos" className="py-32 bg-[#F8FAFC]">
            <div className="container mx-auto px-6 space-y-16">
              <div className="text-center max-w-3xl mx-auto space-y-6">
                <h2 className="text-5xl md:text-6xl font-black text-primary-color tracking-tighter font-display leading-tight">
                  {tecnicos.title || "Oferta Académica"}
                </h2>
                <p className="text-lg text-gray-400 font-medium">
                  {tecnicos.subtitle || "Explora nuestros diplomados y programas técnicos certificados."}
                </p>

                <div className="relative max-w-xl mx-auto">
                  <input
                    type="text"
                    placeholder="¿Qué deseas aprender hoy?..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-10 py-6 bg-white border border-gray-100 rounded-[32px] font-bold text-primary-color shadow-sm focus:outline-none focus:ring-4 focus:ring-secondary-color/10 focus:border-secondary-color transition-all"
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {loading ? (
                  <div className="col-span-full py-20 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary-color border-t-transparent animate-spin rounded-full"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary-color">Buscando programas...</p>
                  </div>
                ) : filteredCourses.length > 0 ? (
                  filteredCourses.map((prog) => (
                    <div key={prog.id} className="group bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col">
                      <div className="relative h-56 overflow-hidden">
                        <img
                          src={prog.thumbnail_url || DEFAULT_COURSE_IMAGE}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-primary-color/60 to-transparent"></div>
                        <span className="absolute top-6 right-6 bg-secondary-color text-primary-color px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
                          {prog.price > 0 ? `$${prog.price.toLocaleString()}` : "Inscripción Abierta"}
                        </span>
                      </div>
                      <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <h4 className="text-xl font-black text-primary-color font-display leading-tight line-clamp-2">{prog.title}</h4>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🎓 Certificado Oficial</p>
                        </div>
                        <a href="#contacto" className="block text-center py-4 rounded-2xl bg-gray-50 text-primary-color font-black text-[10px] uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all">
                          Más información <span>→</span>
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-white rounded-[48px] border border-dashed border-gray-200">
                    <p className="text-lg font-bold text-gray-400">No encontramos resultados para tu búsqueda.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* FAQ SECTION - REDISEÑADO PREMIUM Y DINÁMICO */}
        {getSection('faq').is_visible && (
          <section id="faq" className="py-32 bg-slate-50/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
            
            <div className="container mx-auto px-6">
              <div className="text-center mb-20 space-y-4">
                <span className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-[0.4em] rounded-full">
                  {getSection('faq').content.preTitle || "Resolviendo Dudas"}
                </span>
                <h2 className="text-5xl md:text-6xl font-black text-primary-color font-display tracking-tight leading-none">
                  {getSection('faq').title || "Preguntas Frecuentes"}
                </h2>
                <p className="text-gray-400 font-medium max-w-2xl mx-auto italic">
                  {getSection('faq').subtitle || "Todo lo que necesitas saber sobre tu futuro académico en Fundetec."}
                </p>
              </div>
  
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {(getSection('faq').content.items || faqs).map((faq, i) => (
                  <div 
                    key={i} 
                    className={`group bg-white rounded-[40px] border transition-all duration-500 overflow-hidden cursor-pointer ${
                      activeFaq === i 
                        ? 'border-secondary-color shadow-2xl shadow-secondary-color/10 bg-white ring-1 ring-secondary-color' 
                        : 'border-white shadow-sm hover:shadow-xl hover:-translate-y-1 bg-white/80'
                    }`}
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  >
                    <div className="p-8 md:p-10 flex items-center justify-between gap-6">
                      <h4 className={`text-lg md:text-xl font-black font-display leading-tight transition-all duration-300 ${
                        activeFaq === i ? 'text-primary-color' : 'text-primary-color/80 group-hover:text-primary-color'
                      }`}>
                        {faq.q}
                      </h4>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                        activeFaq === i ? 'bg-secondary-color text-primary-color rotate-45' : 'bg-slate-50 text-gray-300 group-hover:bg-slate-100 group-hover:text-primary-color'
                      }`}>
                        <span className="text-2xl">+</span>
                      </div>
                    </div>
                    <div className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      activeFaq === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="px-8 md:px-10 pb-10">
                        <div className="w-12 h-1 bg-secondary-color/20 rounded-full mb-6"></div>
                        <p className="text-gray-500 font-medium text-lg leading-relaxed">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CONTACT SECTION */}
        {contacto.is_visible && (
          <section id="contacto" className="py-32 bg-primary-color text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[40%] h-full bg-secondary-color/5 -skew-x-12 translate-x-1/2"></div>

            <div className="container mx-auto px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-10">
                  <div className="space-y-4">
                    <h2 className="text-6xl font-black tracking-tighter leading-none font-display">
                      Comienza tu <span className="text-secondary-color">Éxito Académico</span>
                    </h2>
                    <p className="text-xl text-white/60 font-medium">Déjanos tus datos y un asesor se pondrá en contacto contigo en menos de 24 horas.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-6 group">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-xl group-hover:bg-secondary-color transition-all">📍</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Dirección</p>
                        <p className="text-lg font-bold">{institucional.content.address || "Medellín, Colombia"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 group">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-xl group-hover:bg-secondary-color transition-all">✉️</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Correo</p>
                        <p className="text-lg font-bold">{institucional.content.email || "admisiones@fundetec.edu.co"}</p>
                      </div>
                    </div>

                    {/* REDES SOCIALES DINÁMICAS */}
                    <div className="flex flex-wrap gap-4 pt-6">
                      {['facebook', 'instagram', 'whatsapp'].map(platform => {
                        const link = institucional.content[`${platform}_link`];
                        if (!link) return null;

                        const customImg = institucional.content[`${platform}_img`];
                        const fallbackImg = `https://cdn-icons-png.flaticon.com/512/${platform === 'facebook' ? '124/124010' : platform === 'instagram' ? '174/174855' : '733/733585'}.png`;


                        return (
                          <a
                            key={platform}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center overflow-hidden hover:bg-secondary-color hover:scale-110 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/20 p-4"
                          >
                            <img
                              src={customImg || fallbackImg}
                              alt={platform}
                              className="w-full h-full object-contain filter grayscale-0 group-hover:brightness-110"
                            />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="bg-white p-12 rounded-[56px] shadow-2xl relative z-10">
                    <ContactForm />
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary-color/20 blur-[80px] -z-10 rounded-full"></div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-[#0C1E45] text-white py-24 relative overflow-hidden">
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary-color/50 to-transparent"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary-color/5 blur-[120px] rounded-full"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-20">
            {/* Columna 1: Identidad */}
            <div className="space-y-6">
              <h3 className="text-xl font-black tracking-tighter italic">
                {institucional.content.academy_name || "Fundetec Academy"}
              </h3>
              <p className="text-white/50 text-sm leading-relaxed font-medium max-w-sm">
                {institucional.content.footer_description || "Comprometidos con la excelencia académica y la formación integral de líderes para el futuro. Nuestra metodología boutique garantiza un aprendizaje personalizado y de alta calidad."}
              </p>
              <div className="flex gap-4">
                <span className="w-8 h-px bg-secondary-color self-center"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary-color">Elite Education</p>
              </div>
            </div>

            {/* Columna 2: Navegación Core */}
            <div className="space-y-8">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Explorar</p>
              <ul className="space-y-4">
                {[
                  { name: 'Inicio', href: '#inicio' },
                  { name: 'Bachillerato para Adultos', href: '#bachillerato' },
                  { name: 'Programas Técnicos', href: '#tecnicos' },
                  { name: 'Contacto Directo', href: '#contacto' }
                ].map((link, i) => (
                  <li key={i}>
                    <a href={link.href} className="text-sm font-bold text-white/70 hover:text-secondary-color transition-colors flex items-center gap-3 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary-color scale-0 group-hover:scale-100 transition-transform"></span>
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Columna 3: Acreditaciones Legales */}
            <div className="space-y-8">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Legal & Avales</p>
              <div className="bg-white/5 p-8 rounded-[32px] border border-white/10 backdrop-blur-md">
                <p className="text-xs font-bold leading-relaxed italic text-white/80">
                  {institucional.content.certification_text || "Certificados por la Secretaría de Educación para el Trabajo y Desarrollo Humano."}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">
              {institucional.content.copyright_text || institucional.content.academy_name || "Fundetec Academy"} © {new Date().getFullYear()}
            </p>
            <div className="flex gap-8">
              <a href="/privacidad" className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors">Privacidad</a>
              <a href="/terminos" className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors">Términos</a>
            </div>
          </div>
        </div>
      </footer>

      <a
        href={`https://wa.me/${institucional.content.whatsapp || '573332548940'}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-10 right-10 w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center text-3xl shadow-[0_20px_50px_rgba(34,197,94,0.4)] hover:scale-110 active:scale-90 transition-all z-50 animate-bounce-slow"
      >
        💬
      </a>

    </div>
  );
}
