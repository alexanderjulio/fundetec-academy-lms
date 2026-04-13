'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { sendLeadNotification } from '@/app/actions/email_actions';

export default function ContactForm() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    whatsapp: '',
    email: '',
    program_of_interest: 'Validación de bachillerato',
    message_detail: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('leads')
        .insert([formData]);

      if (error) throw error;

      const res = await sendLeadNotification(formData);
    
    if (res.success) {
      showNotification('¡Mensaje enviado con éxito! Un asesor te contactará pronto.', 'success');
    } else {
      console.warn('Fallo en notificación por correo:', res.error);
      showNotification('Mensaje guardado. Nuestro equipo revisará tu solicitud.', 'success');
    }

    setSuccess(true);
  } catch (err) {
      showNotification('Error enviando el mensaje: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="contact-success" style={{ background: '#ffffff', minHeight: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: '48px', border: '2px solid #eeeeee' }}>
        <h3 style={{ color: '#16A34A', fontSize: '2.5rem', fontWeight: '900', marginBottom: '1rem', fontFamily: 'sans-serif' }}>
          ¡MENSAJE ENVIADO!
        </h3>
        <p style={{ color: '#0C1E45', fontSize: '1.2rem', fontWeight: '700', marginBottom: '2rem', fontFamily: 'sans-serif' }}>
          Un asesor te contactará pronto.
        </p>
        <button
          onClick={() => {
            setFormData({
              full_name: '',
              whatsapp: '',
              email: '',
              program_of_interest: 'Validación de bachillerato',
              message_detail: ''
            });
            setSuccess(false);
          }}
          className="btn-success-reset"
          style={{ background: '#0C1E45', color: 'white', padding: '15px 30px', borderRadius: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="modern-form contact-form">
      <div className="form-group">
        <label>Nombre Completo</label>
        <input
          type="text"
          placeholder="Tu nombre aquí"
          required
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>WhatsApp</label>
          <input
            type="tel"
            placeholder="+57 3..."
            required
            value={formData.whatsapp}
            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            type="email"
            placeholder="ejemplo@correo.com"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>¿Qué te gustaría estudiar?</label>
        <select
          required
          value={formData.program_of_interest}
          onChange={(e) => setFormData({ ...formData, program_of_interest: e.target.value })}
        >
          <option value="Validación de bachillerato">Validación de bachillerato</option>
          <option value="Técnicos laborales">Técnicos laborales</option>
          <option value="Diplomados">Diplomados</option>
          <option value="IES - Instituto de Estudios para la Salud">IES - Instituto de Estudios para la Salud</option>
          <option value="Otros">Otros</option>
        </select>
      </div>

      <div className="form-group">
        <label>Detalle de tu mensaje</label>
        <textarea
          placeholder="Cuéntanos más sobre tus metas académnicas..."
          rows="4"
          required
          value={formData.message_detail}
          onChange={(e) => setFormData({ ...formData, message_detail: e.target.value })}
        ></textarea>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-full">
        {loading ? 'Enviando...' : 'Quiero recibir información'}
      </button>

      <style jsx>{`
        .contact-form { padding: 0.5rem 0; width: 100%; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .contact-success { 
          padding: 5rem 2rem; 
          text-align: center; 
          background: #ffffff !important; 
          border-radius: 48px; 
          border: 2px solid #f3f4f6;
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
        }
        .contact-success h3 { 
          font-family: 'Outfit', sans-serif; 
          font-size: 2.2rem; 
          font-weight: 900; 
          color: #16A34A !important; 
          margin-bottom: 1.5rem;
          line-height: 1.1;
        }
        .contact-success p { 
          color: #0C1E45 !important; 
          font-weight: 600; 
          font-size: 1.15rem; 
          line-height: 1.6; 
          margin-bottom: 2.5rem;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        .btn-success-reset {
          background: #0C1E45;
          color: white !important;
          padding: 1.2rem 2.5rem;
          border-radius: 20px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .btn-success-reset:hover {
          background: #16A34A;
          transform: translateY(-3px);
        }
        .modern-form { display: flex; flex-direction: column; gap: 1.8rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.7rem; }
        
        label { font-weight: 700; font-size: 0.85rem; color: var(--primary-color); text-transform: uppercase; letter-spacing: 1px; }
        
        input, select, textarea {
          padding: 1.1rem 1.4rem;
          border: 2px solid var(--gray-100);
          border-radius: var(--border-radius-lg);
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          background: white;
          color: var(--primary-color);
          transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }

        select option {
          color: var(--primary-color);
          background: white;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--secondary-color);
          box-shadow: 0 10px 25px rgba(22, 163, 74, 0.1);
          transform: translateY(-2px);
        }

        input::placeholder, textarea::placeholder { color: var(--gray-400); }

        .btn-primary {
          background: var(--primary-color);
          color: white;
          border: none;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(12, 30, 69, 0.2);
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          background: var(--secondary-color);
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(22, 163, 74, 0.3);
        }

        .btn-full { 
          width: 100%; 
          justify-content: center; 
          margin-top: 1.5rem;
          padding: 1.4rem !important;
          font-size: 0.9rem !important;
        }

        .btn-outline {
          border: 2px solid var(--primary-color);
          background: transparent;
          color: var(--primary-color);
          padding: 1rem 2rem;
          border-radius: 20px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-outline:hover {
          background: var(--primary-color);
          color: white;
        }

        @media (max-width: 600px) {
          .form-row { grid-template-columns: 1fr; gap: 1.8rem; }
        }
      `}</style>
    </form>
  );
}
