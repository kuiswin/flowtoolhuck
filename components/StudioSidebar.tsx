import React, { useState, useEffect, useRef } from 'react';
import { SectionLabel, PillButton, FieldDropdown, SegmentedToggle, ToggleSwitch, NumberChoice } from './Primitives';
import { GeneratorSettings, ReferenceAsset } from '../types';
import { THEMES, TASTES, IMAGE_MODELS, VIDEO_RATIO_OPTIONS } from '../constants';
import { StudioLogs, LogEntry } from './StudioLogs';
import { ReferenceVault } from './ReferenceVault';
import { getAllReferenceAssets } from '../services/db';

interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStart: () => void;
  onAbort: () => void;
  onClear: () => void;
  onOpenArchive: () => void;
  onResumeSeries?: (manifest: any) => void;
  activeSeriesManifest?: any;
  logs: LogEntry[];
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, onClear, onOpenArchive, onResumeSeries, activeSeriesManifest, logs, onAddLog
}) => {
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const resumeFileRef = useRef<HTMLInputElement | null>(null);

  const refreshAssets = async () => {
    const assets = await getAllReferenceAssets();
    setReferenceAssets(assets);
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const manifest = JSON.parse(event.target?.result as string);
        if (!manifest.seriesTitle || !manifest.episodesPlan) {
          onAddLog('❌ 有効なシリーズ設定ファイル(JSON)ではありません。', 'error');
          return;
        }
        if (onResumeSeries) onResumeSeries(manifest);
      } catch (err: any) {
        onAddLog(`❌ JSON読み込み失敗: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-[380px] border-r border-white/10 flex flex-col p-2.5 shrink-0 bg-[#121212] z-10 shadow-2xl h-full">
      {/* ── 最上部固定ヘッダーエリア（スクロールしても絶対に隠れない） ── */}
      <div className="flex flex-col gap-2 shrink-0 pb-2.5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">movie_edit</span>
            <h1 className="text-lg font-black italic tracking-tighter uppercase">Studio Pro</h1>
          </div>
          <button onClick={onOpenArchive} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
            <span className="material-symbols-outlined text-[18px]">folder</span>
          </button>
        </div>

        {/* 連載レジュームセクション */}
        <input type="file" ref={resumeFileRef} accept=".json" className="hidden" onChange={handleResumeFileChange} />
        <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-gray-300">連載レジューム</span>
            <span className="text-[9px] text-gray-400">
              {activeSeriesManifest 
                ? `『${activeSeriesManifest.seriesTitle}』(${activeSeriesManifest.completedEpisodeIds?.length || 0}/${activeSeriesManifest.totalEpisodes}話完了)` 
                : 'manifest.jsonから復元'}
            </span>
          </div>
          <button 
            type="button" 
            disabled={isProducing}
            onClick={() => resumeFileRef.current?.click()}
            className="px-2.5 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">file_open</span>
            読込
          </button>
        </div>

        {/* 最重要：制作モード切り替え（常時固定表示） */}
        <div className="flex flex-col gap-1">
          <SectionLabel>制作モード</SectionLabel>
          <SegmentedToggle 
            value={settings.productionMode} 
            onChange={v => setSettings(s => ({ ...s, productionMode: v as any }))} 
            items={[
              { value: 'episodes', label: 'ドラマ連番' },
              { value: 'style-matrix', label: '画風比較' }
            ]} 
          />
        </div>
      </div>

      {/* ── スクロールエリア（設定詳細） ── */}
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 dark-scrollbar flex-1 py-2.5">
        
        <ReferenceVault 
          assets={referenceAssets} 
          selectedId={settings.selectedAssetId} 
          onSelect={(id) => setSettings(s => ({ ...s, selectedAssetId: id }))}
          onRefresh={refreshAssets}
          onAddLog={onAddLog}
          disabled={isProducing}
        />

        <SectionLabel>世界観・テーマ</SectionLabel>
        <FieldDropdown 
          label="世界観・テーマ" 
          value={settings.theme} 
          options={THEMES} 
          onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
          disabled={isProducing} 
        />
        
        <FieldDropdown 
          label="画風・テイスト" 
          value={settings.productionMode === 'style-matrix' ? '🎨 全画風マトリクス比較（自動）' : (settings.selectedAssetId ? '🎨 参照画像の画風同期中' : settings.taste)} 
          options={Object.keys(TASTES)} 
          onChange={v => setSettings(s => ({ ...s, taste: v }))} 
          disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId} 
        />

        <SectionLabel>自動化設定</SectionLabel>
        <div className="flex flex-col gap-2.5">
          <FieldDropdown label="画像モデル" value={settings.imageModel} options={IMAGE_MODELS.map(m => m.label)} onChange={v => setSettings(s => ({ ...s, imageModel: v }))} disabled={isProducing} />
          
          <div className="grid grid-cols-2 gap-2">
             <NumberChoice label="並列数" value={settings.parallelCount} options={[1, 2, 3, 4]} onChange={v => setSettings(s => ({ ...s, parallelCount: v }))} />
             <NumberChoice 
               label={settings.productionMode === 'style-matrix' ? '比較画風数' : '生成話数'} 
               value={settings.episodeCount} 
               options={settings.productionMode === 'style-matrix' ? [3, 5, 8, 11] : [1, 5, 10, 20, 50]} 
               formatLabel={v => settings.productionMode === 'style-matrix' && v === 11 ? '11種 (全)' : `${v}${settings.productionMode === 'style-matrix' ? '種' : '話'}`}
               onChange={v => setSettings(s => ({ ...s, episodeCount: v }))} 
             />
          </div>

          <NumberChoice 
            label="生成カット数" 
            value={settings.previewCutCount} 
            options={[1, 3, 5, 12]} 
            formatLabel={v => v === 12 ? '12枚 (全)' : `${v}枚`} 
            onChange={v => setSettings(s => ({ ...s, previewCutCount: v }))} 
          />
          <SegmentedToggle label="動画化する割合" value={settings.videoRatio} onChange={v => setSettings(s => ({ ...s, videoRatio: v as any }))} items={VIDEO_RATIO_OPTIONS} />

          <div className="flex flex-col bg-white/5 rounded-xl p-1.5 border border-white/5 gap-1">
            <ToggleSwitch label="🎬 動画まで自動完走" checked={settings.autoVideo} onChange={v => setSettings(s => ({ ...s, autoVideo: v }))} />
            <ToggleSwitch label="📦 完了時自動ダウンロード" checked={settings.autoDownload} onChange={v => setSettings(s => ({ ...s, autoDownload: v }))} />
          </div>
        </div>
        
        <div className="pt-1 flex flex-col gap-2">
          {isProducing ? (
            <PillButton variant="filled" className="h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest animate-pulse" onClick={onAbort} icon={<span className="material-symbols-outlined">stop_circle</span>}>
              🛑 緊急停止 (Abort)
            </PillButton>
          ) : (
            <PillButton variant="solid" className="h-11 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest" onClick={onStart} icon={<span className="material-symbols-outlined">{settings.productionMode === 'style-matrix' ? 'palette' : 'auto_awesome'}</span>}>
              {settings.productionMode === 'style-matrix' 
                ? '🎨 画風比較を開始' 
                : (activeSeriesManifest ? `⏩ 第 ${(activeSeriesManifest.completedEpisodeIds?.length || 0) + 1} 話から再開` : '✨ 生成開始')}
            </PillButton>
          )}
          <PillButton variant="outline" className="text-red-400 h-9" onClick={onClear} icon={<span className="material-symbols-outlined">delete</span>}>全消去</PillButton>
        </div>
      </div>

      <StudioLogs logs={logs} onAddLog={onAddLog} isProducing={isProducing} />
    </div>
  );
};