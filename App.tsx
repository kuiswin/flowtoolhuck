import React, { useState, useEffect, useCallback } from 'react';
import { ConfirmationModal } from './components/Primitives';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { ArchiveDrawer } from './components/ArchiveDrawer';
import { StudioSidebar } from './components/StudioSidebar';
import { EpisodeSection } from './components/EpisodeSection';
import { LogEntry } from './components/StudioLogs';
import { Cut, GeneratorSettings, VideoModelType } from './types';
import { ERAS, THEMES, TASTES, IMAGE_MODELS, VIDEO_MODELS } from './constants';
import { createLogMessage } from './lib/utils';
import { initDB, getAllStories, StoryRecord } from './services/db';
import { downloadZip } from './services/exportService';
import { useStudioProduction } from './hooks/useStudioProduction';

export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>({
    productionMode: 'episodes', country: '日本', customCountry: '', era: ERAS[0], customEra: '', theme: THEMES[0], customTheme: '', taste: Object.keys(TASTES)[0], customTaste: '', imageModel: IMAGE_MODELS[1].label, defaultVideoModel: VIDEO_MODELS[0].label, videoRatio: '30%', episodeCount: 1, previewCutCount: 3, parallelCount: 2, autoVideo: false, autoDownload: false
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [previewingCutData, setPreviewingCutData] = useState<{ epId: number; cut: Cut } | null>(null);

  // ログ保持数を9999に拡大（1万行制限）
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-9999), { id: Math.random().toString(36).substr(2, 9), message: createLogMessage(message), type }]);
  }, []);

  const refreshStories = useCallback(async () => {
    const all = await getAllStories();
    setStories(all);
  }, []);

  const { episodes, isProducing, startProduction, abortProduction, resumeSeries, activeSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, generateImage, generateVideo, generateBrowserVideo, updateCut, clearEpisodes } = useStudioProduction({ settings, logs, addLog, refreshStories });

  const handleResumeSeries = useCallback(async (manifest: any) => {
    if (manifest.settings) {
      setSettings(prev => ({ ...prev, ...manifest.settings }));
    }
    await resumeSeries(manifest, (assetId: number) => {
      setSettings(prev => ({ ...prev, selectedAssetId: assetId }));
    });
  }, [resumeSeries]);

  const updateCutWrapped = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    updateCut(epId, cutId, updates);
    setPreviewingCutData(prev => (prev && prev.epId === epId && prev.cut.id === cutId) ? { ...prev, cut: { ...prev.cut, ...updates } } : prev);
  }, [updateCut]);

  useEffect(() => {
    initDB().then(refreshStories);
    const style = document.createElement('style');
    style.id = 'studio-core-styles';
    style.textContent = `.no-wrap-row { display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; } .dark-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-in { animation: slideIn 0.3s ease-out forwards; } @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
    document.head.appendChild(style);
  }, [refreshStories]);

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e] text-white select-none">
      <StudioSidebar settings={settings} setSettings={setSettings} isProducing={isProducing} onStart={startProduction} onAbort={abortProduction} onClear={() => setIsTrashModalOpen(true)} onOpenArchive={() => setArchiveOpen(true)} onResumeSeries={handleResumeSeries} activeSeriesManifest={activeSeriesManifest} logs={logs} onAddLog={addLog} />
      <div className="flex-1 overflow-y-auto p-8 bg-[#080808] dark-scrollbar">
        <div className="max-w-[1300px] mx-auto flex flex-col gap-16">
          {episodes.map(ep => (
            <EpisodeSection 
              key={ep.id} ep={ep} onGenerateRemaining={handleGenerateRemaining} onBulkVideo={handleBulkVideo} onBulkBrowserVideo={handleBulkBrowserVideo} onExportFullMovie={handleExportFullMovie} onDownloadZip={(e) => downloadZip(e, addLog, activeSeriesManifest || undefined, logs)} onAnimateRequest={generateVideo} onPreviewCut={(eId, cut) => setPreviewingCutData({ epId: eId, cut })} onUpdateCut={updateCutWrapped} onRetry={(type, eId, cId) => {
                const epFound = episodes.find(e => e.id === eId);
                const cutFound = epFound?.cuts.find(c => c.id === cId);
                if (type === 'image' && cutFound) generateImage({ epId: eId, cutId: cId, prompt: cutFound.promptEn, styleKey: settings.taste, imageModel: settings.imageModel, eraAnalysis: epFound?.eraAnalysis, forbiddenAnachronisms: epFound?.forbiddenAnachronisms });
                else if (type === 'video' && cutFound) generateVideo(eId, cId, (cutFound.targetVideoModel === 'none' ? 'veo-lite' : cutFound.targetVideoModel) as VideoModelType);
              }} 
            />
          ))}
          {episodes.length === 0 && <div className="h-[60vh] flex flex-col items-center justify-center opacity-20 gap-4"><span className="material-symbols-outlined text-[120px]">movie_edit</span><p className="text-xl font-black uppercase tracking-widest italic">Studio Ready</p></div>}
        </div>
      </div>
      {previewingCutData && (() => {
        const activeCut = episodes.find(e => e.id === previewingCutData.epId)?.cuts.find(c => c.id === previewingCutData.cut.id) || previewingCutData.cut;
        return (
          <MediaPreviewModal isOpen={true} cut={activeCut} episodeId={previewingCutData.epId} onClose={() => setPreviewingCutData(null)} onAnimate={m => generateVideo(previewingCutData.epId, activeCut.id, m)} onBrowserAnimate={() => generateBrowserVideo(previewingCutData.epId, activeCut.id)} onUpdateCut={updates => updateCutWrapped(previewingCutData.epId, activeCut.id, updates)} onRegenerateImage={(model, prompt, neg) => {
              const ep = episodes.find(e => e.id === previewingCutData.epId);
              generateImage({ epId: previewingCutData.epId, cutId: activeCut.id, prompt: prompt || activeCut.promptEn, negativePrompt: neg || activeCut.negativePrompt, styleKey: settings.taste, imageModel: model, eraAnalysis: ep?.eraAnalysis, forbiddenAnachronisms: ep?.forbiddenAnachronisms });
            }} 
          />
        );
      })()}
      <ArchiveDrawer isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} stories={stories} onRemake={(s) => { setSettings(prev => ({ ...prev, country: s.country, era: s.era, theme: s.theme })); setArchiveOpen(false); }} />
      <ConfirmationModal isOpen={isTrashModalOpen} title="全消去" message="制作中のデータを消去します。" onConfirm={() => { clearEpisodes(); setIsTrashModalOpen(false); }} onCancel={() => setIsTrashModalOpen(false)} />
    </div>
  );
}