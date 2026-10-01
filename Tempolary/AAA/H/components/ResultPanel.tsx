import React, { useState } from 'react';
import { PillButton } from './Primitives';
import { Flow } from 'flow-sdk';

export const ResultPanel: React.FC<{
  prompt: string;
  onGenerate: () => void;
  isGenerating: boolean;
  image: { base64: string; mimeType: string } | null;
  error: string | null;
}> = ({ prompt, onGenerate, isGenerating, image, error }) => {
  const [copyStatus, setCopyStatus] = useState('Copy Prompt');

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopyStatus('Copied!');
    setTimeout(() => setCopyStatus('Copy Prompt'), 2000);
  };

  const handleDownload = async () => {
    if (!image) return;
    await Flow.download({
      base64: image.base64,
      mimeType: image.mimeType,
      filename: `elite-design-${Date.now()}.png`
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Prompt Card */}
      <div className="bg-[#1a1a1a] border border-[#595959] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#595959] flex justify-between items-center bg-white/5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">Elite Synthetic Prompt</span>
          <button 
            onClick={handleCopy}
            className="text-[10px] text-white/40 hover:text-white transition-colors uppercase font-bold"
          >
            {copyStatus}
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm italic text-white/80 leading-relaxed font-mono">
            {prompt}
          </p>
        </div>
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center gap-6">
        <div className="w-64">
          <PillButton 
            variant="solid" 
            onClick={onGenerate}
            disabled={isGenerating}
            icon={<span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
          >
            {isGenerating ? 'Forging Artwork...' : 'Generate Elite Visual'}
          </PillButton>
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
            {error}
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-white/40 uppercase tracking-widest">Translating high-level concepts to pixels...</span>
          </div>
        )}

        {image && !isGenerating && (
          <div className="w-full max-w-2xl bg-white/5 p-2 rounded-2xl border border-white/10 animate-fade-in-up">
            <div className="relative group">
              <img 
                src={`data:${image.mimeType};base64,${image.base64}`} 
                alt="Generated Elite Design"
                className="w-full h-auto rounded-xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-xl">
                 <PillButton variant="outline" onClick={handleDownload} icon={<span className="material-symbols-outlined text-[18px]">download</span>}>
                  Download Asset
                 </PillButton>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-[10px] font-medium text-white/30 uppercase">Masterpiece Output v1.0</span>
              <span className="text-[10px] font-medium text-white/30 uppercase italic">Refined by the Collective</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};