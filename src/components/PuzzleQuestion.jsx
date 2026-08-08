import React, { useState, useEffect, useRef } from 'react';

/**
 * PuzzleQuestion
 * Props:
 * - question: { id, fragments: string[] }
 * - onSubmit: function(answerString | { answer, timeTakenMs })
 *
 * Componente simple que permite reordenar fragmentos mediante drag&drop
 * y mide el tiempo desde que se monta hasta el envío para cálculo de bonus.
 */
export default function PuzzleQuestion({ question, onSubmit }) {
  const fragments = question.fragments || [];
  const [items, setItems] = useState([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // barajar
    const s = [...fragments].sort(() => Math.random() - 0.5);
    setItems(s);
    startRef.current = Date.now();
  }, [question.id]);

  // Drag and drop handlers
  const dragIndexRef = useRef(null);
  const onDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer?.setData('text/plain', 'drag'); };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (e, idx) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === undefined) return;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(idx, 0, moved);
    setItems(copy);
    dragIndexRef.current = null;
  };

  const handleSubmit = () => {
    const answer = items.join('||');
    const timeTaken = Date.now() - (startRef.current || Date.now());
    if (onSubmit) onSubmit({ answer, timeTakenMs: timeTaken });
  };

  return (
    <div className="flex flex-col items-center gap-4" data-test="puzzle-question">
      <div className="text-lg text-slate-800 font-bold mb-2">Arregla los fragmentos en el orden correcto</div>
      <div className="w-full flex flex-wrap gap-2 justify-center" data-test="puzzle-fragments">
        {items.map((f, i) => (
          <button
            key={i}
            draggable
            onDragStart={(e)=>onDragStart(e,i)}
            onDragOver={onDragOver}
            onDrop={(e)=>onDrop(e,i)}
            data-test="puzzle-fragment"
            className={`px-3 py-2 rounded-full bg-white border hover:bg-orange-50`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="w-full bg-white/10 p-3 rounded-lg min-h-[56px] flex items-center gap-2 justify-center" data-test="puzzle-selected">
        {items.length === 0 ? <span className="text-xs text-white/60">Fragmentos...</span> : (
          <div className="text-xs text-white/60">Orden actual: {items.join(' ')}</div>
        )}
      </div>

      <div className="flex gap-3">
        <button data-test="puzzle-submit" onClick={handleSubmit} className="bg-emerald-600 px-4 py-2 rounded-2xl text-white font-bold">Enviar</button>
      </div>
    </div>
  );
}
