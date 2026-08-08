import React, { useState, useEffect, useRef } from 'react';

/**
 * PuzzleQuestion
 * Props:
 * - question: { id, fragments: string[] }
 * - onSubmit: function(answerString | { answer, timeTakenMs })
 *
 * Componente que permite reordenar fragmentos mediante drag&drop,
 * tap-to-select y teclado (flechas), con bonus de tiempo.
 */
export default function PuzzleQuestion({ question, onSubmit }) {
  const fragments = question.fragments || [];
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // barajar
    const s = [...fragments].sort(() => Math.random() - 0.5);
    setItems(s);
    setSelectedIndex(null);
    startRef.current = Date.now();
  }, [question.id]);

  const moveItem = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setItems(copy);
  };

  const selectItem = (idx) => {
    if (selectedIndex === null) {
      setSelectedIndex(idx);
      return;
    }
    if (selectedIndex === idx) {
      setSelectedIndex(null);
      return;
    }
    moveItem(selectedIndex, idx);
    setSelectedIndex(null);
  };

  // Drag and drop handlers
  const dragIndexRef = useRef(null);
  const onDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer?.setData('text/plain', 'drag'); };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (e, idx) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === undefined) return;
    moveItem(from, idx);
    dragIndexRef.current = null;
  };

  const onKeyDown = (e, idx) => {
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      moveItem(idx, idx - 1);
      setSelectedIndex(null);
    }
    if (e.key === 'ArrowRight' && idx < items.length - 1) {
      e.preventDefault();
      moveItem(idx, idx + 1);
      setSelectedIndex(null);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectItem(idx);
    }
  };

  const handleSubmit = () => {
    const answer = items.join('||');
    const timeTaken = Date.now() - (startRef.current || Date.now());
    if (onSubmit) onSubmit({ answer, timeTakenMs: timeTaken });
  };

  return (
    <div className="flex flex-col items-center gap-4" data-test="puzzle-question">
      <div className="text-lg text-slate-800 font-bold mb-2">Arregla los fragmentos en el orden correcto</div>
      <div className="text-sm text-slate-600 mb-2 text-center">
        Arrastra para ordenar en desktop, toca un fragmento para seleccionarlo y luego toca otro para moverlo.
        Usa ← / → para mover mientras navegas con el teclado.
      </div>
      <div className="w-full flex flex-wrap gap-2 justify-center" data-test="puzzle-fragments">
        {items.map((f, i) => (
          <button
            key={i}
            draggable
            onDragStart={(e) => onDragStart(e, i)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, i)}
            onClick={() => selectItem(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            data-test="puzzle-fragment"
            aria-pressed={selectedIndex === i}
            className={`px-3 py-2 rounded-full border shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${selectedIndex === i ? 'bg-emerald-100 border-emerald-500' : 'bg-white border-slate-200 hover:bg-orange-50'}`}
            tabIndex={0}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="w-full bg-white/10 p-3 rounded-lg min-h-[56px] flex items-center gap-2 justify-center" data-test="puzzle-selected">
        {items.length === 0 ? <span className="text-xs text-white/60">Fragmentos...</span> : (
          <div className="text-xs text-white/60 break-words">Orden actual: {items.join(' ')}</div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <button data-test="puzzle-submit" onClick={handleSubmit} className="bg-emerald-600 px-4 py-2 rounded-2xl text-white font-bold">Enviar</button>
        <button type="button" onClick={() => setItems([...fragments].sort(() => Math.random() - 0.5))} className="bg-slate-700 px-4 py-2 rounded-2xl text-white font-bold hover:bg-slate-600">Barajar</button>
      </div>
    </div>
  );
}
