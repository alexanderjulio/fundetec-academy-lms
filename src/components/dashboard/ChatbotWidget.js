'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { sendMessage, getChatHistory, getChatbotConfig } from '@/app/actions/chatbot_actions';

const SUGGESTIONS = [
  '¿Cómo avanzo en mis cursos?',
  '¿Cuándo son mis exámenes?',
  'Necesito ayuda con una tarea',
  '¿Cómo descargo mi certificado?',
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [botName, setBotName] = useState('Profesor Virtual');
  const [isActive, setIsActive] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showLabel, setShowLabel] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setStudentId(user.id);

      const [{ data: config }, { data: history }] = await Promise.all([
        getChatbotConfig(),
        getChatHistory(user.id),
      ]);

      if (config) {
        setBotName(config.bot_name);
        setIsActive(config.is_active);
      }
      if (history?.length) {
        setMessages(history.map(m => ({ role: m.role, content: m.content })));
      } else {
        setMessages([{ role: 'assistant', content: `¡Hola! Soy tu ${config?.bot_name || 'Profesor Virtual'} 👋\n\nEstoy aquí para ayudarte con tus estudios, dudas académicas y orientación sobre la plataforma. ¿En qué puedo ayudarte hoy?` }]);
      }
      setInitialized(true);
    }
    init();

    // Ocultar label después de 4 segundos
    const t = setTimeout(() => setShowLabel(false), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  async function handleSend(e, quickText) {
    e?.preventDefault();
    const text = (quickText || input).trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    const { reply, error } = await sendMessage({ studentId, message: text });

    if (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: error }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  const isFirstMessage = messages.filter(m => m.role === 'user').length === 0;

  if (!initialized) return null;

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-6 right-6 z-[300] flex items-center gap-3">
        {/* Label animado */}
        {showLabel && !open && (
          <div
            className="bg-white text-primary-color text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg border border-gray-100 whitespace-nowrap animate-fade-label"
            style={{ animation: 'fadeLabel 0.4s ease-out forwards' }}
          >
            Profesor Virtual ✨
          </div>
        )}

        <button
          onClick={() => { setOpen(o => !o); setShowLabel(false); }}
          title={botName}
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0C1E45 0%, #16A34A 100%)' }}
        >
          {/* Pulso verde cuando está cerrado */}
          {!open && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#16A34A' }} />
          )}

          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 7.38 16.74L21 22l-3.26-1.62A10 10 0 1 1 12 2z"/>
              <path d="M8 10h.01M12 10h.01M16 10h.01"/>
            </svg>
          )}
        </button>
      </div>

      {/* Panel de chat */}
      {open && (
        <div
          className="fixed bottom-28 right-6 z-[299] w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-[32px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: '560px', animation: 'popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
        >
          {/* Header */}
          <div className="relative px-5 py-4 flex items-center gap-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0C1E45 0%, #1a3a6e 100%)' }}>
            {/* Decoración de fondo */}
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10" style={{ background: '#16A34A' }} />
            <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-5" style={{ background: '#16A34A' }} />

            <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
              🎓
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="text-white font-black text-base leading-none">{botName}</p>
              <p className="text-white/60 text-[11px] mt-1 font-medium">Asistente de IA · Fundetec Academy</p>
              {isActive && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">En línea</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="relative w-8 h-8 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: '#f8fafc' }}>
            {!isActive ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">😴</div>
                <div>
                  <p className="font-black text-primary-color">Profesor en descanso</p>
                  <p className="text-gray-400 text-sm mt-1">El asistente no está disponible en este momento. Vuelve más tarde.</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #0C1E45, #16A34A)' }}>
                        🎓
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm font-medium'
                          : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100'
                      }`}
                      style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #0C1E45, #1a3a6e)' } : {}}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Sugerencias rápidas — solo al inicio */}
                {isFirstMessage && !loading && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Preguntas frecuentes</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(null, s)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 bg-white text-primary-color hover:bg-primary-color hover:text-white hover:border-primary-color transition-all shadow-sm"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0C1E45, #16A34A)' }}>
                      🎓
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 flex gap-1 items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          {isActive && (
            <div className="p-3 bg-white border-t border-gray-100">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Escribe tu pregunta académica..."
                  disabled={loading}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none font-medium text-gray-900 placeholder-gray-400 disabled:opacity-50 focus:border-primary-color focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0C1E45, #16A34A)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
              <p className="text-center text-[10px] text-gray-300 font-medium mt-2">Powered by GPT-4o · Fundetec Academy</p>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes popUp {
          from { opacity: 0; transform: scale(0.85) translateY(20px); transform-origin: bottom right; }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeLabel {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
