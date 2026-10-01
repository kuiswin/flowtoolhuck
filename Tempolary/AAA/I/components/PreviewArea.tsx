import React from 'react';

interface PreviewAreaProps {
  source: any;
  result: any;
  isGenerating: boolean;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({ source, result, isGenerating }) => {
  if (!source && !result && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[40px] text-white/20">face</span>
        </div>
        <h2 className="text-xl font-medium text-white mb-2">Start Morphing</h2>
        <p className="text-white/40 text-sm leading-relaxed">
          Select a portrait image from your gallery to start changing expressions and emotions.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center gap-8">
      {/* Source Preview */}
      {source && (
        <div className={`flex flex-col gap-3 transition-all duration-700 ${result ? 'w-1/3 opacity-40 scale-90' : 'w-full max-w-2xl'}`}>
          <div className="flex justify-between items-center px-2">
            <span className="text-[11px] font-medium text-white/50 uppercase tracking-widest">Original</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <img 
              src={`data:${source.mimeType};base64,${source.base64}`} 
              className="w-full h-auto object-contain" 
              alt="Source"
            />
          </div>
        </div>
      )}

      {/* Generation Result */}
      {(result || isGenerating) && (
        <div className="flex flex-col gap-3 w-2/3 max-w-3xl animate-fade-in">
          <div className="flex justify-between items-center px-2">
            <span className="text-[11px] font-medium text-white/50 uppercase tracking-widest">Morphed</span>
            {isGenerating && (
              <span className="text-[11px] text-[#969696] animate-pulse">Processing pixels...</span>
            )}
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.05)] bg-[#111]">
            {isGenerating ? (
              <div className="aspect-square w-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-white/5 border-t-white/40 rounded-full animate-spin" />
                  <span className="text-sm text-white/30 font-medium">Synthesizing expression...</span>
                </div>
              </div>
            ) : (
              <img 
                src={`data:${result.mimeType};base64,${result.base64}`} 
                className="w-full h-auto object-contain" 
                alt="Result"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};