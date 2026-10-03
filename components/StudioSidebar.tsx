import React, { useState, useEffect, useRef } from 'react';
import { SectionLabel, PillButton, FieldDropdown, SegmentedToggle, ToggleSwitch, NumberChoice } from './Primitives';
import { GeneratorSettings, ReferenceAsset } from '../types';
import { THEMES, THEME_CATEGORIES, MV_THEMES, TASTES, IMAGE_MODELS, VIDEO_RATIO_OPTIONS } from '../constants';
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

        <div className="flex flex-col gap-1">
          <SectionLabel>制作モード</SectionLabel>
          <SegmentedToggle 
            value={settings.productionMode} 
            onChange={v => {
              const mode = v as any;
              setSettings(s => ({
                ...s,
                productionMode: mode,
                isMvMode: mode === 'mv',
                theme: mode === 'mv' 
                  ? (MV_THEMES.includes(s.theme) ? s.theme : MV_THEMES[0])
                  : (THEMES.includes(s.theme) ? s.theme : THEMES[0]),
                era: mode === 'mv' 
                  ? (MV_THEMES.includes(s.theme) ? s.theme : MV_THEMES[0])
                  : (THEMES.includes(s.theme) ? s.theme : THEMES[0]),
              }));
            }} 
            items={[
              { value: 'episodes', label: 'ドラマ連番' },
              { value: 'mv', label: '🎵 音楽MV' },
              { value: 'style-matrix', label: '画風比較' }
            ]} 
          />
        </div>

        {/* モード固有固定インフォエリア（高さ一定でタブ切替時のガタつきを防止） */}
        <div className="min-h-[46px] flex flex-col justify-center">
          {settings.productionMode === 'episodes' ? (
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
          ) : settings.productionMode === 'mv' ? (
            <div className="flex items-center justify-between bg-purple-950/40 px-3 py-1.5 rounded-xl border border-purple-500/30 text-purple-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-purple-400 shrink-0">headphones</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-purple-200 truncate">アンニュイ情景連続 MV</span>
                  <span className="text-[9px] text-purple-300/70 truncate">音楽を際立たせる1曲12カット情景</span>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 shrink-0">全12カット</span>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-pink-950/40 px-3 py-1.5 rounded-xl border border-pink-500/30 text-pink-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-pink-400 shrink-0">palette</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-pink-200 truncate">全画風マトリクス比較</span>
                  <span className="text-[9px] text-pink-300/70 truncate">同一プロンプトで複数画風を一括検証</span>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 font-bold border border-pink-400/30 shrink-0">自動比較</span>
            </div>
          )}
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

        <SectionLabel>{settings.productionMode === 'mv' ? 'MV世界観・シチュエーション' : '世界観・テーマ'}</SectionLabel>
        <FieldDropdown 
          label={settings.productionMode === 'mv' ? 'MVシチュエーション (10選)' : '世界観・テーマ'} 
          value={settings.theme} 
          options={settings.productionMode === 'mv' ? MV_THEMES : undefined}
          groups={settings.productionMode === 'mv' ? undefined : THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items }))}
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
              label={settings.productionMode === 'mv' ? '生成曲数' : (settings.productionMode === 'style-matrix' ? '比較画風数' : '生成話数')} 
              value={settings.episodeCount} 
              options={settings.productionMode === 'style-matrix' ? [3, 5, 8, 11] : [1, 5, 10, 20, 50]} 
              formatLabel={v => settings.productionMode === 'style-matrix' && v === 11 ? '11種 (全)' : `${v}${settings.productionMode === 'mv' ? '曲' : (settings.productionMode === 'style-matrix' ? '種' : '話')}`}
              onChange={v => setSettings(s => ({ ...s, episodeCount: v }))} 
            />
          </div>

          {settings.productionMode === 'style-matrix' ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] font-bold">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">photo_library</span>
                比較カット数 (動画なし)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-200 text-[10px] font-black border border-pink-500/30">2枚固定</span>
            </div>
          ) : (
            <>
              <NumberChoice 
                label={settings.productionMode === 'mv' ? '先行カット数' : '生成カット数'} 
                value={settings.previewCutCount} 
                options={[1, 3, 5, 12]} 
                formatLabel={v => v === 12 ? '12枚 (全)' : `${v}枚`} 
                onChange={v => setSettings(s => ({ ...s, previewCutCount: v }))} 
              />
              <SegmentedToggle label="動画化する割合" value={settings.videoRatio} onChange={v => setSettings(s => ({ ...s, videoRatio: v as any }))} items={VIDEO_RATIO_OPTIONS} />
            </>
          )}

          <div className="flex flex-col bg-white/5 rounded-xl p-1.5 border border-white/5 gap-1">
            {settings.productionMode !== 'style-matrix' && (
              <ToggleSwitch label="🎬 動画まで自動完走" checked={settings.autoVideo} onChange={v => setSettings(s => ({ ...s, autoVideo: v }))} />
            )}
            <ToggleSwitch label="📦 完了時自動ダウンロード" checked={settings.autoDownload} onChange={v => setSettings(s => ({ ...s, autoDownload: v }))} />
          </div>
        </div>
        
        <div className="pt-1 flex flex-col gap-2">
          {isProducing ? (
            <PillButton variant="filled" className="h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest animate-pulse" onClick={onAbort} icon={<span className="material-symbols-outlined">stop_circle</span>}>
              🛑 緊急停止 (Abort)
            </PillButton>
          ) : (
            <button 
              type="button"
              disabled={isProducing}
              onClick={onStart}
              className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shadow-lg active:scale-[0.99] ${
                settings.productionMode === 'mv' 
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40 border border-purple-400/50' 
                  : settings.productionMode === 'style-matrix' 
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-rose-900/40 border border-pink-400/50' 
                    : 'bg-white hover:bg-gray-100 text-black shadow-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {settings.productionMode === 'mv' ? 'music_note' : (settings.productionMode === 'style-matrix' ? 'palette' : 'auto_awesome')}
              </span>
              <span>
                {settings.productionMode === 'mv' 
                  ? `🎵 音楽MVを生成 (${settings.episodeCount || 1}曲 / 各12カット)` 
                  : (settings.productionMode === 'style-matrix' 
                      ? '🎨 画風比較を開始' 
                      : (activeSeriesManifest ? `⏩ 第 ${(activeSeriesManifest.completedEpisodeIds?.length || 0) + 1} 話から再開` : '✨ ドラマ生成開始'))}
              </span>
            </button>
          )}
          <PillButton variant="outline" className="text-red-400 h-9" onClick={onClear} icon={<span className="material-symbols-outlined">delete</span>}>全消去</PillButton>
        </div>
      </div>

      <StudioLogs logs={logs} onAddLog={onAddLog} isProducing={isProducing} />
    </div>
  );
};