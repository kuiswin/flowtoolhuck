import React from 'react';

export const GenerationProgress: React.FC<{ progress: number; currentAngle?: string }> = ({ progress, currentAngle }) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
      <div className="mx-auto max-w-md bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-white">Studio Batch Active</span>
            <span className="text-[10px] text-white/50">{currentAngle ? `Capturing: ${currentAngle}` : 'Starting photoshoot...'}</span>
          </div>
          <span className="text-[12px] font-mono text-white/80">{progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
    </div>
  );
};