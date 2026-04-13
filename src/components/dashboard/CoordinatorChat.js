'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CoordinatorChat({ studentProfile }) {
  const [coordinator, setCoordinator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentProfile?.coordinator_id && studentProfile?.role_id === 3) {
      fetchCoordinator(studentProfile.coordinator_id);
    } else {
      setLoading(false);
    }
  }, [studentProfile]);

  const fetchCoordinator = async (id) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, whatsapp')
      .eq('id', id)
      .single();
    
    setCoordinator(data);
    setLoading(false);
  };

  if (loading || !coordinator?.whatsapp) return null;

  const whatsappUrl = `https://wa.me/${coordinator.whatsapp.replace(/\D/g, '')}`;

  return (
    <div className="coordinator-chat-anchor">
      <a 
        href={whatsappUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="coordinator-fab glass-card"
        title={`Chatear con ${coordinator.full_name}`}
      >
        <div className="fab-icon">💬</div>
        <div className="fab-text">
          <small>Soporte Académico</small>
          <strong>Contacta a tu coordinador</strong>
        </div>
      </a>

      <style jsx>{`
        .coordinator-chat-anchor {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 1000;
          animation: slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .coordinator-fab {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.8rem 1.5rem;
          background: white;
          border: 1px solid rgba(12, 30, 69, 0.1);
          border-radius: 100px;
          text-decoration: none;
          color: var(--primary-color);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }

        .coordinator-fab:hover {
          transform: translateY(-5px) scale(1.02);
          border-color: var(--secondary-color);
          box-shadow: 0 15px 35px rgba(22, 163, 74, 0.2);
        }

        .fab-icon {
          width: 40px;
          height: 40px;
          background: var(--secondary-color);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          box-shadow: 0 4px 10px rgba(22, 163, 74, 0.3);
        }

        .fab-text {
          display: flex;
          flex-direction: column;
        }

        .fab-text small {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--gray-400);
          letter-spacing: 0.5px;
        }

        .fab-text strong {
          font-size: 0.9rem;
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .fab-text { display: none; }
          .coordinator-fab { padding: 0.8rem; border-radius: 50%; }
        }
      `}</style>
    </div>
  );
}
