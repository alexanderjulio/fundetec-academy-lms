'use client';

import { useRef, useEffect, useState } from 'react';

const BRAND_COLORS = [
  { name: 'Default', color: 'inherit' },
  { name: 'Azul', color: '#2F4B8C' },
  { name: 'Verde', color: '#28B449' },
  { name: 'Naranja', color: '#f5a623' },
  { name: 'Gris', color: '#64748b' },
  { name: 'Blanco', color: '#FFFFFF' }
];

const FONT_SIZES = [
  { label: 'T1', tag: 'h1', desc: 'Título Hero' },
  { label: 'T2', tag: 'h2', desc: 'Título Sección' },
  { label: 'T3', tag: 'h3', desc: 'Subtítulo' },
  { label: 'P', tag: 'p', desc: 'Cuerpo' },
  { label: 'S', tag: 'small', desc: 'Pequeño' }
];

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [showColors, setShowColors] = useState(false);

  // Sincronizar valor inicial
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCommand = (command, val = null) => {
    document.execCommand(command, false, val);
    editorRef.current.focus();
    handleInput();
    setShowColors(false);
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="rich-editor-container border border-gray-100 rounded-[40px] overflow-hidden bg-white shadow-sm focus-within:ring-8 focus-within:ring-secondary-color/5 transition-all">
      {/* TOOLBAR */}
      <div className="flex items-center gap-1 p-4 bg-slate-50/50 border-b border-gray-100 flex-wrap overflow-visible relative">
        
        {/* FORMATO BÁSICO */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mr-2">
          <button type="button" onClick={() => execCommand('bold')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center font-black text-xs transition-all" title="Negrita">B</button>
          <button type="button" onClick={() => execCommand('italic')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center italic text-xs transition-all" title="Itálica">I</button>
          <button type="button" onClick={() => execCommand('underline')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center underline text-xs transition-all" title="Subrayado">U</button>
        </div>

        {/* TAMAÑOS */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mr-2">
          {FONT_SIZES.map(sz => (
            <button 
              key={sz.tag} 
              type="button" 
              onClick={() => execCommand('formatBlock', sz.tag)}
              className="px-3 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center font-black text-[9px] uppercase tracking-tighter transition-all"
              title={sz.desc}
            >
              {sz.label}
            </button>
          ))}
        </div>

        {/* COLORES */}
        <div className="relative">
          <button 
            type="button" 
            onClick={() => setShowColors(!showColors)}
            className="w-10 h-10 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center hover:bg-slate-50 transition-all"
            title="Color de Texto"
          >
            <span className="text-[10px] font-black leading-none">A</span>
            <div className="w-4 h-1 mt-0.5 rounded-full bg-gradient-to-r from-primary-color to-secondary-color"></div>
          </button>
          
          {showColors && (
            <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-100 rounded-[28px] shadow-2xl z-50 grid grid-cols-3 gap-2 min-w-[120px] animate-pop">
              {BRAND_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => execCommand('foreColor', c.color)}
                  className="w-8 h-8 rounded-full border border-gray-100 shadow-sm hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: c.color === 'inherit' ? '#f1f5f9' : c.color }}
                  title={c.name}
                >
                  {c.color === 'inherit' && <span className="text-[8px] font-bold">✕</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TIPOGRAFÍA */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mx-2">
          <button 
            type="button" 
            onClick={() => execCommand('fontName', 'Outfit')}
            className="px-3 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center font-black text-[9px] uppercase tracking-tighter transition-all"
            title="Tipografía Display"
          >
            Outfit
          </button>
          <button 
            type="button" 
            onClick={() => execCommand('fontName', 'Inter')}
            className="px-3 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center font-medium text-[9px] uppercase tracking-tighter transition-all"
            title="Tipografía Body"
          >
            Inter
          </button>
        </div>

        {/* ALINEACIÓN */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mr-2">
          <button type="button" onClick={() => execCommand('justifyLeft')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-[10px]" title="Izquierda">←</button>
          <button type="button" onClick={() => execCommand('justifyCenter')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-[10px]" title="Centro">↔</button>
          <button type="button" onClick={() => execCommand('justifyRight')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-[10px]" title="Derecha">→</button>
        </div>

        {/* LISTAS Y LIMPIEZA */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 ml-auto">
          <button type="button" onClick={() => execCommand('insertUnorderedList')} className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-[12px]" title="Lista">•</button>
          <button type="button" onClick={() => execCommand('removeFormat')} className="w-9 h-9 rounded-xl hover:bg-red-50 text-red-400 flex items-center justify-center text-[10px]" title="Limpiar Formato">✕</button>
        </div>
      </div>

      {/* EDITABLE AREA */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-10 min-h-[300px] outline-none prose prose-slate max-w-none text-primary-color leading-relaxed editor-content"
        placeholder={placeholder}
      ></div>

      <style jsx>{`
        .editor-content {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
        }
        .editor-content :global(h1) { font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 900; line-height: 1; margin: 1rem 0; color: #2F4B8C; }
        .editor-content :global(h2) { font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 800; margin: 1rem 0; color: #2F4B8C; }
        .editor-content :global(h3) { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        .editor-content :global(p) { margin-bottom: 0.5rem; }
        .editor-content :global(font[face="Outfit"]) { font-family: 'Outfit', sans-serif; }
        .editor-content :global(font[face="Inter"]) { font-family: 'Inter', sans-serif; }
        
        [contenteditable]:empty:before {
          content: attr(placeholder);
          color: #cbd5e1;
          font-weight: 500;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
