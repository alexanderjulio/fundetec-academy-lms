'use client';

import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function TerminosPage() {
  return (
    <div className="bg-white min-h-screen font-display selection:bg-secondary-color selection:text-primary-color">
      <Navbar />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-6 max-w-4xl">
          <header className="mb-16 space-y-4">
            <span className="text-xs font-black text-secondary-color uppercase tracking-[0.4em]">Condiciones de Uso</span>
            <h1 className="text-5xl md:text-6xl font-black text-primary-color tracking-tighter leading-none">
              Términos y <span className="text-secondary-color italic">Condiciones</span>
            </h1>
            <p className="text-gray-400 font-medium">Última actualización: Abril 2026</p>
          </header>

          <article className="prose prose-slate max-w-none space-y-12 text-lg text-gray-500 font-medium leading-relaxed">
            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">1. Aceptación de Términos</h2>
              <p>
                Al acceder y utilizar el sitio web y el aula virtual de <strong>FUNDETEC</strong>, usted acepta cumplir y estar sujeto a los siguientes términos y condiciones de uso. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">2. Servicios Educativos</h2>
              <p>
                FUNDETEC ofrece programas de educación virtual, diplomados y bachillerato CLEI. La inscripción a estos programas otorga al estudiante una licencia limitada, no exclusiva y revocable para acceder al contenido educativo únicamente con fines de aprendizaje personal y no comercial.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">3. Propiedad Intelectual</h2>
              <p>
                Todo el contenido incluido en la plataforma, como textos, gráficos, logos, iconos, imágenes, clips de audio, material de video y software, es propiedad de FUNDETEC o de sus proveedores de contenido y está protegido por las leyes de derechos de autor nacionales e internacionales. Queda prohibida la reproducción, duplicación o distribución del material sin autorización expresa.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">4. Certificación Institucional</h2>
              <p>
                La expedición de certificados académicos está sujeta a la aprobación satisfactoria de los módulos evaluativos, el cumplimiento de las horas académicas requeridas y el pago total de los costos arancelarios correspondientes. FUNDETEC se reserva el derecho de verificar la identidad del estudiante antes de la emisión de cualquier título.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">5. Obligaciones del Estudiante</h2>
              <ul className="list-disc pl-6 space-y-4">
                <li>Proporcionar información veraz y actualizarla cuando sea necesario.</li>
                <li>Mantener el respeto y la ética académica en los foros y comunicaciones institucionales.</li>
                <li>No compartir las credenciales de acceso al aula virtual con terceros.</li>
                <li>Realizar los pagos correspondientes en las fechas estipuladas.</li>
              </ul>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight">6. Modificaciones</h2>
              <p>
                FUNDETEC se reserva el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en el sitio web. Es responsabilidad del usuario revisar periódicamente estos términos.
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
