'use client';

import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function PrivacidadPage() {
  return (
    <div className="bg-white min-h-screen font-display selection:bg-secondary-color selection:text-primary-color">
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="container mx-auto px-6 max-w-4xl">
          <header className="mb-16 space-y-4">
            <span className="text-xs font-black text-secondary-color uppercase tracking-[0.4em]">Protección de Datos</span>
            <h1 className="text-5xl md:text-6xl font-black text-primary-color tracking-tighter leading-none">
              Política de <span className="text-secondary-color italic">Privacidad</span>
            </h1>
            <p className="text-gray-400 font-medium">Última actualización: Abril 2026</p>
          </header>

          <article className="prose prose-slate max-w-none space-y-12 text-lg text-gray-500 font-medium leading-relaxed">
            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">1. Identidad del Responsable</h2>
              <p>
                <strong>FUNDETEC</strong> (en adelante "La Institución"), conforme a lo dispuesto en la Ley 1581 de 2012 y el Decreto 1377 de 2013, informa a los titulares de datos personales que los datos recolectados a través de esta plataforma institucional serán tratados de manera segura y confidencial.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">2. Finalidad del Tratamiento</h2>
              <p>Los datos personales recolectados por FUNDETEC tienen como finalidad:</p>
              <ul className="list-disc pl-6 space-y-4">
                <li>Gestionar procesos de admisión, matrícula y certificación académica.</li>
                <li>Proveer servicios educativos a través del aula virtual.</li>
                <li>Enviar comunicaciones institucionales sobre novedades académicas, encuestas de satisfacción y promociones relacionadas con nuestra oferta educativa.</li>
                <li>Cumplir con las obligaciones legales ante las autoridades educativas de Colombia.</li>
              </ul>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">3. Derechos de los Titulares</h2>
              <p>Usted, como titular de los datos, tiene derecho a:</p>
              <ul className="list-disc pl-6 space-y-4">
                <li>Conocer, actualizar y rectificar sus datos personales frente al Responsable del Tratamiento o Encargado del Tratamiento.</li>
                <li>Solicitar prueba de la autorización otorgada a La Institución.</li>
                <li>Ser informado por el Responsable del Tratamiento, previa solicitud, respecto del uso que le ha dado a sus datos personales.</li>
                <li>Revocar la autorización y/o solicitar la supresión del dato cuando en el Tratamiento no se respeten los principios, derechos y garantías constitucionales y legales.</li>
              </ul>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">4. Seguridad de la Información</h2>
              <p>
                FUNDETEC ha implementado medidas técnicas, humanas y administrativas necesarias para otorgar seguridad a los registros evitando su adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento. Nuestra plataforma utiliza protocolos de cifrado y acceso restringido para garantizar que su información esté siempre protegida.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">5. Contacto</h2>
              <p>
                Para el ejercicio de sus derechos (Habeas Data), puede contactarnos a través de nuestro correo institucional: <strong>info@fundetec.co</strong> o mediante nuestro formulario de contacto en la página principal.
              </p>
            </section>
          </article>

          <footer className="mt-20 pt-10 border-t border-gray-100 italic">
            <Link href="/" className="text-sm font-black text-primary-color hover:text-secondary-color transition-colors uppercase tracking-widest flex items-center gap-2">
              <span>←</span> Volver al Inicio
            </Link>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .container { max-width: 1400px; margin: 0 auto; }
      `}</style>
    </div>
  );
}
