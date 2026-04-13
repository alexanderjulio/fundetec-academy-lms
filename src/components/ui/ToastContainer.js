'use client';

import React from 'react';

export default function ToastContainer({ notifications, onRemove }) {
  if (notifications.length === 0) return null;

  return (
    <div className="toast-wrapper">
      {notifications.map((n) => (
        <div key={n.id} className={`toast-item ${n.type} animate-slide-in`}>
          <div className="toast-content">
            <span className="toast-icon">
              {n.type === 'success' && '✅'}
              {n.type === 'error' && '🚨'}
              {n.type === 'warning' && '⚠️'}
              {n.type === 'info' && '📢'}
            </span>
            <p>{n.message}</p>
          </div>
          <button className="toast-close" onClick={() => onRemove(n.id)}>×</button>
        </div>
      ))}

      <style jsx>{`
        .toast-wrapper {
          position: fixed;
          top: 2rem;
          right: 2rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          pointer-events: none;
        }

        .toast-item {
          pointer-events: auto;
          min-width: 320px;
          max-width: 450px;
          background: white;
          padding: 1.25rem 1.5rem;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
          border: 1px solid rgba(12, 30, 69, 0.08);
          position: relative;
          overflow: hidden;
        }

        .toast-item::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          background: var(--primary-color);
        }

        .toast-item.success::before { background: var(--secondary-color); }
        .toast-item.error::before { background: #ef4444; }
        .toast-item.warning::before { background: #f59e0b; }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .toast-icon { font-size: 1.4rem; }
        .toast-item p { 
          margin: 0; 
          font-size: 0.95rem; 
          font-weight: 600; 
          color: var(--primary-color); 
          line-height: 1.4;
        }

        .toast-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: var(--gray-400);
          cursor: pointer;
          transition: color 0.2s;
          padding: 0.2rem;
          line-height: 1;
        }

        .toast-close:hover { color: var(--primary-color); }

        .animate-slide-in {
          animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(50px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }

        @media (max-width: 640px) {
          .toast-wrapper {
            top: 1rem;
            right: 1rem;
            left: 1rem;
            align-items: center;
          }
          .toast-item { width: 100%; min-width: unset; }
        }
      `}</style>
    </div>
  );
}
