'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CoordinatorBillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('coordinator_invoices')
      .select(`
        *,
        items:coordinator_invoice_items(
          student:profiles(full_name)
        )
      `)
      .eq('coordinator_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setInvoices(data || []);
    setLoading(false);
  };

  return (
    <div className="coordinator-billing-page">
      <header className="page-header">
        <h1>Estado de Cuenta de Plataforma</h1>
        <p>Revisa tus facturas por el uso de la plataforma y descarga tus recibos de pago.</p>
      </header>

      {loading ? (
        <div className="text-center p-10">Cargando facturas...</div>
      ) : (
        <section className="dashboard-grid">
          <div className="invoices-list glass-card">
            <h2>Mis Facturas ({invoices.length})</h2>
            
            {invoices.length === 0 ? (
              <div className="empty-state">
                <span>🧾</span>
                <p>No tienes facturas generadas todavía.</p>
              </div>
            ) : (
              <div className="invoice-cards">
                {invoices.map(inv => (
                  <div key={inv.id} className={`invoice-card ${inv.status}`}>
                    <div className="card-header">
                      <div className="info">
                        <span className="date">{new Date(inv.created_at).toLocaleDateString()}</span>
                        <span className="id">REF: {inv.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <span className={`status-tag ${inv.status}`}>
                        {inv.status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                    
                    <div className="card-body">
                      <div className="amount">
                        <small>Total a Pagar</small>
                        <h3>${inv.total_amount.toLocaleString()} COP</h3>
                      </div>
                      <div className="students-summary">
                        <strong>{inv.items?.length || 0} Alumnos Facturados</strong>
                        <p className="description">{inv.notes || 'Pago por uso de plataforma'}</p>
                      </div>
                    </div>

                    <div className="card-footer">
                      <button className="btn btn-outline btn-small">Ver Alumnos</button>
                      {inv.status === 'paid' && (
                        <button className="btn btn-primary btn-small" onClick={() => generateBillingReceipt(inv)}>Descargar Recibo</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="billing-info glass-card">
            <h3>¿Cómo realizar el pago?</h3>
            <p>Para legalizar tus cuotas de plataforma, puedes realizar transferencia a las cuentas institucionales y reportar el comprobante al administrador.</p>
            <div className="payment-methods">
              <div className="method">
                <strong>Bancolombia</strong>
                <p>Ahorros: 123-456789-01</p>
              </div>
              <div className="method">
                <strong>Nequi / Daviplata</strong>
                <p>300 000 0000</p>
              </div>
            </div>
            <div className="info-alert">
              <p>📍 Recuerda que el soporte de plataforma es vital para mantener tu acceso y el de tus estudiantes activo.</p>
            </div>
          </aside>
        </section>
      )}

      <style jsx>{`
        .coordinator-billing-page { max-width: 1200px; }
        .dashboard-grid { display: grid; grid-template-columns: 1fr 320px; gap: 2rem; margin-top: 2rem; }
        .glass-card { padding: 2rem; background: white; border-radius: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--gray-100); }
        h1 { font-family: 'Outfit', sans-serif; color: var(--primary-color); }
        h2 { font-size: 1.25rem; font-family: 'Outfit', sans-serif; margin-bottom: 2rem; color: var(--primary-color); }
        
        .invoice-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .invoice-card { background: #fbfbfb; border-radius: 16px; padding: 1.5rem; border: 1px solid var(--gray-100); transition: transform 0.2s; }
        .invoice-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        .invoice-card.paid { border-left: 5px solid #10b981; }
        .invoice-card.pending { border-left: 5px solid #f59e0b; }

        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .info { display: flex; flex-direction: column; }
        .date { font-weight: 700; color: var(--gray-700); }
        .id { font-size: 0.75rem; color: var(--gray-500); font-weight: 600; }
        
        .status-tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; padding: 0.3rem 0.6rem; border-radius: 6px; }
        .status-tag.paid { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-tag.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
 
        .amount { margin-bottom: 1.5rem; }
        .amount small { font-size: 0.8rem; color: var(--gray-600); }
        .amount h3 { font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: var(--primary-color); }
 
        .students-summary { font-size: 0.9rem; margin-bottom: 1.5rem; }
        .description { font-size: 0.85rem; color: var(--gray-600); margin-top: 0.4rem; font-style: italic; }
 
        .card-footer { display: flex; gap: 0.8rem; border-top: 1px solid var(--gray-100); padding-top: 1rem; }
        .btn-small { padding: 0.5rem 0.8rem; font-size: 0.8rem; }
 
        .billing-info h3 { font-size: 1.1rem; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem; }
        .payment-methods { background: var(--gray-50); padding: 1.2rem; border-radius: 12px; margin: 1.5rem 0; }
        .method { margin-bottom: 1rem; }
        .method:last-child { margin-bottom: 0; }
        .method strong { font-size: 0.85rem; color: var(--primary-color); }
        .method p { font-size: 0.9rem; font-weight: 700; color: var(--secondary-color); }
        
        .info-alert { border-left: 3px solid var(--secondary-color); padding-left: 1rem; margin-top: 2rem; }
        .info-alert p { font-size: 0.85rem; line-height: 1.5; color: var(--primary-color); }

        .empty-state { display: flex; flex-direction: column; align-items: center; padding: 4rem 0; color: var(--gray-300); }
        .empty-state span { font-size: 3rem; margin-bottom: 1rem; }
      `}</style>
    </div>
  );
}
