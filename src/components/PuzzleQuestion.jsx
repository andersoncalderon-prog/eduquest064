import React, { useState, useEffect } from 'react';

export default function PuzzleQuestion({ question, onSubmit }) {
  const fragments = question.fragments || [];
  const [shuffled, setShuffled] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const s = [...fragments].sort(() => Math.random() - 0.5);
    setShuffled(s);
    setSelected([]);
  }, [question.id]);

  const pick = (i) => {
    const value = shuffled[i];
    setSelected(prev => [...prev, value]);
    setShuffled(prev => prev.map((v, idx) => idx === i ? null : v));
  };

  const removeAt = (i) => {
    const value = selected[i];
    setSelected(prev => prev.filter((_, idx) => idx !== i));
    setShuffled(prev => {
      const idx = prev.findIndex(v => v === null);
      if (idx === -1) return [...prev, value];
      const copy = [...prev]; copy[idx] = value; return copy;
    });
  };

  const handleSubmit = () => {
    const answer = selected.join('||');
    onSubmit(answer);
  };

  return (
    <div className="flex flex-col items-center gap-4" data-test="puzzle-question">
      <div className="text-lg text-slate-800 font-bold mb-2">Arregla los fragmentos en el orden correcto</div>
      <div className="w-full flex flex-wrap gap-2 justify-center" data-test="puzzle-fragments">
        {shuffled.map((f, i) => (
          <button key={i} data-test="puzzle-fragment" disabled={!f} onClick={() => pick(i)} className={`px-3 py-2 rounded-full bg-white border ${!f ? 'opacity-30 cursor-not-allowed' : 'hover:bg-orange-50'}`}>
            {f || ''}
          </button>
        ))}
      </div>

      <div className="w-full bg-white/10 p-3 rounded-lg min-h-[56px] flex items-center gap-2 justify-center" data-test="puzzle-selected">
        {selected.length === 0 ? <span className="text-xs text-white/60">Fragmentos seleccionados...</span> : selected.map((s, i) => (
          <button key={i} data-test="puzzle-selected-fr" onClick={() => removeAt(i)} className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">{s}</button>
        ))}
      </div>

      <div className="flex gap-3">
        <button data-test="puzzle-submit" onClick={handleSubmit} className="bg-emerald-600 px-4 py-2 rounded-2xl text-white font-bold">Enviar</button>
      </div>
    </div>
  );
}
