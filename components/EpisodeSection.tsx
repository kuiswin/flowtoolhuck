import React from 'react';
import { Episode, Cut, VideoModelType } from '../types';
import { PillButton } from './Primitives';
import { CutCard } from './CutCard';

/**
 * 時代考証・世界観インテリジェンスカード（作品の時代設定と禁止要素を表示）
 */
export const HistoricalCard: React.FC<{ ep: Episode }> = ({ ep }) => {
  const isMv = !!ep.isMvMode || ep.titleJp.startsWith('🎵');

  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${
      isMv ? 'bg-purple-950/20 border-purple-500/30' : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-xl ${isMv ? 'text-purple-400' : 'text-amber-400'}`}>
            {isMv ? 'headphones' : 'history_edu'}
          </span>
          <h3 className="text-sm font-black tracking-widest uppercase text-white/90">
            {isMv ? 'Music Video Concept Card' : 'Historical Intelligence Card'}
          </h3>
        </div>
        
        {/* 共通設定バッジ */}
        <div className="flex flex-wrap items-center gap-2">
          {isMv && (
            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/40">
              🎵 音楽MVモード
            </span>
          )}
          {ep.taste && (
            <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">
              画風: {ep.taste.split(' (')[0].trim()}
            </span>
          )}
          {ep.era && !isMv && (
            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/30">
              年代: {ep.era.split('（')[0].trim()}
            </span>
          )}
          {ep.theme && (
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30">
              {isMv ? 'シチュエーション' : 'テーマ'}: {ep.theme.split('（')[0].trim()}
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
            {isMv ? 'MVビジュアルコンセプト・情景美（アンニュイ演出）' : '作品世界観・時代分析'}
          </span>
          <p className="text-xs text-white/80 leading-relaxed italic">{ep.eraAnalysis || "分析データ収集中..."}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
            {isMv ? 'ムード阻害・禁止要素 (Strictly Forbidden)' : '禁止要素 (Strictly Forbidden)'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ep.forbiddenAnachronisms && ep.forbiddenAnachronisms.length > 0 ? (
              ep.forbiddenAnachronisms.map((item, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-sm font-medium">
                  {item}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-white/20 italic">特になし</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
  onBulkRerollTelop?: (epId: number) => void;
  onRetry?: (type: 'image' | 'video', epId: number, cutId: number) => void;
}

export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  ep, onGenerateRemaining, onBulkVideo, onBulkBrowserVideo, onExportFullMovie, onDownloadZip, onAnimateRequest, onPreviewCut, onUpdateCut, onBulkRerollTelop, onRetry
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
            {onBulkRerollTelop && (
              <PillButton 
                variant="outline" 
                className="h-10 px-4 border-purple-500/40 text-purple-400 hover:text-purple-200 hover:border-purple-400 hover:bg-purple-950/30 font-black whitespace-nowrap shrink-0 transition-colors" 
                disabled={ep.isGenerating || isPending} 
                onClick={() => onBulkRerollTelop(ep.id)} 
                icon={<span className="material-symbols-outlined text-purple-400">casino</span>}
                title="画像は一切再生成せず、12カットすべてのテロップ演出（動き・配置・スタイル）だけを無限ランダムエンジンで一括再抽選します"
              >
                🎲 テロップ一括リロール
              </PillButton>
            )}
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
            key={cut.id} cut={cut} episodeId={ep.id} isMvMode={ep.isMvMode}
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