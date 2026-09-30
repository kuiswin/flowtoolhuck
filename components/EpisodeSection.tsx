import React from 'react';
import { Episode, Cut, VideoModelType } from '../types';
import { PillButton } from './Primitives';
import { HistoricalCard } from './HistoricalCard';
import { CutCard } from './CutCard';

interface EpisodeSectionProps {
  ep: Episode;
  onGenerateRemaining: (epId: number) => void;
  onBulkVideo: (epId: number) => void;
  onBulkBrowserVideo: (epId: number) => void;
  onExportFullMovie: (epId: number) => void;
  onDownloadZip: (ep: Episode) => void;
  onAnimateRequest: (epId: number, cutId: number, modelType: VideoModelType) => void;
  onPreviewCut: (epId: number, cut: Cut) => void;
  onUpdateCut: (epId: number, cutId: number, updates: Partial<Cut>) => void;
  onRetry?: (type: 'image' | 'video', epId: number, cutId: number) => void;
}

export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  ep, onGenerateRemaining, onBulkVideo, onBulkBrowserVideo, onExportFullMovie, onDownloadZip, onAnimateRequest, onPreviewCut, onUpdateCut, onRetry
}) => {
  const isPending = !ep.isGenerating && !ep.isDone;

  return (
    <section className={`flex flex-col gap-8 animate-slide-in transition-opacity duration-700 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex flex-col border-b border-white/10 pb-8 gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">{ep.titleJp}</h2>
                {ep.isDone && <span className="material-symbols-outlined text-green-500 font-bold">check_circle</span>}
                {ep.isGenerating && <div className="w-5 h-5 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />}
              </div>
              <span className="text-sm text-white/40 uppercase tracking-widest">{ep.titleEn}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
             <PillButton 
              variant="outline" 
              className="h-10 px-4 border-amber-500/30 text-amber-500 font-bold whitespace-nowrap shrink-0" 
              disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
              onClick={() => onBulkBrowserVideo(ep.id)} 
              icon={<span className="material-symbols-outlined text-amber-500">bolt</span>}
            >
              ⚡ ブラウザ動画化
            </PillButton>
            <PillButton 
              variant="filled" 
              className="h-10 px-4 bg-indigo-600 text-white font-black border border-indigo-400/50 whitespace-nowrap shrink-0" 
              disabled={ep.isExportingMovie || ep.isGenerating || isPending} 
              onClick={() => onExportFullMovie(ep.id)} 
              icon={ep.isExportingMovie ? <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined">movie</span>}
            >
              🎬 動画結合 (MP4)
            </PillButton>
            <PillButton 
              variant="outline" 
              className="h-10 px-4 border-white/10 text-white/40 font-bold whitespace-nowrap shrink-0" 
              disabled={ep.isGeneratingRemainingImages || ep.isGenerating || isPending} 
              onClick={() => onGenerateRemaining(ep.id)} 
              icon={ep.isGeneratingRemainingImages ? <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined">palette</span>}
            >
              🎨 残り描画
            </PillButton>
            <PillButton 
              variant="filled" 
              className="h-10 px-6 bg-amber-500 text-black font-black whitespace-nowrap shrink-0" 
              disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
              onClick={() => onBulkVideo(ep.id)} 
              icon={ep.isBatchGeneratingVideos ? <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined">movie_filter</span>}
            >
              🎬 Veo一括
            </PillButton>
            <PillButton 
              variant="outline" 
              className="h-10 px-6 whitespace-nowrap shrink-0" 
              disabled={isPending}
              onClick={() => onDownloadZip(ep)} 
              icon={<span className="material-symbols-outlined">download</span>}
            >
              パッケージ
            </PillButton>
          </div>
        </div>
        <HistoricalCard ep={ep} />
      </div>

      <div className={`no-wrap-row gap-4 pb-6 dark-scrollbar ${isPending ? 'grayscale pointer-events-none' : ''}`}>
        {ep.cuts.map(cut => (
          <CutCard 
            key={cut.id} cut={cut} episodeId={ep.id} 
            onAnimateRequest={onAnimateRequest}
            onPreviewCut={() => onPreviewCut(ep.id, cut)}
            onUpdateSelection={(eId, cId, sel) => onUpdateCut(eId, cId, { isSelectedForVideo: sel })}
            onUpdateModel={(eId, cId, mod) => onUpdateCut(eId, cId, { targetVideoModel: mod })}
            onRetry={onRetry}
          />
        ))}
      </div>
    </section>
  );
};