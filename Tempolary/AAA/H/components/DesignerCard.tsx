import React from 'react';

const DESIGNERS = [
  { id: 1, name: 'Visionary', icon: 'visibility', color: 'text-purple-400' },
  { id: 2, name: 'Compositor', icon: 'grid_view', color: 'text-blue-400' },
  { id: 3, name: 'Colorist', icon: 'palette', color: 'text-red-400' },
  { id: 4, name: 'Technical', icon: 'architecture', color: 'text-green-400' },
  { id: 5, name: 'Critic', icon: 'verified', color: 'text-amber-400' },
];

export const DesignerCard: React.FC<{ id: number; isActive: boolean; isSpeaking: boolean }> = ({ id, isActive, isSpeaking }) => {
  const d = DESIGNERS[id - 1];
  
  return (
    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
      <div className={`relative w-16 h-16 rounded-full flex items-center justify-center bg-white/5 border ${isSpeaking ? 'border-white animate-pulse' : 'border-white/10'}`}>
        <span className={`material-symbols-outlined text-2xl ${d.color}`}>
          {d.icon}
        </span>
        {isSpeaking && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0e0e0e]" />
        )}
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{d.name}</span>
        <span className="text-[9px] text-white/40">Designer 0{id}</span>
      </div>
    </div>
  );
};