import React, { useEffect, useRef } from 'react';

interface DesignerLine {
  designerId: number;
  text: string;
}

const DESIGNERS = [
  { id: 1, name: 'The Visionary', color: 'text-purple-400' },
  { id: 2, name: 'The Compositor', color: 'text-blue-400' },
  { id: 3, name: 'The Colorist', color: 'text-red-400' },
  { id: 4, name: 'The Technical Lead', color: 'text-green-400' },
  { id: 5, name: 'The Critic', color: 'text-amber-400' },
];

export const DiscussionLog: React.FC<{ lines: DesignerLine[]; isComplete: boolean }> = ({ lines, isComplete }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[200px] max-h-[400px] overflow-y-auto dark-scrollbar flex flex-col gap-4">
      {lines.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-white/20 italic text-sm">
          Awaiting initialization...
        </div>
      )}
      {lines.map((line, idx) => {
        const d = DESIGNERS[line.designerId - 1];
        return (
          <div key={idx} className="flex flex-col gap-1 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${d.color}`}>{d.name}</span>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>
            <p className="text-[13px] leading-relaxed text-white/70 pl-2 border-l border-white/10 ml-1">
              {line.text}
            </p>
          </div>
        );
      })}
      {isComplete && (
        <div className="pt-4 flex items-center justify-center gap-2 text-green-400 animate-fade-in-up">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span className="text-[11px] font-bold uppercase tracking-tighter">Consensus Reached</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};