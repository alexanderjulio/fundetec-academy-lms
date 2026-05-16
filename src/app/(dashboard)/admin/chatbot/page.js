'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { getChatbotConfig, updateChatbotConfig, getAllConversations } from '@/app/actions/chatbot_actions';

export default function AdminChatbotPage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('config');
  const [adminId, setAdminId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [config, setConfig] = useState({
    botName: 'Profesor Virtual',
    systemPrompt: '',
    isActive: true,
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setAdminId(user?.id);
      const { data } = await getChatbotConfig();
      if (data) {
        setConfig({ botName: data.bot_name, systemPrompt: data.system_prompt, isActive: data.is_active });
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'historial') fetchConversations();
  }, [activeTab]);

  async function fetchConversations() {
    const { data } = await getAllConversations();
    setConversations(data);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await updateChatbotConfig({
      botName: config.botName,
      systemPrompt: config.systemPrompt,
      isActive: config.isActive,
      adminId,
    });
    if (error) showNotification('Error: ' + error, 'error');
    else showNotification('Configuración guardada.', 'success');
    setSaving(false);
  }

  // Agrupar mensajes por estudiante para el historial
  const grouped = conversations.reduce((acc, msg) => {
    const name = msg.student?.full_name || 'Desconocido';
    if (!acc[name]) acc[name] = [];
    acc[name].push(msg);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-color border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto p-4 md:p-10 space-y-8 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">Profesor Virtual</h1>
          <p className="text-gray-500 mt-1">Configura el comportamiento del chatbot para estudiantes.</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${config.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
          {config.isActive ? 'Activo' : 'Inactivo'}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 w-fit">
        {['config', 'historial'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {tab === 'config' ? 'Configuración' : 'Historial'}
          </button>
        ))}
      </div>

      {/* TAB: Configuración */}
      {activeTab === 'config' && (
        <form onSubmit={handleSave} className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-gray-100 space-y-8">

          {/* Estado activo */}
          <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl">
            <div>
              <p className="font-black text-gray-900 text-sm">Estado del bot</p>
              <p className="text-xs text-gray-400 mt-0.5">Si está inactivo, los estudiantes verán un mensaje de no disponible.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig(c => ({ ...c, isActive: !c.isActive }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${config.isActive ? 'left-8' : 'left-1'}`} />
            </button>
          </div>

          {/* Nombre del bot */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Nombre del Profesor Virtual</label>
            <input
              type="text"
              required
              value={config.botName}
              onChange={e => setConfig(c => ({ ...c, botName: e.target.value }))}
              className="w-full bg-gray-50 border-none p-5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-gray-900"
              placeholder="Ej: Profe Ana, Asistente FUNDETEC..."
            />
          </div>

          {/* System prompt */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Instrucciones del Profesor (System Prompt)</label>
            <p className="text-xs text-gray-400 pl-1">Define quién es el bot, qué sabe, cómo habla y qué límites tiene.</p>
            <textarea
              required
              rows={10}
              value={config.systemPrompt}
              onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
              className="w-full bg-gray-50 border-none p-5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-mono text-sm text-gray-900 resize-none"
              placeholder="Eres un profesor virtual de FUNDETEC Academy..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </form>
      )}

      {/* TAB: Historial */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {Object.keys(grouped).length === 0 ? (
            <div className="bg-white rounded-[32px] p-16 text-center border border-gray-100">
              <p className="text-gray-400 text-sm">No hay conversaciones aún.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([studentName, messages]) => (
              <div key={studentName} className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm space-y-4">
                <p className="font-black text-gray-900 text-sm">{studentName}</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
