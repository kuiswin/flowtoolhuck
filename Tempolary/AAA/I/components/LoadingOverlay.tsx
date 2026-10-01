import React from 'react';

export const LoadingOverlay: React.FC<{ emotion: string }> = ({ emotion }) => (
  <div className="fixed inset-0 z-[100] bg-[#0e0e0e]/80 backdrop-blur-md flex items-center justify-center pointer-events-none">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="w-24 h-24 border-2 border-white/5 rounded-full" />
        <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-white animate-pulse">auto_awesome</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-xl font-medium text-white">Applying {emotion}</h3>
        <p className="text-white/40 text-sm">Morphing facial landmarks...</p>
      </div>
    </div>
  </div>
);