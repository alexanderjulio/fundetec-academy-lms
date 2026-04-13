'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [branding, setBranding] = useState({ site_name: 'FUNDETEC ACADEMY', logo_url: '' });
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    fetchBranding();

    const handleScrollProgress = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolledProgress = (winScroll / height) * 100;
      const progressBar = document.getElementById("progress-bar");
      if (progressBar) progressBar.style.width = scrolledProgress + "%";
    };

    const handleNavbarScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScrollProgress);
    window.addEventListener('scroll', handleNavbarScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScrollProgress);
      window.removeEventListener('scroll', handleNavbarScroll);
    };
  }, []);

  const fetchBranding = async () => {
    try {
      const { data } = await supabase.from('landing_sections').select('*').eq('slug', 'branding').single();
      if (data && data.content) {
        setBranding({ 
          site_name: data.content.site_name || 'FUNDETEC ACADEMY', 
          logo_url: data.content.logo_url || '' 
        });
      }
    } catch (e) {
      console.error('Error fetching branding:', e);
    }
  };

  const navLinks = [
    { name: 'Inicio', href: isHome ? '#inicio' : '/#inicio' },
    { name: 'Bachillerato', href: isHome ? '#bachillerato' : '/#bachillerato' },
    { name: 'Programas', href: isHome ? '#tecnicos' : '/#tecnicos' },
    { name: 'Contacto', href: isHome ? '#contacto' : '/#contacto' },
  ];

  return (
    <>
      <div className="fixed top-0 left-0 h-1 bg-secondary-color z-[1100] transition-all duration-300" id="progress-bar"></div>
      
      <nav className={`fixed top-0 left-0 w-full z-[1000] transition-all duration-500 ${
        scrolled || !isHome
          ? 'py-4 bg-white/95 backdrop-blur-2xl shadow-xl shadow-black/5 border-b border-gray-100' 
          : 'py-8 bg-transparent'
      }`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="group">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.site_name} className="h-10 w-auto" />
            ) : (
              <div className="flex flex-col">
                <span className={`text-2xl font-black font-display tracking-tighter leading-none transition-colors duration-300 ${scrolled || !isHome ? 'text-primary-color' : 'text-primary-color'}`}>
                  {branding.site_name.split(' ')[0]}
                </span>
                <span className="text-[10px] font-black text-secondary-color tracking-[0.3em] mt-0.5">
                  {branding.site_name.split(' ').slice(1).join(' ')}
                </span>
              </div>
            )}
          </Link>
          
          <div className="hidden lg:flex items-center gap-10">
            <div className="flex items-center gap-8 text-[11px] font-black uppercase tracking-widest">
              {navLinks.map((link) => (
                <a key={link.name} href={link.href} className="text-primary-color/60 hover:text-secondary-color transition-colors">
                  {link.name}
                </a>
              ))}
            </div>

            <div className="h-6 w-px bg-gray-200"></div>

            <div className="flex items-center gap-4">
              <Link href="/dashboard/courses" className="px-10 py-4 bg-secondary-color text-primary-color rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-secondary-color/20 hover:scale-105 active:scale-95 transition-all">
                Ir al Aula Virtual 🚀
              </Link>
            </div>
          </div>

          <button className="lg:hidden w-10 h-10 flex flex-col justify-center gap-1.5 items-end group">
            <div className="w-8 h-1 bg-primary-color rounded-full transition-all group-hover:w-10"></div>
            <div className="w-10 h-1 bg-primary-color rounded-full"></div>
            <div className="w-6 h-1 bg-primary-color rounded-full transition-all group-hover:w-10"></div>
          </button>
        </div>
      </nav>
    </>
  );
}

